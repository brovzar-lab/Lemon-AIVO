/**
 * Layout editor toolbar — horizontal bar overlaid on the canvas in edit mode.
 *
 * Slate + Electric Blue palette, distinct from the main amber/gold theme.
 * Shows tools, undo/redo, grid size, save/done buttons.
 */
import { useRef, useEffect, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import type { EditorTool } from '@/store/editorStore';
import { saveLayoutToIDB, downloadLayoutJSON } from '@/engine/layoutSerializer';
import { resizeGridEdge } from '@/engine/officeLayout';
import type { FurnitureItem } from '@/engine/officeLayout';
import { LIMEZU_ATLAS } from '@/engine/limeZuAtlas';
import { getEnvironmentSheetById, onSheetLoaded } from '@/engine/spriteSheet';
import {
  FURNITURE_48_BY_THEME,
  FURNITURE_48_THEMES,
  FURNITURE_48_THEME_LABELS,
  FURNITURE_48_CATALOG,
  type Furniture48Entry,
} from '@/engine/furniture48Catalog';
import {
  FURNITURE_DEFS,
  FURNITURE_DEFS_BY_CATEGORY,
  FURNITURE_CATEGORIES_ORDERED,
  type FurnitureDef,
} from '@/engine/furnitureDefs';

// O(1) lookup: atlas key → full catalog entry (src URL etc.)
const CATALOG_BY_KEY = new Map<string, Furniture48Entry>(
  FURNITURE_48_CATALOG.map((e) => [e.key, e])
);
// O(1) lookup: atlasKey48 → FurnitureDef
const DEF_BY_KEY48 = new Map<string, FurnitureDef>(
  FURNITURE_DEFS.map((d) => [d.atlasKey48, d])
);
import { ROOM_TEMPLATES, deleteSelectedFurniture, rotateSelectedFurniture } from '@/engine/editorInput';
import type { RoomTemplate } from '@/engine/editorInput';

// ── Color palette ───────────────────────────────────────────────────────────

const COLORS = {
  bg: '#151a24',
  accent: '#3b82f6',
  accentDim: 'rgba(59,130,246,0.25)',
  border: 'rgba(59,130,246,0.33)',
  statusBg: '#0c0f14',
  statusText: 'rgba(59,130,246,0.4)',
} as const;

// ── Tool definitions ────────────────────────────────────────────────────────

interface ToolDef {
  id: EditorTool;
  icon: string;
  label: string;
  shortcut: string;
  group: 'primary' | 'advanced';
}

const TOOLS: ToolDef[] = [
  { id: 'select',        icon: '🖱', label: 'Select',        shortcut: 'V', group: 'primary' },
  { id: 'wall',          icon: '🧱', label: 'Wall',          shortcut: 'W', group: 'primary' },
  { id: 'floor',         icon: '🟫', label: 'Floor',         shortcut: 'F', group: 'primary' },
  { id: 'door',          icon: '🚪', label: 'Door',          shortcut: 'D', group: 'primary' },
  { id: 'furniture',     icon: '🪑', label: 'Furniture',     shortcut: '⎵', group: 'primary' },
  { id: 'eraser',        icon: '🗑', label: 'Eraser',        shortcut: 'E', group: 'primary' },
  { id: 'eyedropper',    icon: '💧', label: 'Eyedropper',    shortcut: 'I', group: 'advanced' },
  { id: 'room-template', icon: '📋', label: 'Room Template', shortcut: 'R', group: 'advanced' },
  { id: 'grid-resize',   icon: '📐', label: 'Resize Grid',  shortcut: 'G', group: 'advanced' },
];

// ── Floor Styles ────────────────────────────────────────────────────────────

interface TileStyleItem {
  id: string;
  label: string;
}

const FLOOR_STYLES: TileStyleItem[] = [
  // Band 0 — Neutral/warm
  { id: 'floor-b0-white', label: 'White' },
  { id: 'floor-b0-cream', label: 'Cream' },
  { id: 'floor-b0-yellow', label: 'Yellow' },
  { id: 'floor-b0-gold', label: 'Gold' },
  { id: 'floor-b0-brown', label: 'Brown' },
  { id: 'floor-b0-tan', label: 'Tan' },
  { id: 'floor-b0-sand', label: 'Sand' },
  { id: 'floor-b0-grey', label: 'Grey' },
  { id: 'floor-b0-slate', label: 'Slate' },
  { id: 'floor-b0-wood', label: 'Wood' },
  { id: 'floor-b0-dark-wood', label: 'Dark Wood' },
  { id: 'floor-b0-plank', label: 'Plank' },
  // Band 1 — Patterns
  { id: 'floor-b1-white', label: 'White Tile' },
  { id: 'floor-b1-cream', label: 'Cream Tile' },
  { id: 'floor-b1-pattern', label: 'Pattern' },
  { id: 'floor-b1-checker', label: 'Checker' },
  { id: 'floor-b1-brown', label: 'Brown Tile' },
  { id: 'floor-b1-brick', label: 'Brick' },
  { id: 'floor-b1-herring', label: 'Herringbone' },
  { id: 'floor-b1-stone', label: 'Stone' },
  { id: 'floor-b1-tile', label: 'Tile' },
  { id: 'floor-b1-wood', label: 'Wood Tile' },
  { id: 'floor-b1-dark', label: 'Dark Tile' },
  { id: 'floor-b1-parquet', label: 'Parquet' },
  // Band 2 — Red/warm
  { id: 'floor-b2-pink', label: 'Pink' },
  { id: 'floor-b2-rose', label: 'Rose' },
  { id: 'floor-b2-red', label: 'Red' },
  { id: 'floor-b2-orange', label: 'Orange' },
  { id: 'floor-b2-terra', label: 'Terracotta' },
  { id: 'floor-b2-clay', label: 'Clay' },
  { id: 'floor-b2-mosaic', label: 'Mosaic' },
  { id: 'floor-b2-blue-tile', label: 'Blue Tile' },
  { id: 'floor-b2-diamond', label: 'Diamond' },
  { id: 'floor-b2-marble', label: 'Marble' },
  { id: 'floor-b2-granite', label: 'Granite' },
  { id: 'floor-b2-concrete', label: 'Concrete' },
  // Band 3 — Grey/dark
  { id: 'floor-b3-grey', label: 'Light Grey' },
  { id: 'floor-b3-steel', label: 'Steel' },
  { id: 'floor-b3-silver', label: 'Silver' },
  { id: 'floor-b3-dark-grey', label: 'Dark Grey' },
  { id: 'floor-b3-charcoal', label: 'Charcoal' },
  { id: 'floor-b3-cement', label: 'Cement' },
  { id: 'floor-b3-grid', label: 'Grid' },
  { id: 'floor-b3-checker', label: 'Grey Check' },
  { id: 'floor-b3-tile', label: 'Grey Tile' },
  { id: 'floor-b3-dark-tile', label: 'Dark Tile' },
  { id: 'floor-b3-cobble', label: 'Cobble' },
  { id: 'floor-b3-industrial', label: 'Industrial' },
  // Band 4 — Cool/green/blue
  { id: 'floor-b4-teal', label: 'Teal' },
  { id: 'floor-b4-seafoam', label: 'Seafoam' },
  { id: 'floor-b4-green', label: 'Green' },
  { id: 'floor-b4-olive', label: 'Olive' },
  { id: 'floor-b4-wood-green', label: 'Green Wood' },
  { id: 'floor-b4-aqua', label: 'Aqua' },
  { id: 'floor-b4-sky-tile', label: 'Sky Tile' },
  { id: 'floor-b4-blue', label: 'Blue' },
  { id: 'floor-b4-white-tile', label: 'White Tile' },
  { id: 'floor-b4-light-blue', label: 'Light Blue' },
  { id: 'floor-b4-pastel', label: 'Pastel' },
  { id: 'floor-b4-mint', label: 'Mint' },
  // Existing named
  { id: 'floor-office', label: 'Office' },
  { id: 'floor-warroom', label: 'War Room' },
  { id: 'floor-hallway', label: 'Hallway' },
  { id: 'floor-rec', label: 'Break Room' },
];

// ── Wall Styles ─────────────────────────────────────────────────────────────

const WALL_STYLES: TileStyleItem[] = [
  // Solid fills
  { id: 'wall-white', label: 'White' },
  { id: 'wall-cream', label: 'Cream' },
  { id: 'wall-beige', label: 'Beige' },
  { id: 'wall-yellow', label: 'Yellow' },
  { id: 'wall-brown', label: 'Brown' },
  { id: 'wall-dark-brown', label: 'Dark Brown' },
  { id: 'wall-grey', label: 'Grey' },
  { id: 'wall-dark-grey', label: 'Dark Grey' },
  // Brick
  { id: 'wall-white-brick', label: 'White Brick' },
  { id: 'wall-cream-brick', label: 'Cream Brick' },
  { id: 'wall-beige-brick', label: 'Beige Brick' },
  { id: 'wall-yellow-brick', label: 'Yellow Brick' },
  { id: 'wall-brown-brick', label: 'Brown Brick' },
  { id: 'wall-dark-brown-brick', label: 'Dk Brown Brick' },
  { id: 'wall-grey-brick', label: 'Grey Brick' },
  { id: 'wall-dark-grey-brick', label: 'Dk Grey Brick' },
  // Panel
  { id: 'wall-white-panel', label: 'White Panel' },
  { id: 'wall-cream-panel', label: 'Cream Panel' },
  { id: 'wall-beige-panel', label: 'Beige Panel' },
  { id: 'wall-yellow-panel', label: 'Yellow Panel' },
  { id: 'wall-brown-panel', label: 'Brown Panel' },
  { id: 'wall-dark-brown-panel', label: 'Dk Brown Panel' },
  { id: 'wall-grey-panel', label: 'Grey Panel' },
  { id: 'wall-dark-grey-panel', label: 'Dk Grey Panel' },
  // Alt style
  { id: 'wall-white-alt', label: 'White Alt' },
  { id: 'wall-cream-alt', label: 'Cream Alt' },
  { id: 'wall-beige-alt', label: 'Beige Alt' },
  { id: 'wall-yellow-alt', label: 'Yellow Alt' },
  { id: 'wall-brown-alt', label: 'Brown Alt' },
  { id: 'wall-dark-brown-alt', label: 'Dk Brown Alt' },
  { id: 'wall-grey-alt', label: 'Grey Alt' },
  { id: 'wall-dark-grey-alt', label: 'Dk Grey Alt' },
];

// ── Component ───────────────────────────────────────────────────────────────

export function EditorToolbar() {
  const editorMode = useEditorStore((s) => s.editorMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const gridDimensions = useEditorStore((s) => s.gridDimensions);
  const setEditorMode = useEditorStore((s) => s.setEditorMode);
  const selectedFurnitureId = useEditorStore((s) => s.selectedFurnitureId);
  const setSelectedFurniture = useEditorStore((s) => s.setSelectedFurniture);

  const setGridDimensions = useEditorStore((s) => s.setGridDimensions);

  const selectedFurnitureType = useEditorStore((s) => s.selectedFurnitureType);
  const selectedFurnitureSize = useEditorStore((s) => s.selectedFurnitureSize);
  const selectedFurnitureAtlasKey = useEditorStore((s) => s.selectedFurnitureAtlasKey);
  const setSelectedFurnitureType = useEditorStore((s) => s.setSelectedFurnitureType);
  const setSelectedFurnitureSize = useEditorStore((s) => s.setSelectedFurnitureSize);
  const setSelectedFurnitureAtlasKey = useEditorStore((s) => s.setSelectedFurnitureAtlasKey);

  const selectedFloorStyle = useEditorStore((s) => s.selectedFloorStyle);
  const setSelectedFloorStyle = useEditorStore((s) => s.setSelectedFloorStyle);
  const selectedWallStyle = useEditorStore((s) => s.selectedWallStyle);
  const setSelectedWallStyle = useEditorStore((s) => s.setSelectedWallStyle);
  const selectedRoomTemplate = useEditorStore((s) => s.selectedRoomTemplate);
  const setSelectedRoomTemplate = useEditorStore((s) => s.setSelectedRoomTemplate);
  const selectedCanvasFurnitureIdx = useEditorStore((s) => s.selectedCanvasFurnitureIdx);

  const [savedFlash, setSavedFlash] = useState(false);
  const [furnitureBrowserTab, setFurnitureBrowserTab] = useState<'catalog' | 'singles'>('catalog');

  function handleSave() {
    void saveLayoutToIDB();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  if (!editorMode) return null;

  const showFurnitureDropdown = activeTool === 'furniture';
  const showFurnitureSizePicker = activeTool === 'furniture';
  const showGridResize = activeTool === 'grid-resize';
  const showFloorPicker = activeTool === 'floor';
  const showWallPicker = activeTool === 'wall';
  const showRoomTemplate = activeTool === 'room-template';

  const primaryTools = TOOLS.filter((t) => t.group === 'primary');
  const advancedTools = TOOLS.filter((t) => t.group === 'advanced');

  return (
    <div data-testid="editor-toolbar" style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative' }}>
      {/* Main toolbar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px',
          height: 52,
          background: `linear-gradient(180deg, ${COLORS.bg} 0%, #0f1319 100%)`,
          borderBottom: `2px solid ${COLORS.accent}`,
          fontFamily: 'monospace',
          fontSize: 11,
        }}
      >
        {/* Edit mode badge */}
        <div
          style={{ padding: '4px 10px', borderRadius: 4, fontWeight: 700, letterSpacing: 1, marginRight: 6, background: COLORS.accent, color: '#fff', fontSize: 9 }}
        >
          ✏️ EDIT MODE
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 28, background: COLORS.border }} />

        {/* Primary tools */}
        {primaryTools.map((tool) => (
          <ToolButton
            key={tool.id}
            tool={tool}
            isActive={activeTool === tool.id}
            onClick={() => setActiveTool(tool.id)}
          />
        ))}

        {/* Separator */}
        <div style={{ width: 1, height: 28, background: COLORS.border }} />

        {/* Advanced tools */}
        {advancedTools.map((tool) => (
          <ToolButton
            key={tool.id}
            tool={tool}
            isActive={activeTool === tool.id}
            onClick={() => setActiveTool(tool.id)}
          />
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Grid size */}
        <span style={{ color: 'rgba(59,130,246,0.5)', fontSize: 9, marginRight: 8 }}>
          {gridDimensions.cols}×{gridDimensions.rows}
        </span>

        {/* Undo/Redo */}
        <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            style={{
              padding: '6px 10px', borderRadius: 4, border: 'none', fontFamily: 'monospace',
              transition: 'color 0.15s, background 0.15s',
              background: undoStack.length > 0 ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)',
              color: undoStack.length > 0 ? COLORS.accent : 'rgba(59,130,246,0.3)',
              fontSize: 10,
              cursor: undoStack.length > 0 ? 'pointer' : 'not-allowed',
            }}
            title="Undo (Ctrl+Z)"
          >
            ↩ Undo
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            style={{
              padding: '6px 10px', borderRadius: 4, border: 'none', fontFamily: 'monospace',
              transition: 'color 0.15s, background 0.15s',
              background: redoStack.length > 0 ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)',
              color: redoStack.length > 0 ? COLORS.accent : 'rgba(59,130,246,0.3)',
              fontSize: 10,
              cursor: redoStack.length > 0 ? 'pointer' : 'not-allowed',
            }}
            title="Redo (Ctrl+Y)"
          >
            ↪ Redo
          </button>
        </div>

        {/* Save / Done */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleSave}
            style={{
              padding: '6px 10px', borderRadius: 4, border: 'none', fontFamily: 'monospace',
              transition: 'color 0.15s, background 0.15s', cursor: 'pointer',
              background: savedFlash ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)',
              color: savedFlash ? '#22c55e' : COLORS.accent,
              fontSize: 10,
            }}
            title="Save layout (Ctrl+S)"
          >
            {savedFlash ? '✓ Saved' : '💾 Save'}
          </button>
          <button
            onClick={downloadLayoutJSON}
            style={{
              padding: '6px 10px', borderRadius: 4, border: 'none', fontFamily: 'monospace',
              transition: 'color 0.15s, background 0.15s', cursor: 'pointer',
              background: 'rgba(59,130,246,0.2)',
              color: COLORS.accent,
              fontSize: 10,
            }}
            title="Export layout as JSON"
          >
            📥 Export
          </button>
          <button
            onClick={() => {
              void saveLayoutToIDB();
              setEditorMode(false);
            }}
            style={{
              padding: '6px 10px', borderRadius: 4, border: 'none', fontFamily: 'monospace',
              fontWeight: 700, transition: 'background 0.15s', cursor: 'pointer',
              background: COLORS.accent,
              color: '#fff',
              fontSize: 10,
            }}
            title="Save and exit editor (Esc)"
          >
            ✓ Done
          </button>
        </div>
      </div>

      {/* Furniture browser dropdown */}
      {showFurnitureDropdown && (
        <div
          style={{
            display: 'flex', flexDirection: 'column',
            background: `${COLORS.bg}ee`,
            borderBottom: `1px solid ${COLORS.border}`,
            fontFamily: 'monospace',
            maxHeight: 280,
          }}
        >
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 0, padding: '8px 12px 4px' }}>
            {(['catalog', 'singles'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFurnitureBrowserTab(tab)}
                style={{
                  padding: '2px 10px',
                  fontSize: 9,
                  background: furnitureBrowserTab === tab ? COLORS.accent : 'rgba(59,130,246,0.15)',
                  color: furnitureBrowserTab === tab ? '#fff' : COLORS.accent,
                  fontWeight: furnitureBrowserTab === tab ? 'bold' : 'normal',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: tab === 'catalog' ? '4px 0 0 4px' : '0 4px 4px 0',
                  cursor: 'pointer',
                }}
              >
                {tab === 'catalog' ? '🏢 Office Catalog' : '📦 All Sprites'}
              </button>
            ))}
          </div>

          {furnitureBrowserTab === 'catalog' && (
            <FurnitureCatalogBrowser
              selectedKey={selectedFurnitureId}
              onSelect={(def) => {
                // Use the 16px atlasKey for placement rendering, not the 48px thumbnail key
                setSelectedFurniture(def.atlasKey);
                setSelectedFurnitureAtlasKey(def.atlasKey);
                setSelectedFurnitureSize(def.defaultW, def.defaultH);
                // Auto-set type from category
                const typeMap: Record<string, string> = {
                  'Desks': 'desk', 'Chairs & Seating': 'chair', 'Tables': 'table',
                  'Plants': 'plant', 'Storage': 'bookshelf', 'Tech & Screens': 'monitor',
                  'Boards & Signs': 'whiteboard', 'Decor': 'desk', 'Film Studio': 'desk',
                };
                const mappedType = typeMap[def.category] ?? 'desk';
                setSelectedFurnitureType(mappedType as FurnitureItem['type']);
              }}
            />
          )}

          {furnitureBrowserTab === 'singles' && (
            <Furniture48Browser
              selectedKey={selectedFurnitureId}
              onSelect={(key) => {
                setSelectedFurniture(key);
                setSelectedFurnitureAtlasKey(key);
                setSelectedFurnitureSize(3, 3);
              }}
            />
          )}
        </div>
      )}

      {/* Floor style picker */}
      {showFloorPicker && (
        <TileStylePicker
          title="FLOOR STYLE"
          items={FLOOR_STYLES}
          selectedId={selectedFloorStyle}
          onSelect={setSelectedFloorStyle}
        />
      )}

      {/* Wall style picker */}
      {showWallPicker && (
        <TileStylePicker
          title="WALL STYLE"
          items={WALL_STYLES}
          selectedId={selectedWallStyle}
          onSelect={setSelectedWallStyle}
        />
      )}

      {/* Grid resize dialog */}
      {showGridResize && (
        <GridResizePanel
          gridDimensions={gridDimensions}
          setGridDimensions={setGridDimensions}
        />
      )}

      {/* Room Template palette */}
      {showRoomTemplate && (
        <RoomTemplatePanel
          selectedRoomTemplate={selectedRoomTemplate}
          onSelectTemplate={setSelectedRoomTemplate}
        />
      )}

      {/* Furniture size/type picker */}
      {showFurnitureSizePicker && (
        <FurnitureSizePanel
          selectedType={selectedFurnitureType}
          selectedSize={selectedFurnitureSize}
          atlasKey={selectedFurnitureAtlasKey}
          onTypeChange={setSelectedFurnitureType}
          onSizeChange={setSelectedFurnitureSize}
          onAtlasKeyChange={setSelectedFurnitureAtlasKey}
          hasSelection={selectedFurnitureId !== null}
        />
      )}

      {/* Status bar */}
      <EditorStatusBar
        activeTool={activeTool}
        undoCount={undoStack.length}
        redoCount={redoStack.length}
        selectedCanvasFurnitureIdx={selectedCanvasFurnitureIdx}
      />
    </div>
  );
}

