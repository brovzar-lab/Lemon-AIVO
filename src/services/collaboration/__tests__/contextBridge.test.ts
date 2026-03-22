import { describe, it, expect } from 'vitest';
import { buildCollabContextLayer } from '@/services/collaboration/contextBridge';

describe('contextBridge', () => {
  describe('buildCollabContextLayer (COLLAB-03)', () => {
    it('produces a string with task summary and prior findings sections', () => {
      const ctx = {
        taskSummary: 'Evaluate acquisition target XYZ Corp',
        priorFindings: [
          { agentName: 'Patrik', summary: 'Initial review complete. Key strengths identified.' },
        ],
      };

      const result = buildCollabContextLayer(ctx);

      expect(result).toContain('## Consultation Topic');
      expect(result).toContain('Evaluate acquisition target XYZ Corp');
      expect(result).toContain('## Prior Findings');
      expect(result).toContain('### Patrik');
      expect(result).toContain('Initial review complete.');
    });

    it('truncates each priorFinding summary at 400 chars', () => {
      const longSummary = 'x'.repeat(500); // 500 chars — should be truncated to 397 + '...'
      const ctx = {
        taskSummary: 'Some task',
        priorFindings: [
          { agentName: 'Marcos', summary: longSummary },
        ],
      };

      const result = buildCollabContextLayer(ctx);

      // The finding section should have the truncated form
      expect(result).toContain('...');
      // The total rendered finding must not exceed 400 chars of content
      const findingMatch = result.match(/### Marcos\n\n([\s\S]+?)(\n\n|$)/);
      // Summaries are truncated at 397 chars + '...' = 400 chars total
      const renderedSummary = result.split('### Marcos\n')[1]?.split('\n\n')[0] ?? '';
      expect(renderedSummary.length).toBeLessThanOrEqual(400);
    });

    it('total output stays under ~1200 tokens (4800 chars) for 2 hops', () => {
      // Two prior findings, each with 400-char summaries (max length)
      const finding400 = 'a'.repeat(400);
      const ctx = {
        taskSummary: 'Multi-hop deal review',
        priorFindings: [
          { agentName: 'Patrik', summary: finding400 },
          { agentName: 'Marcos', summary: finding400 },
        ],
      };

      const result = buildCollabContextLayer(ctx);

      // ~1200 tokens = ~4800 chars limit
      expect(result.length).toBeLessThan(4800);
    });

    it('includes userInstruction section when provided', () => {
      const ctx = {
        taskSummary: 'Review deal',
        priorFindings: [],
        userInstruction: 'Focus on regulatory risks in EU markets',
      };

      const result = buildCollabContextLayer(ctx);

      expect(result).toContain('## Additional Context');
      expect(result).toContain('Focus on regulatory risks in EU markets');
    });

    it('omits userInstruction section when not provided', () => {
      const ctx = {
        taskSummary: 'Review deal',
        priorFindings: [],
        // no userInstruction
      };

      const result = buildCollabContextLayer(ctx);

      expect(result).not.toContain('## Additional Context');
    });
  });
});
