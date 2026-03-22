/**
 * Audio playback engine with lazy loading, ambient loop, and SFX triggers.
 *
 * Singleton accessed via getAudioManager(). All audio files lazy-load on
 * first trigger (not eagerly). AudioContext created on first user interaction
 * per browser autoplay policy.
 *
 * SFX trigger points:
 * - 'footstep': Every ~0.3s during BILLY walk state
 * - 'knock': When knockTimer is first set in characters.ts
 * - 'paper': When fileStore.addFile is called
 * - 'chime': When agentStatus transitions from 'thinking' to 'idle'/'needs-attention'
 *
 * NO keyboard typing sounds per CONTEXT.md locked decision.
 */
import { useAudioStore } from '@/store/audioStore';

/** Room volume multipliers for ambient sound */
const ROOM_VOLUME_MAP: Record<string, number> = {
  'war-room': 1.0,
  'billy': 0.8,
};
const AGENT_ROOM_VOLUME = 0.6;
const HALLWAY_VOLUME = 0.8;

/** Duration of ambient volume crossfade in seconds */
const CROSSFADE_DURATION = 0.2;

/** SFX file paths relative to public/ */
const SFX_PATHS: Record<string, string> = {
  footstep: '/audio/sfx-footstep.mp3',
  knock: '/audio/sfx-knock.mp3',
  paper: '/audio/sfx-paper.mp3',
  chime: '/audio/sfx-chime.mp3',
};

class AudioManager {
  private audioContext: AudioContext | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private sfxBuffers: Map<string, AudioBuffer> = new Map();
  private ambientBuffer: AudioBuffer | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private loadingPromises: Map<string, Promise<AudioBuffer | null>> = new Map();
  private isAmbientPlaying = false;

  /**
   * Creates AudioContext lazily on first user interaction.
   * Must be called from a click/keydown handler (browser autoplay policy).
   */
  ensureContext(): void {
    if (this.audioContext) {
      // Resume if suspended (e.g. after tab switch)
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }
      return;
    }

    this.audioContext = new AudioContext();

    // Create gain nodes
    this.ambientGain = this.audioContext.createGain();
    this.ambientGain.gain.value = 0;
    this.ambientGain.connect(this.audioContext.destination);

