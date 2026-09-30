#!/usr/bin/env node
import { runWalkingSkeleton } from './skeleton.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'skeleton';

  if (command === 'skeleton') {
    try {
      const result = await runWalkingSkeleton();
      for (const msg of result.logMessages) {
        console.log(`[ArchitectAI CLI] ${msg}`);
      }
      console.log('\n--- Serialized Engineering Contract ---');
      console.log(result.contractJson);
      console.log('--- End of Contract ---\n');
      console.log('[ArchitectAI CLI] Walking skeleton completed successfully.');
      process.exit(0);
    } catch (error) {
      console.error('[ArchitectAI CLI] Walking skeleton failed:', error);
      process.exit(1);
    }
  } else {
    console.error(`[ArchitectAI CLI] Unknown command: ${command}`);
    console.log('Available commands: skeleton');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[ArchitectAI CLI] Uncaught error:', err);
  process.exit(1);
});
