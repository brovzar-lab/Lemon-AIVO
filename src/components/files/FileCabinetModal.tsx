// src/components/files/FileCabinetModal.tsx
import { useCallback, useMemo, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { useFileStore } from '@/store/fileStore';
import { getAgent } from '@/config/agents';
import type { AgentId } from '@/types/agent';
import type { FileRecord } from '@/types/file';

interface FileCabinetModalProps {
  agentId: AgentId;
  onClose: () => void;
  onViewFile: (fileId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPE_ICONS: Record<string, string> = {
  pdf: '📕',
  docx: '📝',
  xlsx: '📊',
  txt: '📃',
};

export function FileCabinetModal({ agentId, onClose, onViewFile }: FileCabinetModalProps) {
  const allFiles = useFileStore((s) => s.files);
  const isProcessing = useFileStore((s) => s.isProcessing);
  const files = useMemo(() => allFiles.filter((f) => f.agentId === agentId), [allFiles, agentId]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const agent = getAgent(agentId);
  const agentName = agent?.name ?? agentId;

  const handleUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      await useFileStore.getState().addFile(file, agentId);
    }
  }, [agentId]);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    void handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    void handleUpload(e.target.files);
    if (inputRef.current) inputRef.current.value = '';
  }, [handleUpload]);

  const handleDelete = useCallback((fileId: string) => {
    void useFileStore.getState().removeFile(fileId);
  }, []);

  return (
    <div data-testid="file-cabinet-modal" className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-container file-cabinet-modal ${isDragOver ? 'dragover' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={isDragOver ? { borderColor: 'var(--accent-teal)', borderWidth: 2 } : undefined}
      >
        {/* Header */}
        <div className="modal-header">
          <span className="modal-header-icon">💻</span>
          <div style={{ flex: 1 }}>
            <div className="modal-header-title" style={{ fontFamily: 'var(--font-pixel)', fontSize: 'var(--pixel-sm)', letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--accent-teal-light)' }}>
              {agentName}&apos;s Files
            </div>
            <div className="modal-header-subtitle">
              {files.length} document{files.length !== 1 ? 's' : ''} uploaded
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close file manager">×</button>
        </div>

        {/* File List */}
        <div className="modal-body" style={{ minHeight: 80 }}>
          {files.length === 0 ? (
            <div className="file-cabinet-empty">
              <span className="file-cabinet-empty-icon">📂</span>
              <span>
                No files uploaded.<br />
                Drop files here or click Upload<br />
                for {agentName} to review.
              </span>
            </div>
          ) : (
            <div className="file-cabinet-list">
              {files.map((file: FileRecord) => (
                <div
                  key={file.id}
                  className="file-cabinet-item"
                  onClick={() => onViewFile(file.id)}
                >
                  <span className="file-cabinet-item-icon">
                    {TYPE_ICONS[file.type] ?? '📄'}
                  </span>
                  <div className="file-cabinet-item-info">
                    <div className="file-cabinet-item-name">{file.name}</div>
                    <div className="file-cabinet-item-meta">
                      {formatFileSize(file.size)} · {new Date(file.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    className="file-cabinet-item-delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drag-over overlay */}
        {isDragOver && (
          <div className="file-cabinet-dropzone dragover" style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="file-cabinet-dropzone-text" style={{
              fontFamily: 'var(--font-pixel)', letterSpacing: 1,
              color: 'var(--accent-teal)',
            }}>
              DROP TO UPLOAD
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.txt,.doc,.xls,.csv"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
          <button
            className="modal-btn modal-btn-primary"
            onClick={() => inputRef.current?.click()}
            disabled={isProcessing}
            style={isProcessing ? { opacity: 0.5, cursor: 'wait' } : undefined}
          >
            {isProcessing ? 'PROCESSING...' : '+ UPLOAD FILE'}
          </button>
        </div>
      </div>
    </div>
  );
}
