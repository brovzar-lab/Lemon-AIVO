/**
 * Audio state store -- Zustand store for mute state (ambient + SFX toggles).
 *
 * No persistence needed -- audio state resets each session.
 * Both ambient and SFX start muted by default (browser autoplay policy).
 */
import { create } from 'zustand';

export interface AudioState {
  ambientMuted: boolean;
  sfxMuted: boolean;
  ambientVolume: number;  // 0-1, default 0.3
  sfxVolume: number;      // 0-1, default 0.5
  toggleAmbient: () => void;
  toggleSfx: () => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  ambientMuted: true,
  sfxMuted: true,
  ambientVolume: 0.3,
  sfxVolume: 0.5,

  toggleAmbient: () => set((state) => ({ ambientMuted: !state.ambientMuted })),
  toggleSfx: () => set((state) => ({ sfxMuted: !state.sfxMuted })),
}));
