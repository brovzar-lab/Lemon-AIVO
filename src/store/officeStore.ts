/**
 * Office state store -- Zustand bridge between Canvas engine and React.
 *
 * Flat store pattern matching chatStore. The game loop reads via getState()
 * (non-reactive). React components subscribe reactively for UI updates.
 *
 * IMPORTANT: Only update store on meaningful state changes (BILLY arrives
 * at room, zoom changed), NOT every frame. Per-frame data (animation frames,
 * interpolation progress) lives in Character objects managed by the engine.
 */
import { create } from 'zustand';
import { TILE_SIZE } from '@/engine/types';
import type { Camera, Character } from '@/engine/types';
import { ROOMS } from '@/engine/officeLayout';
import { createCamera } from '@/engine/camera';
import type { Room } from '@/engine/types';
import type { AgentStatus } from '@/types/agent';

export interface OfficeState {
  // Room data
  rooms: Room[];
  activeRoomId: string | null;
  targetRoomId: string | null;

  // BILLY position (tile coordinates)
  billyTileCol: number;
  billyTileRow: number;

  // Camera (managed by engine, exposed for React overlays)
  camera: Camera;

  // Zoom level: 1 = overview, 2 = follow
  zoomLevel: number;

  // Characters (engine manages movement/animation, store is source of truth)
  characters: Character[];

  // Per-agent status tracking (idle/thinking/needs-attention)
  agentStatuses: Record<string, AgentStatus>;

  // Actions (only called on meaningful state changes, NOT every frame)
  setActiveRoom: (roomId: string | null) => void;
  setTargetRoom: (roomId: string | null) => void;
  setBillyPosition: (col: number, row: number) => void;
  setZoomLevel: (level: number) => void;
  setAgentStatus: (agentId: string, status: AgentStatus) => void;
  initializeCharacters: () => void;
}

const billyRoom = ROOMS.find((r) => r.id === 'billy')!;

export const useOfficeStore = create<OfficeState>((set) => ({
  // Initialize rooms from layout
  rooms: ROOMS,
  activeRoomId: 'billy',
  targetRoomId: null,

  // BILLY starts at his office seat
  billyTileCol: billyRoom.seatTile.col,
  billyTileRow: billyRoom.seatTile.row,

  // Camera defaults
  camera: createCamera(),
  zoomLevel: 2,

  // Characters initialized empty, populated via initializeCharacters()
  characters: [],

  // All 5 agents start idle
  agentStatuses: {
    patrik: 'idle',
    marcos: 'idle',
    sandra: 'idle',
    isaac: 'idle',
    wendy: 'idle',
    charlie: 'idle',
  },

  // Actions
  setActiveRoom: (roomId) => set({ activeRoomId: roomId }),

  setTargetRoom: (roomId) => set({ targetRoomId: roomId }),

  setBillyPosition: (col, row) =>
    set({ billyTileCol: col, billyTileRow: row }),

  setZoomLevel: (level) =>
    set((state) => ({
      zoomLevel: level,
      camera: { ...state.camera, zoom: level },
    })),

  setAgentStatus: (agentId, status) =>
    set((state) => ({
      agentStatuses: { ...state.agentStatuses, [agentId]: status },
    })),

  initializeCharacters: () =>
    set(() => {
      const chars: Character[] = [];

      // BILLY at his seat
      chars.push(
        createCharacter(
          'billy',
          billyRoom.seatTile.col,
          billyRoom.seatTile.row,
        ),
      );

      // 5 agents at their respective seats
      const agentIds = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy', 'charlie'];
      for (const agentId of agentIds) {
        const room = ROOMS.find((r) => r.id === agentId);
        if (room) {
          chars.push(
            createCharacter(agentId, room.seatTile.col, room.seatTile.row),
          );
        }
      }

      return { characters: chars };
    }),
}));

function createCharacter(
  id: string,
  tileCol: number,
  tileRow: number,
): Character {
  return {
    id,
    x: tileCol * TILE_SIZE,
    y: tileRow * TILE_SIZE,
    tileCol,
    tileRow,
    state: 'idle',
    direction: 'down',
    frame: 0,
    frameTimer: 0,
    path: [],
    moveProgress: 0,
    speed: 0,
  };
}
