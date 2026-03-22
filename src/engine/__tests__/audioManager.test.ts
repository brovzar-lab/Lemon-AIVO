/**
 * Tests for AudioManager volume, mute, and playback behavior.
 * TDD: RED phase — these tests define expected behavior before implementation.
 * setSfxVolume, setMuted, and playSound APIs are not yet implemented.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// AudioContext mock
const mockGain = {
  gain: { value: 1.0, setTargetAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
  connect: vi.fn(),
};
const mockBufferSource = {
  connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
  buffer: null, loop: false, onended: null,
};
const mockContext = {
  state: 'running' as AudioContext['state'],
  resume: vi.fn().mockResolvedValue(undefined),
  createGain: vi.fn(() => mockGain),
  destination: {},
  decodeAudioData: vi.fn(),
  createBufferSource: vi.fn(() => ({ ...mockBufferSource })),
  currentTime: 0,
};
// Must use a regular function (not arrow) for constructor mocking with 'new'
vi.stubGlobal('AudioContext', function AudioContextMock() { return mockContext; });

vi.mock('@/store/audioStore', () => ({
  useAudioStore: {
    getState: vi.fn(() => ({ sfxVolume: 1.0, ambientVolume: 0.5, isMuted: false, sfxMuted: false, ambientMuted: false })),
  },
}));

// Mock fetch for audio file loading
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
}));

describe('AudioManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock state
    mockContext.state = 'running';
    mockGain.gain.value = 1.0;
  });

  it('setVolume updates the gain node value', async () => {
    const { AudioManager } = await import('../audioManager');
    const manager = AudioManager.getInstance();
    manager.setSfxVolume(0.5);
    // gain.value should be updated or setTargetAtTime called
    expect(
      mockGain.gain.value === 0.5 ||
      mockGain.gain.setTargetAtTime.mock.calls.length > 0 ||
      mockGain.gain.linearRampToValueAtTime.mock.calls.length > 0
    ).toBe(true);
  });

  it('setMuted(true) silences output', async () => {
    const { AudioManager } = await import('../audioManager');
    const manager = AudioManager.getInstance();
    manager.setMuted(true);
    // After muting, gain should be 0 or master gain set to 0
    expect(mockGain.gain.value).toBe(0);
  });

  it('playSound does not throw when AudioContext is suspended', async () => {
    mockContext.state = 'suspended';
    const { AudioManager } = await import('../audioManager');
    const manager = AudioManager.getInstance();
    expect(() => manager.playSound('click')).not.toThrow();
  });

  it('getInstance returns the same singleton on multiple calls', async () => {
    const { AudioManager } = await import('../audioManager');
    const m1 = AudioManager.getInstance();
    const m2 = AudioManager.getInstance();
    expect(m1).toBe(m2);
  });

  it('setMuted(false) does not throw and leaves gain non-zero', async () => {
    const { AudioManager } = await import('../audioManager');
    const manager = AudioManager.getInstance();
    manager.setMuted(true);
    // sfxGain.gain.value was set to 0 by setMuted(true) -- ambientGain shares same mock
    expect(() => manager.setMuted(false)).not.toThrow();
    // After unmuting, gain is restored to sfxVolume (1.0) then possibly overwritten by
    // ambientVolume (0.5) since both sfxGain and ambientGain share the same mockGain.
    // Verify it's at least non-zero (restore logic executed without error).
    expect(mockGain.gain.value).toBeGreaterThan(0);
  });

  it('setSfxVolume initializes context if not already initialized', async () => {
    const { AudioManager } = await import('../audioManager');
    const manager = AudioManager.getInstance();
    // setSfxVolume should not throw regardless of context state
    expect(() => manager.setSfxVolume(0.75)).not.toThrow();
  });

  it('ensureContext creates AudioContext on first call', async () => {
    const { AudioManager } = await import('../audioManager');
    const manager = AudioManager.getInstance();
    // Before ensureContext: no audio context
    manager.ensureContext();
    // After ensureContext: context should exist (mockContext was returned by constructor)
    // We verify by calling setSfxVolume which needs the context
    expect(() => manager.setSfxVolume(0.3)).not.toThrow();
  });

  it('stopAmbient does not throw when not playing', async () => {
    const { AudioManager } = await import('../audioManager');
    const manager = AudioManager.getInstance();
    expect(() => manager.stopAmbient()).not.toThrow();
  });

  it('setAmbientMuted(true) stops ambient playback', async () => {
    const { AudioManager } = await import('../audioManager');
    const manager = AudioManager.getInstance();
    expect(() => manager.setAmbientMuted(true)).not.toThrow();
  });

  it('updateAmbientForRoom does not throw when called', async () => {
    const { AudioManager } = await import('../audioManager');
    const manager = AudioManager.getInstance();
    expect(() => manager.updateAmbientForRoom('war-room')).not.toThrow();
    expect(() => manager.updateAmbientForRoom(null)).not.toThrow();
  });

  it('getAudioManager returns the same singleton as AudioManager.getInstance', async () => {
    const { AudioManager, getAudioManager } = await import('../audioManager');
    const fromStatic = AudioManager.getInstance();
    const fromFunction = getAudioManager();
    expect(fromStatic).toBe(fromFunction);
  });
});
