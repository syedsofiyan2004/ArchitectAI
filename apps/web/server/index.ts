import { createServer, DEFAULT_HOST } from './server.js';

const PORT = parseInt(process.env['PORT'] || '3001', 10);
const HOST = process.env['ARCHITECTAI_HOST'] || DEFAULT_HOST;

async function main() {
  const app = await createServer();
  app.listen(PORT, HOST, () => {
    console.log(`[ArchitectAI Backend] Server listening on http://${HOST}:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[ArchitectAI Backend] Failed to start server:', err);
  process.exit(1);
});
