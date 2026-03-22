import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { vitePluginPersonaWriter } from './vite-plugin-persona-writer';

/**
 * Parse a .env file into a key-value record. Values from the file take
 * precedence over empty shell-level env vars (Vite's loadEnv does the
 * opposite, which breaks proxy-injected secrets when the shell exports
 * the key as empty).
 */
function loadDotenv(dir: string): Record<string, string> {
  try {
    const content = readFileSync(resolve(dir, '.env'), 'utf-8');
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Overlay .env file values — file wins over empty shell vars
  const dotenv = loadDotenv(process.cwd());
  for (const [key, value] of Object.entries(dotenv)) {
    if (value && !env[key]) {
      env[key] = value;
    }
  }

  return {
    plugins: [react(), vitePluginPersonaWriter()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Inject API key from server-side env — never exposed to client bundle
              proxyReq.setHeader('x-api-key', env.ANTHROPIC_API_KEY || '');
              proxyReq.setHeader('anthropic-version', '2023-06-01');
            });
          },
        },
      },
    },
  };
});
