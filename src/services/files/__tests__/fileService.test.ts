import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FileRecord } from '@/types/file';

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => {
  const mockGetDocument = vi.fn();
  return {
    getDocument: mockGetDocument,
    GlobalWorkerOptions: { workerSrc: '' },
  };
});

// Mock pdfjs-dist worker URL import
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: 'mock-worker-url',
}));

// Mock mammoth
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

// Mock xlsx (SheetJS)
vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: {
    sheet_to_json: vi.fn(),
  },
}));

// Mock persistence adapter
const mockPersistence = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
  query: vi.fn(),
  bulkSet: vi.fn(),
  clear: vi.fn(),
};

vi.mock('@/services/persistence/adapter', () => ({
  getPersistence: () => mockPersistence,
}));

// Mock crypto.randomUUID
const mockUUID = 'test-uuid-1234';
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => mockUUID),
});

describe('extractPdfText', () => {
  it('extracts text from all PDF pages', async () => {
    const { getDocument } = await import('pdfjs-dist');
    const mockedGetDocument = vi.mocked(getDocument);

    mockedGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi.fn()
          .mockResolvedValueOnce({
            getTextContent: vi.fn().mockResolvedValue({
              items: [{ str: 'Page 1 text' }, { str: 'more text' }],
            }),
          })
          .mockResolvedValueOnce({
            getTextContent: vi.fn().mockResolvedValue({
              items: [{ str: 'Page 2 text' }],
            }),
          }),
      }),
    } as unknown as ReturnType<typeof getDocument>);

    const { extractPdfText } = await import('@/services/files/extractPdf');
    const result = await extractPdfText(new ArrayBuffer(0));

    expect(result).toBe('Page 1 text more text\n\nPage 2 text');
    expect(mockedGetDocument).toHaveBeenCalledWith({ data: expect.any(ArrayBuffer) });
  });
});

describe('extractDocxText', () => {
  it('extracts text from DOCX via mammoth', async () => {
    const mammoth = (await import('mammoth')).default;
    vi.mocked(mammoth.extractRawText).mockResolvedValue({
      value: 'Extracted DOCX text content',
      messages: [],
    });

    const { extractDocxText } = await import('@/services/files/extractDocx');
    const result = await extractDocxText(new ArrayBuffer(0));

    expect(result).toBe('Extracted DOCX text content');
    expect(mammoth.extractRawText).toHaveBeenCalledWith({
      arrayBuffer: expect.any(ArrayBuffer),
    });
  });
});

describe('fileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistence.set.mockResolvedValue(undefined);
    mockPersistence.delete.mockResolvedValue(undefined);
    mockPersistence.query.mockResolvedValue([]);
  });

  describe('processDroppedFile', () => {
    it('processes a PDF file and returns FileRecord', async () => {
      // Mock extractPdfText via pdfjs-dist mock
      const { getDocument } = await import('pdfjs-dist');
      vi.mocked(getDocument).mockReturnValue({
        promise: Promise.resolve({
          numPages: 1,
          getPage: vi.fn().mockResolvedValue({
            getTextContent: vi.fn().mockResolvedValue({
              items: [{ str: 'PDF content here' }],
            }),
          }),
        }),
      } as unknown as ReturnType<typeof getDocument>);

      const { processDroppedFile } = await import('@/services/files/fileService');

      const mockFile = new File(['dummy'], 'report.pdf', { type: 'application/pdf' });
      Object.defineProperty(mockFile, 'size', { value: 1024 });

      const record = await processDroppedFile(mockFile, 'patrik', 'deal-1');

      expect(record).toMatchObject({
        id: mockUUID,
        name: 'report.pdf',
        size: 1024,
        type: 'pdf',
        agentId: 'patrik',
        dealId: 'deal-1',
        extractedText: 'PDF content here',
      });
      expect(record.uploadedAt).toBeTypeOf('number');
      expect(mockPersistence.set).toHaveBeenCalledWith('files', mockUUID, record);
    });

    it('processes a DOCX file and returns FileRecord', async () => {
      const mammoth = (await import('mammoth')).default;
      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: 'DOCX content here',
        messages: [],
      });

      const { processDroppedFile } = await import('@/services/files/fileService');

      const mockFile = new File(['dummy'], 'contract.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      Object.defineProperty(mockFile, 'size', { value: 2048 });

      const record = await processDroppedFile(mockFile, 'marcos', 'deal-2');

      expect(record).toMatchObject({
        id: mockUUID,
        name: 'contract.docx',
        size: 2048,
        type: 'docx',
        agentId: 'marcos',
        dealId: 'deal-2',
        extractedText: 'DOCX content here',
      });
      expect(mockPersistence.set).toHaveBeenCalledWith('files', mockUUID, record);
    });

    it('throws for unsupported file types', async () => {
      const { processDroppedFile } = await import('@/services/files/fileService');

      const mockFile = new File(['dummy'], 'image.png', { type: 'image/png' });

      await expect(processDroppedFile(mockFile, 'sandra', 'deal-1'))
        .rejects.toThrow('Unsupported file type: image.png');
    });
  });

  describe('deleteFile', () => {
    it('removes file from persistence', async () => {
      const { deleteFile } = await import('@/services/files/fileService');

      await deleteFile('file-123');

      expect(mockPersistence.delete).toHaveBeenCalledWith('files', 'file-123');
    });
  });

  describe('getFilesForAgent', () => {
    it('queries by agentId and filters by dealId', async () => {
      mockPersistence.query.mockResolvedValue([
        { id: '1', agentId: 'patrik', dealId: 'deal-1', name: 'a.pdf' },
        { id: '2', agentId: 'patrik', dealId: 'deal-2', name: 'b.pdf' },
        { id: '3', agentId: 'patrik', dealId: 'deal-1', name: 'c.docx' },
      ]);

      const { getFilesForAgent } = await import('@/services/files/fileService');

      const results = await getFilesForAgent('patrik', 'deal-1');

      expect(mockPersistence.query).toHaveBeenCalledWith('files', 'agentId', 'patrik');
      expect(results).toHaveLength(2);
      expect(results.map((r: FileRecord) => r.name)).toEqual(['a.pdf', 'c.docx']);
    });
  });

  describe('shareFileWithAllAgents', () => {
    it('creates copies for all 5 agents', async () => {
      let uuidCounter = 0;
      vi.mocked(crypto.randomUUID).mockImplementation(() => `shared-uuid-${uuidCounter++}` as `${string}-${string}-${string}-${string}-${string}`);

      const sourceRecord: FileRecord = {
        id: 'original-id',
        name: 'memo.pdf',
        size: 512,
        type: 'pdf',
        agentId: 'patrik',
        dealId: 'deal-1',
        extractedText: 'Shared content',
        uploadedAt: 1000,
      };

      const { shareFileWithAllAgents } = await import('@/services/files/fileService');

      const copies = await shareFileWithAllAgents(sourceRecord, 'deal-1');

      expect(copies).toHaveLength(5);

      const agentIds = copies.map((c: FileRecord) => c.agentId).sort();
      expect(agentIds).toEqual(['isaac', 'marcos', 'patrik', 'sandra', 'wendy']);

      // Each copy has unique ID and shared text
      for (const copy of copies) {
        expect(copy.id).not.toBe('original-id');
        expect(copy.extractedText).toBe('Shared content');
        expect(copy.dealId).toBe('deal-1');
        expect(copy.name).toBe('memo.pdf');
      }

      // All persisted
      expect(mockPersistence.set).toHaveBeenCalledTimes(5);
    });
  });
});

