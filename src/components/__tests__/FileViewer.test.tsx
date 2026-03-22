import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FileViewer } from '../FileViewer';
import { useFileStore } from '@/store/fileStore';
import type { FileRecord } from '@/types/file';

// Mock the fileStore
vi.mock('@/store/fileStore', () => {
  const files: FileRecord[] = [];
  const removeFile = vi.fn();
  const store = {
    files,
    isProcessing: false,
    removeFile,
    addFile: vi.fn(),
    loadFiles: vi.fn(),
    shareFile: vi.fn(),
    getFilesByAgent: vi.fn(() => []),
  };
  const useFileStore = Object.assign(
    (selector?: (s: typeof store) => unknown) => selector ? selector(store) : store,
    { getState: () => store },
  );
  return { useFileStore };
});

// Mock the agent registry
vi.mock('@/config/agents', () => ({
  getAgent: (id: string) => {
    if (id === 'patrik') return { name: 'Patrik', title: 'VP of M&A', color: '#e8b931' };
    return undefined;
  },
}));

const TEST_FILE: FileRecord = {
  id: 'file-1',
  name: 'deal-memo.pdf',
  size: 245760, // 240 KB
  type: 'pdf',
  agentId: 'patrik',
  dealId: 'deal-1',
  extractedText: 'This is the extracted text from the PDF document.',
  uploadedAt: new Date('2026-03-10').getTime(),
};

describe('FileViewer', () => {
  beforeEach(() => {
    cleanup();
    const store = useFileStore.getState() as ReturnType<typeof useFileStore.getState>;
    store.files.length = 0;
    store.files.push(TEST_FILE);
    (store.removeFile as ReturnType<typeof vi.fn>).mockClear();
  });

  it('renders file metadata when fileId matches a file in the store', () => {
    const onClose = vi.fn();
    render(<FileViewer fileId="file-1" onClose={onClose} />);

    // File name
    expect(screen.getByText('deal-memo.pdf')).toBeTruthy();
    // File size (245760 bytes = 240.0 KB)
    expect(screen.getByText('240.0 KB')).toBeTruthy();
    // Agent name
    expect(screen.getByText('Patrik')).toBeTruthy();
    // Type badge
    expect(screen.getByText('PDF')).toBeTruthy();
    // Extracted text
    expect(screen.getByText('This is the extracted text from the PDF document.')).toBeTruthy();
  });

  it('calls removeFile and onClose when Delete is clicked', () => {
    const onClose = vi.fn();
    render(<FileViewer fileId="file-1" onClose={onClose} />);

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButton);

    const store = useFileStore.getState();
    expect(store.removeFile).toHaveBeenCalledWith('file-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when fileId is null', () => {
    const onClose = vi.fn();
    const { container } = render(<FileViewer fileId={null} onClose={onClose} />);

    expect(container.innerHTML).toBe('');
  });

  it('only has Close and Delete buttons (no Share button)', () => {
    const onClose = vi.fn();
    render(<FileViewer fileId="file-1" onClose={onClose} />);

    const buttons = screen.getAllByRole('button');
    const buttonTexts = buttons.map((b) => b.textContent);

    expect(buttonTexts).toContain('Close');
    expect(buttonTexts).toContain('Delete');
    expect(buttonTexts).not.toContain('Share');
    expect(buttonTexts).not.toContain('Copy');
    expect(buttonTexts).not.toContain('Re-extract');
    expect(buttons).toHaveLength(2);
  });
});
