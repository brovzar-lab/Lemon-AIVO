import { extractPdfText } from './extractPdf';
import { extractDocxText } from './extractDocx';
import { extractExcelText } from './extractExcel';
import { getPersistence } from '@/services/persistence/adapter';
import type { FileRecord } from '@/types/file';
import type { AgentId } from '@/types/agent';

const ALL_AGENTS: AgentId[] = ['patrik', 'marcos', 'sandra', 'isaac', 'wendy'];

export async function processDroppedFile(
  file: File,
  agentId: AgentId,
  dealId: string,
): Promise<FileRecord> {
  const arrayBuffer = await file.arrayBuffer();

  let extractedText: string;
  let fileType: 'pdf' | 'docx' | 'xlsx';

  if (file.name.toLowerCase().endsWith('.pdf')) {
    fileType = 'pdf';
    extractedText = await extractPdfText(arrayBuffer);
  } else if (file.name.toLowerCase().endsWith('.docx')) {
    fileType = 'docx';
    extractedText = await extractDocxText(arrayBuffer);
  } else if (
    file.name.toLowerCase().endsWith('.xlsx') ||
    file.name.toLowerCase().endsWith('.xls')
  ) {
    fileType = 'xlsx';
    extractedText = extractExcelText(arrayBuffer);
  } else {
    throw new Error(`Unsupported file type: ${file.name}`);
  }

  const record: FileRecord = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: fileType,
    agentId,
    dealId,
    extractedText,
    uploadedAt: Date.now(),
  };

  const db = getPersistence();
  await db.set('files', record.id, record);

  return record;
}

export async function deleteFile(fileId: string): Promise<void> {
  const db = getPersistence();
  await db.delete('files', fileId);
}

export async function getFilesForAgent(
  agentId: string,
  dealId: string,
): Promise<FileRecord[]> {
  const db = getPersistence();
  const allForAgent = await db.query<FileRecord>('files', 'agentId', agentId);
  return allForAgent.filter((f) => f.dealId === dealId);
}

export async function shareFileWithAllAgents(
  fileRecord: FileRecord,
  dealId: string,
): Promise<FileRecord[]> {
  const db = getPersistence();
  const copies: FileRecord[] = [];

  for (const agentId of ALL_AGENTS) {
    const copy: FileRecord = {
      ...fileRecord,
      id: crypto.randomUUID(),
      agentId,
      dealId,
      uploadedAt: Date.now(),
    };
    await db.set('files', copy.id, copy);
    copies.push(copy);
  }

  return copies;
}
