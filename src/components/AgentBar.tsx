import { useRef } from 'react';
import { useOfficeStore } from '@/store/officeStore';
import { useEditorStore } from '@/store/editorStore';
import { getAgent } from '@/config/agents';
import { convertRPGMakerMap, isRPGMakerMap, exportToRPGMakerMap } from '@/engine/rpgmakerImport';
import { importLayoutJSON, deserializeLayout } from '@/engine/layoutSerializer';
import { OFFICE_TILE_MAP, ROOMS } from '@/engine/officeLayout';
import type { AgentId, AgentStatus } from '@/types/agent';

const AGENT_IDS: AgentId[] = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy', 'charlie'];

/**
 * Horizontal agent bar — sits above the canvas in the center column.
 * Each chip shows avatar initial, name, role, and a glowing status dot.
 * Clicking a chip selects that agent's room on the canvas.
 * Center-right area has quick-access buttons: DECORATE and Furniture Composer.
 */
export function AgentBar() {
  const activeRoomId  = useOfficeStore((s) => s.activeRoomId);
  const setActiveRoom = useOfficeStore((s) => s.setActiveRoom);
  const agentStatuses = useOfficeStore((s) => s.agentStatuses);
  const editorMode    = useEditorStore((s) => s.editorMode);
  const setEditorMode = useEditorStore((s) => s.setEditorMode);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  return (
    <div data-testid="agent-bar" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: '6px 12px',
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Agent chips */}
      {AGENT_IDS.map((id) => {
        const agent = getAgent(id);
        if (!agent) return null;
        const isActive = activeRoomId === id;
        const status = (agentStatuses[id] as AgentStatus | undefined) ?? 'idle';

        return (
          <button
            key={id}
            onClick={() => setActiveRoom(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '4px 10px 4px 5px',
              background: isActive ? 'var(--bg-card-hover)' : 'var(--bg-card)',
              borderRadius: 20,
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s, transform 0.1s',
              border: isActive ? '1px solid var(--accent-teal)' : '1px solid transparent',
              flex: 1,
              minWidth: 40,
              maxWidth: 160,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
            title={`${agent.name} — ${agent.title}`}
          >
            {/* Avatar circle */}
            <span style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-pixel)',
              fontSize: 12,
              color: '#fff',
              background: agent.color,
              flexShrink: 0,
            }}>
              {agent.name[0]}
            </span>

            {/* Name + role */}
            <span style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              overflow: 'hidden',
              minWidth: 0,
            }}>
              <span style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-bright)',
                lineHeight: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {agent.name.toUpperCase()}
              </span>
              <span style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                lineHeight: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {agent.title}
              </span>
            </span>

            {/* Status dot */}
            <StatusDot status={status} />
          </button>
        );
      })}

      {/* Divider */}
      <span style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0, margin: '0 8px' }} />

      {/* DECORATE toggle */}
      <button
        onClick={() => setEditorMode(!editorMode)}
        title={editorMode ? 'Exit decorate mode' : 'Decorate office — place & arrange furniture'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 12px',
          borderRadius: 20,
          border: editorMode ? '1px solid #f59e0b' : '1px solid var(--border)',
          background: editorMode ? 'rgba(245,158,11,0.15)' : 'var(--bg-card)',
          color: editorMode ? '#f59e0b' : 'var(--text-secondary)',
          fontFamily: 'var(--font-pixel)',
          fontSize: 10,
          letterSpacing: 1,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
      >
        🛋 {editorMode ? 'DECORATING' : 'DECORATE'}
      </button>

      {/* Furniture Composer link */}
      <a
        href="/furniture-composer.html"
        target="_blank"
        rel="noopener noreferrer"
        title="Open Furniture Composer to build & assemble custom pieces"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 12px',
          borderRadius: 20,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-pixel)',
          fontSize: 10,
          letterSpacing: 1,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          textDecoration: 'none',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#a78bfa';
          e.currentTarget.style.color = '#a78bfa';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        🪑 COMPOSER
      </a>

      {/* RPG Maker / Layout import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);

            if (isRPGMakerMap(parsed)) {
              // RPG Maker MZ map → convert to LayoutData → apply
              const layout = convertRPGMakerMap(parsed);
              deserializeLayout(layout);
              alert(`✅ Imported RPG Maker map (${parsed.width}×${parsed.height})`);
            } else {
              // Native Lemon AIVO layout JSON
              const layout = importLayoutJSON(text);
              deserializeLayout(layout);
              alert('✅ Imported office layout');
            }
          } catch (err) {
            alert(`❌ Import failed: ${(err as Error).message}`);
          }
          // Reset so the same file can be re-imported
          e.target.value = '';
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        title="Import an RPG Maker MZ map or saved layout JSON"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 12px',
          borderRadius: 20,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-pixel)',
          fontSize: 10,
          letterSpacing: 1,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#34d399';
          e.currentTarget.style.color = '#34d399';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        🗺️ IMPORT MAP
      </button>

      {/* Export current layout as RPG Maker MZ map */}
      <button
        onClick={() => {
          const tileMap = OFFICE_TILE_MAP.map(row => [...row].map(t => t as number));
          const rpgMap = exportToRPGMakerMap(tileMap, ROOMS);
          const json = JSON.stringify(rpgMap, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'Map001.json';
          a.click();
          URL.revokeObjectURL(url);
        }}
        title="Export current office as RPG Maker MZ map (Map001.json)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 12px',
          borderRadius: 20,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-pixel)',
          fontSize: 10,
          letterSpacing: 1,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#60a5fa';
          e.currentTarget.style.color = '#60a5fa';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        📤 EXPORT MAP
      </button>
    </div>
  );
}

function StatusDot({ status }: { status: AgentStatus }) {
  const color =
    status === 'thinking'        ? 'var(--status-meeting)' :
    status === 'needs-attention' ? 'var(--accent-coral)'   :
    status === 'idle'            ? 'var(--status-idle)'    :
    status === 'working'         ? 'var(--status-working)' :
    'var(--text-secondary)';

  return (
    <span style={{
      width: 6,
      height: 6,
      borderRadius: '50%',
      flexShrink: 0,
      marginLeft: 2,
      background: color,
      boxShadow: color !== 'var(--text-secondary)' ? `0 0 4px ${color}` : 'none',
    }} />
  );
}