// ── Tool Button ─────────────────────────────────────────────────────────────

function ToolButton({
  tool,
  isActive,
  onClick,
}: {
  tool: ToolDef;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, transition: 'all 0.15s',
        width: tool.id === 'furniture' ? 44 : 36,
        height: 36,
        background: isActive ? COLORS.accent : COLORS.accentDim,
        border: isActive ? 'none' : `1px solid ${COLORS.border}`,
        boxShadow: isActive ? `0 0 10px rgba(59,130,246,0.27)` : 'none',
        fontSize: 16,
        cursor: 'pointer',
      }}
      title={`${tool.label} (${tool.shortcut})`}
    >
      {tool.icon}
      {tool.id === 'furniture' && (
        <span style={{ fontSize: 8, color: COLORS.accent, marginLeft: 2 }}>▼</span>
      )}
    </button>
  );
}

// ── Sprite Preview ──────────────────────────────────────────────────────────

/** Renders a sprite frame from the atlas onto a small canvas. */
// ── Furniture 48×48 Browser ─────────────────────────────────────────────────

// ── Office Catalog Browser ───────────────────────────────────────────────────

function FurnitureCatalogBrowser({
  selectedKey,
  onSelect,
}: {
  selectedKey: string | null;
  onSelect: (def: FurnitureDef) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>(FURNITURE_CATEGORIES_ORDERED[0] ?? '');
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const items = FURNITURE_DEFS_BY_CATEGORY[activeCategory] ?? [];
  const hoveredDef = hoveredKey ? DEF_BY_KEY48.get(hoveredKey) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      {/* Category tabs — single scrollable row */}
      <div style={{ display: 'flex', gap: 3, padding: '4px 12px', overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'thin' }}>
        {FURNITURE_CATEGORIES_ORDERED.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '2px 8px',
              fontSize: 9,
              background: activeCategory === cat ? COLORS.accent : 'rgba(59,130,246,0.12)',
              color: activeCategory === cat ? '#fff' : COLORS.accent,
              border: `1px solid ${activeCategory === cat ? COLORS.accent : COLORS.border}`,
              borderRadius: 3,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Hover info bar */}
      <div style={{ padding: '2px 14px', minHeight: 18, fontSize: 9, color: '#93c5fd', flexShrink: 0 }}>
        {hoveredDef ? (
          <span>
            <strong>{hoveredDef.name}</strong>
            {hoveredDef.description ? ` — ${hoveredDef.description}` : ''}
            {' '}
            <span style={{ color: '#666' }}>({hoveredDef.defaultW}×{hoveredDef.defaultH} tiles)</span>
          </span>
        ) : (
          <span style={{ color: '#444' }}>Hover a sprite to see details</span>
        )}
      </div>

      {/* Sprite grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
          gap: 4,
          padding: '4px 12px 8px',
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {items.map((def) => {
          const isSelected = selectedKey === def.atlasKey48;
          return (
            <button
              key={def.atlasKey48}
              onClick={() => onSelect(def)}
              onMouseEnter={() => setHoveredKey(def.atlasKey48)}
              onMouseLeave={() => setHoveredKey(null)}
              title={`${def.name}${def.description ? '\n' + def.description : ''}\n${def.defaultW}×${def.defaultH} tiles`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 2,
                padding: 4,
                background: isSelected ? 'rgba(59,130,246,0.35)' : 'rgba(59,130,246,0.06)',
                border: isSelected ? `2px solid ${COLORS.accent}` : '1px solid rgba(59,130,246,0.15)',
                borderRadius: 4,
                cursor: 'pointer',
                minHeight: 72,
              }}
            >
              <SpritePreview atlasKey={def.atlasKey48} size={52} />
              <span
                style={{
                  fontSize: 7,
                  color: isSelected ? '#93c5fd' : '#888',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {def.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Default to Generic (Office) which is first in FURNITURE_48_THEMES
const DEFAULT_THEME = FURNITURE_48_THEMES[0] ?? '';

function Furniture48Browser({
  selectedKey,
  onSelect,
}: {
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const [activeTheme, setActiveTheme] = useState<string>(DEFAULT_THEME);
  const themeKeys = FURNITURE_48_BY_THEME[activeTheme] ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      {/* Theme pills — single horizontal scrollable row */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '4px 12px',
          overflowX: 'auto',
          flexShrink: 0,
          scrollbarWidth: 'thin',
        }}
      >
        {FURNITURE_48_THEMES.map((theme) => (
          <button
            key={theme}
            onClick={() => setActiveTheme(theme)}
            style={{
              padding: '2px 8px',
              fontSize: 9,
              background: activeTheme === theme ? COLORS.accent : 'rgba(59,130,246,0.12)',
              color: activeTheme === theme ? '#fff' : COLORS.accent,
              border: `1px solid ${activeTheme === theme ? COLORS.accent : COLORS.border}`,
              borderRadius: 3,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {FURNITURE_48_THEME_LABELS[theme] ?? theme}
          </button>
        ))}
      </div>

      {/* Sprite grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))',
          gap: 4,
          padding: '6px 12px 8px',
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {themeKeys.map((key) => {
          const entry = CATALOG_BY_KEY.get(key);
          if (!entry) return null;
          const isSelected = selectedKey === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              title={`${entry.themeLabel} #${entry.n} — ${key}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: 4,
                background: isSelected ? 'rgba(59,130,246,0.35)' : 'rgba(59,130,246,0.06)',
                border: isSelected ? `2px solid ${COLORS.accent}` : '1px solid rgba(59,130,246,0.15)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              <SpriteThumbnail entry={entry} size={44} />
              <span style={{ fontSize: 7, color: isSelected ? '#93c5fd' : '#666', lineHeight: 1 }}>
                #{entry.n}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Renders a furniture thumbnail: <img> for Singles, CSS clip for compiled-sheet cells. */
function SpriteThumbnail({ entry, size }: { entry: Furniture48Entry; size: number }) {
  if (entry.frameX !== undefined && entry.sheetW && entry.sheetH) {
    // Compiled sheet cell — clip using CSS background-image
    const scale = size / (entry.frameW ?? 48);
    return (
      <div
        style={{
          width: size,
          height: size,
          backgroundImage: `url(${entry.src})`,
          backgroundPosition: `-${entry.frameX * scale}px -${(entry.frameY ?? 0) * scale}px`,
          backgroundSize: `${entry.sheetW * scale}px ${entry.sheetH * scale}px`,
          imageRendering: 'pixelated',
          flexShrink: 0,
        }}
      />
    );
  }
  // Singles — direct <img> tag, browser loads natively
  return (
    <img
      src={entry.src}
      alt=""
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
    />
  );
}

// ── Sprite Preview ───────────────────────────────────────────────────────────

function SpritePreview({ atlasKey, size = 28 }: { atlasKey: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Increments whenever a lazy-loaded sheet arrives, triggering a redraw
  const [tick, setTick] = useState(0);

  useEffect(() => onSheetLoaded(() => setTick((t) => t + 1)), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const entry = LIMEZU_ATLAS[atlasKey];
    if (!entry) {
      ctx.fillStyle = 'rgba(59,130,246,0.2)';
      ctx.fillRect(0, 0, size, size);
      return;
    }

    const sheet = getEnvironmentSheetById(entry.sheetId);
    if (!sheet) {
      ctx.fillStyle = 'rgba(59,130,246,0.15)';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(59,130,246,0.4)';
      ctx.font = `${size * 0.4}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', size / 2, size / 2);
      return;
    }

    // Draw the sprite frame scaled to the preview size
    // w=0/h=0 = full-image sentinel (48×48 Singles)
    const { x, y, w, h } = entry.frame;
    const srcW = w === 0 ? sheet.naturalWidth  : w;
    const srcH = h === 0 ? sheet.naturalHeight : h;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(sheet, x, y, srcW, srcH, 0, 0, size, size);
  }, [atlasKey, size, tick]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size, imageRendering: 'pixelated', borderRadius: 3 }}
    />
  );
}

// ── Tile Style Picker ───────────────────────────────────────────────────────

function TileStylePicker({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  items: TileStyleItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column',
        background: `${COLORS.bg}ee`,
        borderBottom: `1px solid ${COLORS.border}`,
        fontFamily: 'monospace',
        maxHeight: 180,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 4px' }}>
        <span style={{ color: COLORS.accent, fontWeight: 'bold', fontSize: 9, letterSpacing: 1 }}>{title}</span>
        <span style={{ color: '#555', fontSize: 9 }}>({items.length} styles)</span>
      </div>
      <div
        style={{ display: 'grid', gap: 4, padding: '0 12px 8px', overflowY: 'auto', gridTemplateColumns: 'repeat(auto-fill, minmax(65px, 1fr))' }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 4, borderRadius: 4, transition: 'background 0.15s, border 0.15s', cursor: 'pointer',
              background: selectedId === item.id ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.06)',
              border: selectedId === item.id ? `2px solid ${COLORS.accent}` : '1px solid rgba(59,130,246,0.15)',
            }}
          >
            <SpritePreview atlasKey={item.id} size={24} />
            <span style={{ fontSize: 7, color: selectedId === item.id ? '#93c5fd' : '#888', textAlign: 'center', lineHeight: 1.1 }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Grid Resize Panel ───────────────────────────────────────────────────────

function GridResizePanel({
  gridDimensions,
  setGridDimensions,
}: {
  gridDimensions: { cols: number; rows: number };
  setGridDimensions: (cols: number, rows: number) => void;
}) {
  const handleResize = (edge: 'top' | 'bottom' | 'left' | 'right', amount: number) => {
    resizeGridEdge(edge, amount);
    // Recalculate dimensions from actual map
    const newRows = (window as unknown as Record<string, unknown>).__tileMapRef
      ? 0 // fallback
      : amount !== 0
        ? edge === 'top' || edge === 'bottom'
          ? gridDimensions.rows + amount
          : gridDimensions.rows
        : gridDimensions.rows;
    const newCols = edge === 'left' || edge === 'right'
      ? gridDimensions.cols + amount
      : gridDimensions.cols;
    setGridDimensions(
      Math.max(1, newCols),
      Math.max(1, newRows),
    );
  };

  const btnStyle = (color: string) => ({
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    width: 28,
    height: 28,
    fontSize: 14,
    cursor: 'pointer' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  });

  const addBtn = btnStyle('rgba(59,130,246,0.4)');
  const removeBtn = btnStyle('rgba(239,68,68,0.4)');

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
        background: `${COLORS.bg}ee`,
        borderBottom: `1px solid ${COLORS.border}`,
        fontFamily: 'monospace',
      }}
    >
      <span style={{ color: COLORS.accent, fontWeight: 'bold', fontSize: 9, letterSpacing: 1 }}>RESIZE GRID</span>

      {/* Visual directional controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {/* Top row */}
        <div style={{ display: 'flex', gap: 2 }}>
          <button onClick={() => handleResize('top', -1)} style={removeBtn} title="Remove row from top">−</button>
          <button onClick={() => handleResize('top', 1)} style={addBtn} title="Add row to top">+</button>
        </div>
        <span style={{ color: '#555', fontSize: 8 }}>TOP</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Left controls */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ display: 'flex', gap: 2 }}>
            <button onClick={() => handleResize('left', -1)} style={removeBtn} title="Remove column from left">−</button>
            <button onClick={() => handleResize('left', 1)} style={addBtn} title="Add column to left">+</button>
          </div>
          <span style={{ color: '#555', fontSize: 8 }}>LEFT</span>
        </div>

        {/* Grid preview */}
        <div
          style={{
            width: 64,
            height: 48,
            background: 'rgba(59,130,246,0.1)',
            border: `2px solid ${COLORS.accent}`,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: COLORS.accent,
            fontSize: 12,
            fontWeight: 'bold',
          }}
        >
          {gridDimensions.cols}×{gridDimensions.rows}
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ display: 'flex', gap: 2 }}>
            <button onClick={() => handleResize('right', -1)} style={removeBtn} title="Remove column from right">−</button>
            <button onClick={() => handleResize('right', 1)} style={addBtn} title="Add column to right">+</button>
          </div>
          <span style={{ color: '#555', fontSize: 8 }}>RIGHT</span>
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ color: '#555', fontSize: 8 }}>BOTTOM</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button onClick={() => handleResize('bottom', -1)} style={removeBtn} title="Remove row from bottom">−</button>
          <button onClick={() => handleResize('bottom', 1)} style={addBtn} title="Add row to bottom">+</button>
        </div>
      </div>

      <span style={{ color: '#555', fontSize: 9, marginLeft: 8 }}>Click +/− to add or remove rows/columns from any edge</span>
    </div>
  );
}

// ── Furniture Size Panel ─────────────────────────────────────────────────────

const FURNITURE_TYPES = [
  'desk', 'chair', 'table', 'bookshelf', 'plant', 'water-cooler',
  'artwork', 'couch', 'monitor', 'whiteboard', 'filing-cabinet',
] as const;

type FurnitureType = typeof FURNITURE_TYPES[number];

const SIZE_PRESETS: Array<{ w: number; h: number; label: string }> = [
  { w: 1, h: 1, label: '1×1' },
  { w: 1, h: 2, label: '1×2' },
  { w: 2, h: 1, label: '2×1' },
  { w: 2, h: 2, label: '2×2' },
  { w: 2, h: 3, label: '2×3' },
  { w: 3, h: 2, label: '3×2' },
  // 48×48 Singles defaults (48px ÷ 16px tile = 3 tiles per slot)
  { w: 3, h: 3, label: '3×3' },
  { w: 6, h: 3, label: '6×3' },
  { w: 3, h: 6, label: '3×6' },
  { w: 6, h: 6, label: '6×6' },
];

function FurnitureSizePanel({
  selectedType,
  selectedSize,
  atlasKey,
  onTypeChange,
  onSizeChange,
  onAtlasKeyChange,
  hasSelection,
}: {
  selectedType: FurnitureType;
  selectedSize: { width: number; height: number };
  atlasKey: string;
  onTypeChange: (type: FurnitureType) => void;
  onSizeChange: (w: number, h: number) => void;
  onAtlasKeyChange: (key: string) => void;
  hasSelection: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', flexWrap: 'wrap',
        background: `${COLORS.bg}ee`,
        borderBottom: `1px solid ${COLORS.border}`,
        fontFamily: 'monospace',
        fontSize: 10,
      }}
    >
      {/* Label */}
      <span style={{ color: COLORS.accent, fontWeight: 'bold', fontSize: 9, letterSpacing: 1, whiteSpace: 'nowrap' }}>
        FURNITURE
      </span>

      {/* Hint when no catalog item selected */}
      {!hasSelection && (
        <span style={{ color: 'rgba(59,130,246,0.6)', fontSize: 9, fontStyle: 'italic' }}>
          ↑ select a sprite from the catalog above to place
        </span>
      )}

      {/* Type dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'rgba(59,130,246,0.55)', fontSize: 9 }}>Type</span>
        <select
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value as FurnitureType)}
          style={{
            background: COLORS.bg,
            color: COLORS.accent,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            fontSize: 9,
            padding: '2px 4px',
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          {FURNITURE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Size presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'rgba(59,130,246,0.55)', fontSize: 9, marginRight: 2 }}>Size</span>
        {SIZE_PRESETS.map((preset) => {
          const isActive = selectedSize.width === preset.w && selectedSize.height === preset.h;
          return (
            <button
              key={preset.label}
              onClick={() => onSizeChange(preset.w, preset.h)}
              style={{
                background: isActive ? COLORS.accent : 'rgba(59,130,246,0.15)',
                color: isActive ? '#fff' : COLORS.accent,
                border: isActive ? 'none' : `1px solid ${COLORS.border}`,
                borderRadius: 4,
                fontSize: 9,
                padding: '2px 6px',
                cursor: 'pointer',
                fontWeight: isActive ? 'bold' : 'normal',
                fontFamily: 'monospace',
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Atlas key override */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'rgba(59,130,246,0.4)', fontSize: 8 }}>atlas key</span>
        <input
          type="text"
          value={atlasKey}
          onChange={(e) => onAtlasKeyChange(e.target.value)}
          placeholder="atlas key (optional)"
          style={{
            background: COLORS.bg,
            color: 'rgba(59,130,246,0.7)',
            border: `1px solid rgba(59,130,246,0.2)`,
            borderRadius: 4,
            fontSize: 8,
            padding: '2px 6px',
            width: 140,
            fontFamily: 'monospace',
          }}
        />
      </div>
    </div>
  );
}

// ── Room Template Panel ──────────────────────────────────────────────────────

function TemplateButton({
  template,
  isSelected,
  onSelect,
}: {
  template: RoomTemplate;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
}) {
  return (
    <button
      onClick={() => onSelect(isSelected ? null : template.id)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '5px 10px',
        background: isSelected ? `${COLORS.accent}33` : 'transparent',
        border: 'none',
        borderLeft: isSelected ? `2px solid ${COLORS.accent}` : '2px solid transparent',
        color: isSelected ? COLORS.accent : '#aaa',
        cursor: 'pointer',
        fontSize: 10,
        fontFamily: 'monospace',
      }}
    >
      {template.label}
      {template.kind === 'generic' && (
        <span style={{ color: '#555', fontSize: 8, marginLeft: 4 }}>tiles only</span>
      )}
    </button>
  );
}

function RoomTemplatePanel({
  selectedRoomTemplate,
  onSelectTemplate,
}: {
  selectedRoomTemplate: string | null;
  onSelectTemplate: (id: string | null) => void;
}) {
  const roomClones = ROOM_TEMPLATES.filter((t) => t.kind === 'room-clone');
  const generics = ROOM_TEMPLATES.filter((t) => t.kind === 'generic');

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 52,
        width: 180,
        background: `${COLORS.bg}f0`,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '0 0 0 6px',
        fontFamily: 'monospace',
        fontSize: 10,
        zIndex: 30,
        maxHeight: 400,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '6px 10px',
          color: COLORS.accent,
          fontWeight: 'bold',
          fontSize: 9,
          letterSpacing: 1,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        ROOM TEMPLATES
      </div>

      {/* Room Clones section */}
      <div style={{ padding: '4px 6px 2px', color: '#666', fontSize: 8, letterSpacing: 0.5 }}>
        ROOM CLONES
      </div>
      {roomClones.map((t) => (
        <TemplateButton
          key={t.id}
          template={t}
          isSelected={selectedRoomTemplate === t.id}
          onSelect={onSelectTemplate}
        />
      ))}

      {/* Generic Shapes section */}
      <div style={{ padding: '6px 6px 2px', color: '#666', fontSize: 8, letterSpacing: 0.5 }}>
        GENERIC SHAPES
      </div>
      {generics.map((t) => (
        <TemplateButton
          key={t.id}
          template={t}
          isSelected={selectedRoomTemplate === t.id}
          onSelect={onSelectTemplate}
        />
      ))}

      {/* Instruction hint */}
      {selectedRoomTemplate && (
        <div
          style={{
            padding: '6px 10px',
            color: '#555',
            fontSize: 8,
            borderTop: `1px solid ${COLORS.border}`,
          }}
        >
          Click canvas to preview, click again or Enter to stamp
        </div>
      )}
    </div>
  );
}

// ── Status Bar ──────────────────────────────────────────────────────────────

function EditorStatusBar({
  activeTool,
  undoCount,
  redoCount,
  selectedCanvasFurnitureIdx,
}: {
  activeTool: EditorTool;
  undoCount: number;
  redoCount: number;
  selectedCanvasFurnitureIdx: number | null;
}) {
  const toolLabel = TOOLS.find((t) => t.id === activeTool)?.label ?? activeTool;
  const hasSelection = selectedCanvasFurnitureIdx !== null;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8,
        height: 22,
        background: COLORS.statusBg,
        borderBottom: `1px solid rgba(59,130,246,0.13)`,
        fontFamily: 'monospace',
        fontSize: 9,
        color: COLORS.statusText,
      }}
    >
      <span>Tool: {toolLabel}</span>
      <span>|</span>
      <span>Undo: {undoCount} | Redo: {redoCount}</span>
      <span style={{ flex: 1 }} />
      {hasSelection ? (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onMouseDown={(e) => { e.preventDefault(); rotateSelectedFurniture(); }}
            style={{
              background: 'rgba(59,130,246,0.15)',
              color: '#3b82f6',
              border: '1px solid rgba(59,130,246,0.4)',
              borderRadius: 3,
              fontSize: 9,
              padding: '1px 8px',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
            title="Rotate 90° clockwise"
          >
            ↻ Rotate
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); deleteSelectedFurniture(); }}
            style={{
              background: 'rgba(239,68,68,0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 3,
              fontSize: 9,
              padding: '1px 8px',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            🗑 Delete
          </button>
        </div>
      ) : (
        <span>Right-click: Delete | V: Select | Ctrl+Z: Undo | Esc: Exit</span>
      )}
    </div>
  );
}
