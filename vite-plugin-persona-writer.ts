// vite-plugin-persona-writer.ts
import type { Plugin } from 'vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface SavePersonaBody {
  agentId: string;
  personality: string;
  domain: string;
  personaPrompt: string;
  skillFileContent: string;
}

/** Reads the full body of an IncomingMessage as a string. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveFn, rejectFn) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolveFn(body));
    req.on('error', rejectFn);
  });
}

export function vitePluginPersonaWriter(): Plugin {
  let projectRoot = process.cwd();

  return {
    name: 'persona-writer',
    apply: 'serve', // dev only

    configResolved(config) {
      projectRoot = config.root;
    },

    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (req.method !== 'POST' || req.url !== '/api/persona/save') {
          next();
          return;
        }

        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as SavePersonaBody;

          // Validate required fields
          if (!body.agentId || !body.personaPrompt) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'agentId and personaPrompt are required' }));
            return;
          }

          // 1. Read the existing agent file to preserve name/title/color
          const agentFilePath = resolve(projectRoot, 'src', 'config', 'agents', `${body.agentId}.ts`);
          let existingContent = '';
          try { existingContent = readFileSync(agentFilePath, 'utf-8'); } catch { /* new file */ }

          // Extract name, title, color from existing file to preserve them
          const nameMatch = existingContent.match(/name:\s*'([^']+)'/);
          const titleMatch = existingContent.match(/title:\s*'([^']+)'/);
          const colorMatch = existingContent.match(/color:\s*'([^']+)'/);
          const preservedName = nameMatch?.[1] ?? (body.agentId.charAt(0).toUpperCase() + body.agentId.slice(1));
          const preservedTitle = titleMatch?.[1] ?? '';
          const preservedColor = colorMatch?.[1] ?? '#6B7280';

          // 2. Write agent .ts file (full template rewrite)
          const exportName = `${body.agentId}Persona`;
          const personaPromptEscaped = body.personaPrompt.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
          const agentFileContent = `import type { AgentPersona } from '@/types/agent';

/**
 * ${preservedName}'s full persona definition.
 *
 * \`personaPrompt\` is the persona-specific system prompt layer that gets combined
 * with the base system prompt by the context builder. It is separate from the
 * runtime \`systemPrompt\` field on AgentPersona (which is the fully assembled prompt).
 */
export const ${exportName}: Omit<AgentPersona, 'status' | 'systemPrompt'> & { personaPrompt: string } = {
  id: '${body.agentId}',
  name: '${preservedName}',
  title: '${preservedTitle}',
  color: '${preservedColor}',
  personality:
    ${JSON.stringify(body.personality)},
  domain:
    ${JSON.stringify(body.domain)},
  personaPrompt: \`${personaPromptEscaped}\`,
};
`;
          writeFileSync(agentFilePath, agentFileContent, 'utf-8');

          // 3. Write skill file to ~/.claude/skills/
          const titleSlug = preservedTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const skillFileName = `${body.agentId}-${titleSlug}.md`;
          const skillDir = join(homedir(), '.claude', 'skills');
          mkdirSync(skillDir, { recursive: true });
          writeFileSync(join(skillDir, skillFileName), body.skillFileContent, 'utf-8');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: msg }));
        }
      });
    },
  };
}
