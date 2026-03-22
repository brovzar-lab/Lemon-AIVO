import mammoth from 'mammoth';

export async function extractDocxText(data: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: data });
  return result.value;
}
