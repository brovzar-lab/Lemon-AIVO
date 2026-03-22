export interface FileRecord {
  id: string;          // crypto.randomUUID()
  name: string;        // Original filename
  size: number;        // Original file size in bytes
  type: 'pdf' | 'docx' | 'xlsx';
  agentId: string;     // Which agent's desk
  dealId: string;      // Which deal
  extractedText: string;
  uploadedAt: number;  // Date.now()
}
