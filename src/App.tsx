import { useEffect, useState, useCallback, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useCollaborationStore } from '@/store/collaborationStore';
import { useDealStore } from '@/store/dealStore';
import { useFileStore } from '@/store/fileStore';
import { useOfficeStore } from '@/store/officeStore';
import { migrateConversationsToDeals } from '@/services/persistence/migration';
import { purgeOldFakeData } from '@/services/persistence/clearData';
import { useActivityStore } from '@/store/activityStore';
import { setOnFileClick } from '@/engine/input';
import { setOnFilingCabinetClick, setOnDeskClick } from '@/engine/input';
import { PersonaBuilderOverlay } from '@/components/persona-builder/PersonaBuilderOverlay';
import { usePersonaBuilderStore } from '@/store/personaBuilderStore';
import { FileCabinetModal } from '@/components/files/FileCabinetModal';
import { LeftPanel } from '@/components/LeftPanel';
import { RightPanel } from '@/components/RightPanel';
import { AgentBar } from '@/components/AgentBar';
import { FileViewer } from '@/components/FileViewer';
import { OfficeCanvas } from '@/components/canvas/OfficeCanvas';
import { RoomLabel } from '@/components/canvas/RoomLabel';
import { ZoomControls } from '@/components/canvas/ZoomControls';
import { EditorToolbar } from '@/components/canvas/EditorToolbar';
import { useEditorStore } from '@/store/editorStore';
import { MigrationPrompt } from '@/components/deal/MigrationPrompt';
import type { AgentId } from '@/types/agent';
import { getAudioManager } from '@/engine/audioManager';
import { startSimulation } from '@/services/simulation';

const VALID_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx', '.xls']);
const AGENT_IDS: AgentId[] = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy', 'charlie'];

function isAgentRoom(id: string | null): id is AgentId {
  return id !== null && AGENT_IDS.includes(id as AgentId);
}

/**
 * Root application component.
 *
 * Two-column layout: LeftPanel (chat + projects, 320px left) and
 * OfficeCanvas (flex-1 right). Top bar with LEMON STUDIOS branding.
 */