describe('extractExcelText', () => {
  beforeEach(() => vi.clearAllMocks());

  it('converts a single-sheet workbook to a markdown table', async () => {
    const xlsx = await import('xlsx');
    vi.mocked(xlsx.read).mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: {
        Sheet1: {},
      },
    } as ReturnType<typeof xlsx.read>);
    vi.mocked(xlsx.utils.sheet_to_json).mockReturnValue([
      ['Name', 'Amount'],
      ['Alice', '1000'],
      ['Bob', '2000'],
    ]);

    const { extractExcelText } = await import('@/services/files/extractExcel');
    const result = extractExcelText(new ArrayBuffer(0));

    expect(result).toContain('## Sheet: Sheet1');
    expect(result).toContain('| Name | Amount |');
    expect(result).toContain('| Alice | 1000 |');
    expect(result).toContain('| Bob | 2000 |');
    // Should have separator row after header
    expect(result).toContain('| --- | --- |');
  });

  it('renders multiple sheets as separate labelled sections', async () => {
    const xlsx = await import('xlsx');
    vi.mocked(xlsx.read).mockReturnValue({
      SheetNames: ['Revenue', 'Expenses'],
      Sheets: { Revenue: {}, Expenses: {} },
    } as ReturnType<typeof xlsx.read>);
    vi.mocked(xlsx.utils.sheet_to_json)
      .mockReturnValueOnce([['Q1', '500000']])
      .mockReturnValueOnce([['Rent', '12000']]);

    const { extractExcelText } = await import('@/services/files/extractExcel');
    const result = extractExcelText(new ArrayBuffer(0));

    expect(result).toContain('## Sheet: Revenue');
    expect(result).toContain('## Sheet: Expenses');
    expect(result).toContain('| Q1 | 500000 |');
    expect(result).toContain('| Rent | 12000 |');
  });
});

describe('processDroppedFile – Excel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistence.set.mockResolvedValue(undefined);
    vi.mocked(crypto.randomUUID).mockReturnValue(mockUUID as `${string}-${string}-${string}-${string}-${string}`);
  });

  it('processes an .xlsx file and returns FileRecord with type xlsx', async () => {
    const xlsx = await import('xlsx');
    vi.mocked(xlsx.read).mockReturnValue({
      SheetNames: ['Summary'],
      Sheets: { Summary: {} },
    } as ReturnType<typeof xlsx.read>);
    vi.mocked(xlsx.utils.sheet_to_json).mockReturnValue([
      ['Deal', 'Value'],
      ['Azula TV', '5000000'],
    ]);

    const { processDroppedFile } = await import('@/services/files/fileService');
    const mockFile = new File(['dummy'], 'financials.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    Object.defineProperty(mockFile, 'size', { value: 4096 });

    const record = await processDroppedFile(mockFile, 'sandra', 'deal-3');

    expect(record.type).toBe('xlsx');
    expect(record.name).toBe('financials.xlsx');
    expect(record.agentId).toBe('sandra');
    expect(record.extractedText).toContain('## Sheet: Summary');
    expect(mockPersistence.set).toHaveBeenCalledWith('files', mockUUID, record);
  });
});
