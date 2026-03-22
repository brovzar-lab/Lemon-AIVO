/**
 * Editor state store — Zustand store for the layout editor.
 *
 * Controls edit mode toggle, active tool selection, furniture catalog state,
 * undo/redo stacks, and grid dimensions. The game loop reads `editorMode`
 * to freeze characters and route input differently.
 */
import { create } from 'zustand';
import type { FurnitureItem } from '@/engine/officeLayout';

// ── Tool Types ──────────────────────────────────────────────────────────────

export type EditorTool =
  | 'select'
  | 'wall'
  | 'floor'
  | 'door'
  | 'furniture'
  | 'eraser'
  | 'eyedropper'
  | 'room-template'
  | 'grid-resize';

// ── Editor Action (Command pattern for undo/redo) ───────────────────────────

export interface EditorAction {
  apply(): void;
  revert(): void;
  description: string;
}

// ── Store Interface ─────────────────────────────────────────────────────────

export interface EditorState {
  // Mode
  editorMode: boolean;

  // Active tool
  activeTool: EditorTool;

  // Floor/wall style selection
  selectedFloorStyle: string;
  selectedWallStyle: string;

  // Furniture placement
  selectedFurnitureId: string | null;
  furnitureCategory: string | null;

  // Undo/Redo stacks (max 50)
  undoStack: EditorAction[];
  redoStack: EditorAction[];

  // Grid dimensions
  gridDimensions: { cols: number; rows: number };

  // Selected furniture item on canvas (for move/delete)
  selectedCanvasFurnitureIdx: number | null;

  // Furniture placement type/size/atlasKey (persists across tool switches)
  selectedFurnitureType: FurnitureItem['type'];
  selectedFurnitureSize: { width: number; height: number };
  selectedFurnitureAtlasKey: string;

  // Room template tool state
  selectedRoomTemplate: string | null;  // template id armed for stamping, null = none selected
  ghostPreviewTile: { col: number; row: number } | null;  // top-left tile for ghost preview

  // Actions
  toggleEditorMode: () => void;
  setEditorMode: (mode: boolean) => void;
  setActiveTool: (tool: EditorTool) => void;
  pushAction: (action: EditorAction) => void;
  undo: () => void;
  redo: () => void;
  setSelectedFloorStyle: (style: string) => void;
  setSelectedWallStyle: (style: string) => void;
  setSelectedFurniture: (id: string | null) => void;
  setFurnitureCategory: (cat: string | null) => void;
  setGridDimensions: (cols: number, rows: number) => void;
  setSelectedCanvasFurniture: (idx: number | null) => void;
  clearUndoHistory: () => void;
  setSelectedFurnitureType: (type: FurnitureItem['type']) => void;
  setSelectedFurnitureSize: (width: number, height: number) => void;
  setSelectedFurnitureAtlasKey: (key: string) => void;
  setSelectedRoomTemplate: (id: string | null) => void;
  setGhostPreviewTile: (tile: { col: number; row: number } | null) => void;
}

const MAX_UNDO = 50;

export const useEditorStore = create<EditorState>((set, get) => ({
  editorMode: false,
  activeTool: 'select',
  selectedFloorStyle: 'floor-office',
  selectedWallStyle: 'wall-front',
  selectedFurnitureId: null,
  furnitureCategory: null,
  undoStack: [],
  redoStack: [],
  gridDimensions: { cols: 42, rows: 36 },
  selectedCanvasFurnitureIdx: null,

  selectedFurnitureType: 'desk',
  selectedFurnitureSize: { width: 1, height: 1 },
  selectedFurnitureAtlasKey: '',

  selectedRoomTemplate: null,
  ghostPreviewTile: null,

  toggleEditorMode: () =>
    set((s) => ({
      editorMode: !s.editorMode,
      // Reset tool state when toggling
      activeTool: 'select',
      selectedFurnitureId: null,
      furnitureCategory: null,
      selectedCanvasFurnitureIdx: null,
    })),

  setEditorMode: (mode) =>
    set({
      editorMode: mode,
      activeTool: 'select',
      selectedFurnitureId: null,
      furnitureCategory: null,
      selectedCanvasFurnitureIdx: null,
    }),

  setActiveTool: (tool) =>
    set({
      activeTool: tool,
      // Close furniture dropdown when switching away
      furnitureCategory: tool === 'furniture' ? get().furnitureCategory : null,
      selectedCanvasFurnitureIdx: tool === 'select' ? get().selectedCanvasFurnitureIdx : null,
      selectedRoomTemplate: tool === 'room-template' ? get().selectedRoomTemplate : null,
      ghostPreviewTile: tool === 'room-template' ? get().ghostPreviewTile : null,
    }),

  pushAction: (action) =>
    set((s) => ({
      undoStack: [...s.undoStack.slice(-MAX_UNDO + 1), action],
      redoStack: [], // clear redo on new action
    })),

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1]!;
    action.revert();
    set((s) => ({
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, action],
    }));
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1]!;
    action.apply();
    set((s) => ({
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, action],
    }));
  },

  setSelectedFloorStyle: (style) => set({ selectedFloorStyle: style }),

  setSelectedWallStyle: (style) => set({ selectedWallStyle: style }),

  setSelectedFurniture: (id) => set({ selectedFurnitureId: id }),

  setFurnitureCategory: (cat) => set({ furnitureCategory: cat }),

  setGridDimensions: (cols, rows) => set({ gridDimensions: { cols, rows } }),

  setSelectedCanvasFurniture: (idx) => set({ selectedCanvasFurnitureIdx: idx }),

  clearUndoHistory: () => set({ undoStack: [], redoStack: [] }),

  setSelectedFurnitureType: (type) => set({ selectedFurnitureType: type }),
  setSelectedFurnitureSize: (width, height) => set({ selectedFurnitureSize: { width, height } }),
  setSelectedFurnitureAtlasKey: (key) => set({ selectedFurnitureAtlasKey: key }),

  setSelectedRoomTemplate: (id) => set({ selectedRoomTemplate: id, ghostPreviewTile: null }),
  setGhostPreviewTile: (tile) => set({ ghostPreviewTile: tile }),
}));
