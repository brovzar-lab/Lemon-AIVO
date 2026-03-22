import { useFileStore } from '@/store/fileStore';
import { getAgent } from '@/config/agents';
import type { AgentId } from '@/types/agent';

interface FileViewerProps {
  fileId: string | null;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPE_COLORS: Record<string, string> = {
  pdf: '#ef4444',
  docx: '#3b82f6',
  xlsx: '#22c55e',
  txt: '#a78bfa',
};

export function FileViewer({ fileId, onClose }: FileViewerProps) {
  const file = useFileStore((s) => s.files.find((f) => f.id === fileId) ?? null);
  if (!fileId || !file) return null;

  const agent = getAgent(file.agentId as AgentId);
  const agentName = agent?.name ?? file.agentId;
  const uploadDate = new Date(file.uploadedAt).toLocaleDateString();
  const badgeColor = TYPE_COLORS[file.type] ?? '#6B7280';

  function handleDelete(): void {
    useFileStore.getState().removeFile(fileId!);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="file-viewer">
      <div className="modal-container file-viewer-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <span className="modal-header-icon">📄</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="modal-header-title">{file.name}</h2>
            <div className="modal-header-subtitle">
              {formatFileSize(file.size)} · {uploadDate} · {agentName}
            </div>
          </div>
          <span className="file-viewer-badge" style={{ backgroundColor: badgeColor }}>
            {file.type}
          </span>
          <button className="modal-close" onClick={onClose} aria-label="Close file viewer">×</button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ minHeight: 100, maxHeight: '55vh' }}>
          {file.extractedText ? (
            <pre className="file-viewer-content">{file.extractedText}</pre>
          ) : (
            <div className="file-viewer-empty">No text content extracted from this file.</div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>CLOSE</button>
          <button className="modal-btn modal-btn-danger" onClick={handleDelete}>🗑️ DELETE</button>
        </div>
      </div>
    </div>
  );
}