function App() {
  const [ready, setReady] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [fileMgrAgent, setFileMgrAgent] = useState<AgentId | null>(null);
  const [isDeskDragOver, setIsDeskDragOver] = useState(false);
  const deskFileInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Resolve which agent to upload to: active room if it's an agent, else first agent
  const resolveUploadAgent = useCallback((): AgentId => {
    const roomId = useOfficeStore.getState().activeRoomId;
    return isAgentRoom(roomId) ? roomId : 'patrik';
  }, []);

  const uploadFiles = useCallback((files: FileList | File[]) => {
    const agentId = resolveUploadAgent();
    const fileStore = useFileStore.getState();
    const arr = Array.from(files);
    for (const file of arr) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (VALID_EXTENSIONS.has(ext)) {
        void fileStore.addFile(file, agentId);
        void getAudioManager().playSfx('paper');
        useActivityStore.getState().logActivity(agentId, `received file: ${file.name}`);
      }
    }
  }, [resolveUploadAgent]);

  const handleDeskDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDeskDragOver(true);
  }, []);

  const handleDeskDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDeskDragOver(false);
  }, []);

  const handleDeskDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDeskDragOver(false);
    if (e.dataTransfer?.files) uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const handleDeskFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
    e.target.value = '';
  }, [uploadFiles]);

  // Wire canvas file icon clicks to open the FileViewer
  const handleFileClick = useCallback((fileId: string) => {
    setSelectedFileId(fileId);
  }, []);

  useEffect(() => {
    setOnFileClick(handleFileClick);
    return () => setOnFileClick(null);
  }, [handleFileClick]);

  // Wire canvas filing cabinet clicks to open persona builder
  const handleFilingCabinetClick = useCallback((agentId: string) => {
    usePersonaBuilderStore.getState().open(agentId as AgentId);
  }, []);

  useEffect(() => {
    setOnFilingCabinetClick(handleFilingCabinetClick);
    return () => setOnFilingCabinetClick(null);
  }, [handleFilingCabinetClick]);

  // Wire canvas desk clicks to open file manager
  const handleDeskClick = useCallback((agentId: string) => {
    setFileMgrAgent(agentId as AgentId);
  }, []);

  useEffect(() => {
    setOnDeskClick(handleDeskClick);
    return () => setOnDeskClick(null);
  }, [handleDeskClick]);

  // Initialize AudioContext on first user interaction (browser autoplay policy)
  useEffect(() => {
    const handler = () => {
      getAudioManager().ensureContext();
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    };
    document.addEventListener('click', handler, { once: true });
    document.addEventListener('keydown', handler, { once: true });
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      // 1. Load deals from IndexedDB
      await useDealStore.getState().loadDeals();

      // 2. Check for legacy conversations needing migration
      const { getPersistence } = await import('@/services/persistence/adapter');
      const persistence = getPersistence();
      const allConversations = await persistence.getAll<{ id: string; dealId?: string }>('conversations');
      const hasOrphans = allConversations.some((conv) => !conv.dealId);

      if (hasOrphans) {
        // Run migration (stamps orphans with default dealId)
        await migrateConversationsToDeals();
        setNeedsMigration(true);
      }

      // 3. Ensure a default deal exists (creates "General" if no deals)
      await useDealStore.getState().ensureDefaultDeal();

      // 4. Auto-select the first active deal if none selected
      const dealState = useDealStore.getState();
      if (!dealState.activeDealId && dealState.deals.length > 0) {
        const firstActive = dealState.deals.find((d) => d.status === 'active');
        if (firstActive) {
          await dealState.switchDeal(firstActive.id);
        }
      }

      // 5. Purge old fake data (one-time, version-gated)
      try {
        await purgeOldFakeData();
      } catch (e) {
        console.warn('[init] purgeOldFakeData failed (non-fatal):', e);
      }

      // 6. Load deal-scoped conversations + collaboration history + activity log
      await Promise.all([
        useChatStore.getState().loadConversations(),
        useCollaborationStore.getState().loadActiveChain(),
        useCollaborationStore.getState().loadChainHistory(),
        useActivityStore.getState().loadActivities().catch((e: unknown) => {
          console.warn('[init] loadActivities failed (non-fatal):', e);
        }),
      ]);

      setReady(true);

      // Start office life simulation (status cycling, proactive messages)
      const stopSim = startSimulation();
      cleanupRef.current = stopSim;

      // Request persistent storage (fire-and-forget)
      if (navigator.storage?.persist) {
        navigator.storage.persist().then((granted) => {
          console.log(`Persistent storage ${granted ? 'granted' : 'denied'}`);
        });
      }
    };
    void init();
    return () => { cleanupRef.current?.(); };
  }, []);

  const handleMigrate = async (action: 'general' | 'new-deal', dealName?: string) => {
    const dealState = useDealStore.getState();

    if (action === 'new-deal' && dealName) {
      // Create a new deal and reassign orphan conversations from 'default' to it
      const newDealId = await dealState.createDeal(dealName);
      const { getPersistence } = await import('@/services/persistence/adapter');
      const persistence = getPersistence();
      const allConversations = await persistence.getAll<{ id: string; dealId?: string }>('conversations');
      const defaultConvs = allConversations.filter((c) => c.dealId === 'default');
      if (defaultConvs.length > 0) {
        await persistence.bulkSet(
          'conversations',
          defaultConvs.map((c) => ({ key: c.id, value: { ...c, dealId: newDealId } })),
        );
      }
      await dealState.switchDeal(newDealId);
    } else {
      // Assign to General (migration already stamped orphans with 'default')
      const defaultDeal = dealState.deals.find((d) => d.id === 'default');
      if (defaultDeal) {
        await dealState.switchDeal(defaultDeal.id);
      }
    }

    setNeedsMigration(false);
  };

  const handleDismissMigration = () => {
    // Dismiss defaults to assigning to General (already done by migration)
    setNeedsMigration(false);
  };

  if (!ready) {
    return (
      <div style={{ height: '100vh', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 18 }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', background: 'var(--bg-dark)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar — Pixel Agents game-panel style */}
      <div style={{
        height: 44,
        background: 'linear-gradient(180deg, #2d2d2d 0%, #1e1e1e 100%)',
        borderBottom: '3px solid #3a3a3a',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        flexShrink: 0,
        boxShadow: 'inset 0 -1px 0 rgba(180,83,9,0.3)',
      }}>
        <span style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 11,
          color: '#fbbf24',
          textShadow: '1px 1px 0 #92400e, 2px 2px 0 rgba(0,0,0,0.5)',
          letterSpacing: 1,
        }}>
          LEMON STUDIOS
        </span>
        <span style={{
          marginLeft: 12,
          fontSize: 10,
          color: '#64748b',
          fontFamily: 'monospace',
          letterSpacing: 1,
        }}>
          ● ONLINE
        </span>
      </div>

      <main ref={mainRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <LeftPanel />

        {/* Center column — agent bar + canvas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <AgentBar />
          <EditorToolbar />
          <div
            style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}
            onDragOver={handleDeskDragOver}
            onDragLeave={handleDeskDragLeave}
            onDrop={handleDeskDrop}
          >
            <OfficeCanvas />
            <RoomLabel />
          <ZoomControls />

          {/* Edit Layout button (hidden in editor mode) */}
          <EditLayoutButton />

          {/* Desk drop zone overlay */}
          {isDeskDragOver && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(251,191,36,0.1)', border: '2px dashed #fbbf24', pointerEvents: 'none' }}>
              <span style={{ fontSize: 36, marginBottom: 8 }}>📂</span>
              <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: 12 }}>Drop to upload to desk</span>
              <span style={{ color: 'rgba(251,191,36,0.7)', fontSize: 10, marginTop: 4 }}>PDF · DOCX · Excel</span>
            </div>
          )}

          {/* Hidden file input for desk upload button */}
          <input
            ref={deskFileInputRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.xls"
            multiple
            style={{ display: 'none' }}
            onChange={handleDeskFileInput}
          />



          {/* FileViewer overlays canvas area */}
          <FileViewer
            fileId={selectedFileId}
            onClose={() => setSelectedFileId(null)}
          />
        </div>
        </div>

        {/* Right panel — Chat + Teamwork */}
        <RightPanel />
      </main>

      {/* Migration prompt modal */}
      {needsMigration && (
        <MigrationPrompt
          onMigrate={(action, dealName) => void handleMigrate(action, dealName)}
          onDismiss={handleDismissMigration}
        />
      )}
      {/* Persona Builder overlay */}
      <PersonaBuilderOverlay />

      {/* File Manager modal */}
      {fileMgrAgent && (
        <FileCabinetModal
          agentId={fileMgrAgent}
          onClose={() => setFileMgrAgent(null)}
          onViewFile={(fileId) => {
            setFileMgrAgent(null);
            setSelectedFileId(fileId);
          }}
        />
      )}
    </div>
  );
}

// ── Edit Layout Button ──────────────────────────────────────────────────────

function EditLayoutButton() {
  const editorMode = useEditorStore((s) => s.editorMode);
  const toggleEditorMode = useEditorStore((s) => s.toggleEditorMode);

  if (editorMode) return null;

  return (
    <button
      onClick={toggleEditorMode}
      style={{ position: 'absolute', bottom: 56, left: 12, zIndex: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500, background: 'rgba(21,26,36,0.8)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.33)', cursor: 'pointer' }}
      title="Edit office layout"
    >
      <span>✏️</span>
      Edit Layout
    </button>
  );
}

export default App;
