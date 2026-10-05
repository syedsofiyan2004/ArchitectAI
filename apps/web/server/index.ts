import { createServer } from './server.js';

const PORT = parseInt(process.env['PORT'] || '3001', 10);

async function main() {
  const app = await createServer();
  app.listen(PORT, () => {
    console.log(`[ArchitectAI Backend] Server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[ArchitectAI Backend] Failed to start server:', err);
  process.exit(1);
});