    this.sfxGain = this.audioContext.createGain();
    this.sfxGain.gain.value = useAudioStore.getState().sfxVolume;
    this.sfxGain.connect(this.audioContext.destination);
  }

  /**
   * Fetch and decode ambient audio on first unmute. Lazy-loaded.
   */
  private async loadAmbient(): Promise<void> {
    if (this.ambientBuffer || !this.audioContext) return;

    try {
      const response = await fetch('/audio/ambient-office.mp3');
      const arrayBuffer = await response.arrayBuffer();
      this.ambientBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (err) {
      console.warn('Failed to load ambient audio:', err);
    }
  }

  /**
   * Fetch and decode a specific SFX file on first trigger. Cache in sfxBuffers.
   */
  private async loadSfx(name: string): Promise<AudioBuffer | null> {
    if (this.sfxBuffers.has(name)) return this.sfxBuffers.get(name)!;
    if (!this.audioContext) return null;

    // Prevent duplicate loads
    const existing = this.loadingPromises.get(name);
    if (existing) return existing;

    const path = SFX_PATHS[name];
    if (!path) return null;

    const promise = (async () => {
      try {
        const response = await fetch(path);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await this.audioContext!.decodeAudioData(arrayBuffer);
        this.sfxBuffers.set(name, buffer);
        return buffer;
      } catch (err) {
        console.warn(`Failed to load SFX '${name}':`, err);
        return null;
      } finally {
        this.loadingPromises.delete(name);
      }
    })();

    this.loadingPromises.set(name, promise);
    return promise;
  }

  /**
   * Start looping ambient with volume adjustment per room.
   * Only plays if !ambientMuted.
   */
  async playAmbient(roomId: string | null): Promise<void> {
    if (!this.audioContext || !this.ambientGain) return;

    const { ambientMuted, ambientVolume } = useAudioStore.getState();
    if (ambientMuted) return;

    // Load ambient if not yet loaded
    await this.loadAmbient();
    if (!this.ambientBuffer) return;

    // Stop existing ambient source if playing
    this.stopAmbientSource();

    // Create new source and start loop
    const source = this.audioContext.createBufferSource();
    source.buffer = this.ambientBuffer;
    source.loop = true;
    source.connect(this.ambientGain);
    source.start();
    this.ambientSource = source;
    this.isAmbientPlaying = true;

    // Set volume for current room
    const roomMultiplier = this.getRoomVolumeMultiplier(roomId);
    this.ambientGain.gain.setValueAtTime(
      ambientVolume * roomMultiplier,
      this.audioContext.currentTime,
    );
  }

  /**
   * Stop ambient loop.
   */
  stopAmbient(): void {
    this.stopAmbientSource();
    this.isAmbientPlaying = false;
    if (this.ambientGain) {
      this.ambientGain.gain.value = 0;
    }
  }

  private stopAmbientSource(): void {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
      } catch {
        // Already stopped
      }
      this.ambientSource.disconnect();
      this.ambientSource = null;
    }
  }

  /**
   * Smooth volume crossfade (200ms) when room changes.
   */
  updateAmbientForRoom(roomId: string | null): void {
    if (!this.audioContext || !this.ambientGain || !this.isAmbientPlaying) return;

    const { ambientMuted, ambientVolume } = useAudioStore.getState();
    if (ambientMuted) return;

    const roomMultiplier = this.getRoomVolumeMultiplier(roomId);
    const targetVolume = ambientVolume * roomMultiplier;
    const now = this.audioContext.currentTime;

    this.ambientGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
    this.ambientGain.gain.linearRampToValueAtTime(targetVolume, now + CROSSFADE_DURATION);
  }

  /**
   * Play a one-shot SFX if !sfxMuted. Lazy-loads the file on first trigger.
   */
  async playSfx(name: string): Promise<void> {
    if (!this.audioContext || !this.sfxGain) return;

    const { sfxMuted, sfxVolume } = useAudioStore.getState();
    if (sfxMuted) return;

    // Update sfx gain volume
    this.sfxGain.gain.value = sfxVolume;

    const buffer = await this.loadSfx(name);
    if (!buffer || !this.audioContext) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.sfxGain);
    source.start();
  }

  /**
   * Start/stop ambient based on mute state.
   */
  setAmbientMuted(muted: boolean): void {
    if (muted) {
      this.stopAmbient();
    }
    // If unmuting, caller should call playAmbient() separately
  }

  /**
   * Adjust the SFX gain volume (0.0 – 1.0). Initializes context if needed.
   * Syncs to sfxGain node immediately when available.
   */
  setSfxVolume(volume: number): void {
    if (!this.sfxGain) {
      this.ensureContext();
    }
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(volume, this.audioContext?.currentTime ?? 0, 0.01);
    }
  }

  /**
   * Mute or unmute all audio output (both sfx and ambient).
   * Sets master gain to 0 (mute) or restores previous sfxVolume (unmute).
   */
  setMuted(muted: boolean): void {
    if (!this.sfxGain) {
      this.ensureContext();
    }
    if (this.sfxGain) {
      this.sfxGain.gain.value = muted ? 0 : useAudioStore.getState().sfxVolume;
    }
    if (this.ambientGain) {
      this.ambientGain.gain.value = muted ? 0 : useAudioStore.getState().ambientVolume;
    }
  }

  /**
   * Synchronous non-throwing wrapper for playSfx. Fires and forgets.
   * Does NOT throw even when AudioContext is suspended or sound key unknown.
   */
  playSound(name: string): void {
    if (!this.audioContext) return;
    void this.playSfx(name);
  }

  /**
   * Get or create the singleton AudioManager instance.
   * Does NOT call ensureContext — context is created lazily on first user interaction.
   */
  static getInstance(): AudioManager {
    if (!instance) {
      instance = new AudioManager();
    }
    return instance;
  }

  /**
   * Get room-specific volume multiplier.
   */
  private getRoomVolumeMultiplier(roomId: string | null): number {
    if (!roomId) return HALLWAY_VOLUME;
    return ROOM_VOLUME_MAP[roomId] ?? AGENT_ROOM_VOLUME;
  }
}

/** Singleton AudioManager instance */
let instance: AudioManager | null = null;

/**
 * Get the singleton AudioManager instance.
 */
export function getAudioManager(): AudioManager {
  if (!instance) {
    instance = new AudioManager();
  }
  return instance;
}

export { AudioManager };
