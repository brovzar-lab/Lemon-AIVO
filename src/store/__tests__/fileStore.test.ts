import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FileRecord } from '@/types/file';

// Mock fileService
const mockProcessDroppedFile = vi.fn();
const mockDeleteFile = vi.fn();
const mockGetFilesForAgent = vi.fn();
const mockShareFileWithAllAgents = vi.fn();

vi.mock('@/services/files/fileService', () => ({
  processDroppedFile: (...args: unknown[]) => mockProcessDroppedFile(...args),
  deleteFile: (...args: unknown[]) => mockDeleteFile(...args),
  getFilesForAgent: (...args: unknown[]) => mockGetFilesForAgent(...args),
  shareFileWithAllAgents: (...args: unknown[]) => mockShareFileWithAllAgents(...args),
}));

// Mock dealStore
vi.mock('@/store/dealStore', () => ({
  useDealStore: {
    getState: () => ({ activeDealId: 'deal-1' }),
  },
}));

describe('fileStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockProcessDroppedFile.mockResolvedValue({
      id: 'file-1',
      name: 'test.pdf',
      size: 1024,
      type: 'pdf',
      agentId: 'patrik',
      dealId: 'deal-1',
      extractedText: 'text',
      uploadedAt: 1000,
    } satisfies FileRecord);
    mockDeleteFile.mockResolvedValue(undefined);
    mockGetFilesForAgent.mockResolvedValue([]);
    mockShareFileWithAllAgents.mockResolvedValue([]);

    // Reset store between tests
    const { useFileStore } = await import('@/store/fileStore');
    useFileStore.setState({ files: [], isProcessing: false });
  });

  it('starts with empty files and isProcessing=false', async () => {
    const { useFileStore } = await import('@/store/fileStore');
    const state = useFileStore.getState();
    expect(state.files).toEqual([]);
    expect(state.isProcessing).toBe(false);
  });

  describe('addFile', () => {
    it('sets isProcessing during file processing and adds result', async () => {
      const { useFileStore } = await import('@/store/fileStore');
      const mockFile = new File(['data'], 'test.pdf');

      await useFileStore.getState().addFile(mockFile, 'patrik');

      expect(mockProcessDroppedFile).toHaveBeenCalledWith(mockFile, 'patrik', 'deal-1');
      expect(useFileStore.getState().files).toHaveLength(1);
      expect(useFileStore.getState().files[0]!.name).toBe('test.pdf');
      expect(useFileStore.getState().isProcessing).toBe(false);
    });

    it('defaults to "default" dealId when activeDealId is null', async () => {
      // Override dealStore mock for this test
      const dealStore = await import('@/store/dealStore');
      const spy = vi.spyOn(dealStore.useDealStore, 'getState').mockReturnValue({
        activeDealId: null,
      } as ReturnType<typeof dealStore.useDealStore.getState>);

      const { useFileStore } = await import('@/store/fileStore');
      const mockFile = new File(['data'], 'test.pdf');

      await useFileStore.getState().addFile(mockFile, 'patrik');

      expect(mockProcessDroppedFile).toHaveBeenCalledWith(mockFile, 'patrik', 'default');

      spy.mockRestore();
    });

    it('resets isProcessing on error', async () => {
      mockProcessDroppedFile.mockRejectedValue(new Error('extraction failed'));

      const { useFileStore } = await import('@/store/fileStore');
      const mockFile = new File(['data'], 'bad.txt');

      // Should not throw
      await useFileStore.getState().addFile(mockFile, 'patrik');

      expect(useFileStore.getState().isProcessing).toBe(false);
      expect(useFileStore.getState().files).toHaveLength(0);
    });
  });

  describe('removeFile', () => {
    it('calls deleteFile and removes from array', async () => {
      const { useFileStore } = await import('@/store/fileStore');

      // Pre-populate
      useFileStore.setState({
        files: [
          { id: 'f1', name: 'a.pdf', size: 100, type: 'pdf', agentId: 'patrik', dealId: 'deal-1', extractedText: '', uploadedAt: 1 },
          { id: 'f2', name: 'b.pdf', size: 200, type: 'pdf', agentId: 'marcos', dealId: 'deal-1', extractedText: '', uploadedAt: 2 },
        ],
      });

      await useFileStore.getState().removeFile('f1');

      expect(mockDeleteFile).toHaveBeenCalledWith('f1');
      expect(useFileStore.getState().files).toHaveLength(1);
      expect(useFileStore.getState().files[0]!.id).toBe('f2');
    });
  });

  describe('loadFiles', () => {
    it('replaces files array with query results', async () => {
      const loaded: FileRecord[] = [
        { id: 'l1', name: 'loaded.pdf', size: 500, type: 'pdf', agentId: 'patrik', dealId: 'deal-1', extractedText: 'loaded text', uploadedAt: 5 },
      ];
      mockGetFilesForAgent.mockResolvedValue(loaded);

      const { useFileStore } = await import('@/store/fileStore');

      await useFileStore.getState().loadFiles('patrik', 'deal-1');

      expect(mockGetFilesForAgent).toHaveBeenCalledWith('patrik', 'deal-1');
      expect(useFileStore.getState().files).toEqual(loaded);
    });
  });

  describe('shareFile', () => {
    it('calls shareFileWithAllAgents and adds copies to files', async () => {
      const sourceRecord: FileRecord = {
        id: 'src-1',
        name: 'memo.pdf',
        size: 256,
        type: 'pdf',
        agentId: 'patrik',
        dealId: 'deal-1',
        extractedText: 'shared',
        uploadedAt: 10,
      };

      const copies: FileRecord[] = [
        { ...sourceRecord, id: 'c1', agentId: 'patrik' },
        { ...sourceRecord, id: 'c2', agentId: 'marcos' },
      ];
      mockShareFileWithAllAgents.mockResolvedValue(copies);

      const { useFileStore } = await import('@/store/fileStore');

      await useFileStore.getState().shareFile(sourceRecord);

      expect(mockShareFileWithAllAgents).toHaveBeenCalledWith(sourceRecord, 'deal-1');
      expect(useFileStore.getState().files).toHaveLength(2);
    });
  });

  describe('getFilesByAgent', () => {
    it('returns filtered subset of files', async () => {
      const { useFileStore } = await import('@/store/fileStore');

      useFileStore.setState({
        files: [
          { id: 'f1', name: 'a.pdf', size: 100, type: 'pdf', agentId: 'patrik', dealId: 'deal-1', extractedText: '', uploadedAt: 1 },
          { id: 'f2', name: 'b.pdf', size: 200, type: 'pdf', agentId: 'marcos', dealId: 'deal-1', extractedText: '', uploadedAt: 2 },
          { id: 'f3', name: 'c.docx', size: 300, type: 'docx', agentId: 'patrik', dealId: 'deal-1', extractedText: '', uploadedAt: 3 },
        ],
      });

      const patrikFiles = useFileStore.getState().getFilesByAgent('patrik');
      expect(patrikFiles).toHaveLength(2);
      expect(patrikFiles.map(f => f.name)).toEqual(['a.pdf', 'c.docx']);
    });
  });
});
