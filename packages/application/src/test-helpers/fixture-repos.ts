import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

export interface FixtureRepo {
  name: string;
  repoPath: string;
  initialHead: string;
  initialBranch: string;
  cleanup: () => void;
}

export function createDemoFixtureRepo(type: 'rate-limiter' | 'payment-idempotency' | 'image-worker' | 'token-refresh'): FixtureRepo {
  const tmpDir = path.join(os.tmpdir(), `architectai-fixture-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });

  let pkgJson = {};
  let indexContent = '';
  let testContent = '';

  if (type === 'rate-limiter') {
    pkgJson = {
      name: 'demo-api-rate-limiter',
      version: '1.0.0',
      description: 'API rate limiter target fixture',
      scripts: {
        test: 'node test.cjs',
      },
      dependencies: {
        express: '^4.19.2',
        ioredis: '^5.4.1',
      },
    };
    indexContent = `// Express API Gateway entry point\nconst express = require('express');\nconst app = express();\napp.get('/api/resource', (req, res) => res.json({ ok: true }));\nmodule.exports = app;\n`;
    testContent = `// Verifies rate limiter behavior\nconst fs = require('fs');\nconst path = require('path');\nconst limiterPath = path.join(__dirname, 'src', 'rate-limiter.ts');\nif (!fs.existsSync(limiterPath)) {\n  console.error('rate-limiter.ts not found');\n  process.exit(1);\n}\nconst content = fs.readFileSync(limiterPath, 'utf8');\nif (!content.includes('isAllowed') || !content.includes('window')) {\n  console.error('rate-limiter.ts does not implement windowed checks');\n  process.exit(1);\n}\nconsole.log('Rate limiter fixture test passed!');\n`;
  } else if (type === 'payment-idempotency') {
    pkgJson = {
      name: 'demo-payment-idempotency',
      version: '1.0.0',
      description: 'Payment idempotency target fixture',
      scripts: {
        test: 'node test.cjs',
      },
      dependencies: {
        pg: '^8.11.5',
      },
    };
    indexContent = `// Payment processing service\nasync function chargePayment(chargeRequest) {\n  return { status: 'success', id: chargeRequest.id };\n}\nmodule.exports = { chargePayment };\n`;
    testContent = `// Verifies idempotency ledger\nconst fs = require('fs');\nconst path = require('path');\nconst ledgerPath = path.join(__dirname, 'src', 'idempotency.ts');\nif (!fs.existsSync(ledgerPath)) {\n  console.error('idempotency.ts not found');\n  process.exit(1);\n}\nconst content = fs.readFileSync(ledgerPath, 'utf8');\nif (!content.includes('checkAndLock') || !content.includes('complete')) {\n  console.error('idempotency.ts does not implement checkAndLock');\n  process.exit(1);\n}\nconsole.log('Payment idempotency fixture test passed!');\n`;
  } else if (type === 'token-refresh') {
    pkgJson = {
      name: 'demo-token-refresh',
      version: '1.0.0',
      description: 'Token refresh concurrency target fixture',
      scripts: {
        test: 'node test.cjs',
      },
      dependencies: {
        axios: '^1.7.2',
      },
    };
    indexContent = `// Token refresh entry point\nconst token = 'initial-token';\nmodule.exports = { token };\n`;
    testContent = `// Verifies token manager implementation\nconst fs = require('fs');\nconst path = require('path');\nconst tokenPath = path.join(__dirname, 'src', 'token-manager.ts');\nif (!fs.existsSync(tokenPath)) {\n  console.error('token-manager.ts not found');\n  process.exit(1);\n}\nconst content = fs.readFileSync(tokenPath, 'utf8');\nif (!content.includes('TokenManager') || !content.includes('refreshToken')) {\n  console.error('token-manager.ts does not implement TokenManager');\n  process.exit(1);\n}\nconsole.log('Token refresh fixture test passed!');\n`;
  } else {
    pkgJson = {
      name: 'demo-image-worker',
      version: '1.0.0',
      description: 'Image processing worker target fixture',
      scripts: {
        test: 'node test.cjs',
      },
      dependencies: {
        sharp: '^0.33.4',
      },
    };
    indexContent = `// Image worker pipeline\nasync function processImage(buffer) {\n  return buffer;\n}\nmodule.exports = { processImage };\n`;
    testContent = `// Verifies bounded worker pool\nconst fs = require('fs');\nconst path = require('path');\nconst poolPath = path.join(__dirname, 'src', 'worker-pool.ts');\nif (!fs.existsSync(poolPath)) {\n  console.error('worker-pool.ts not found');\n  process.exit(1);\n}\nconst content = fs.readFileSync(poolPath, 'utf8');\nif (!content.includes('BoundedWorkerPool') || !content.includes('maxConcurrency')) {\n  console.error('worker-pool.ts does not implement BoundedWorkerPool');\n  process.exit(1);\n}\nconsole.log('Image worker fixture test passed!');\n`;
  }

  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
  fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), indexContent);
  fs.writeFileSync(path.join(tmpDir, 'test.cjs'), testContent);

  // Initialize git repository
  execSync('git init -b main', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git config user.name "ArchitectAI Tester"', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git config user.email "test@architectai.dev"', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git add .', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git commit -m "initial fixture commit"', { cwd: tmpDir, stdio: 'ignore' });

  const initialHead = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf8' }).trim();
  const initialBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: tmpDir, encoding: 'utf8' }).trim();

  return {
    name: type,
    repoPath: tmpDir,
    initialHead,
    initialBranch,
    cleanup: () => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
  };
}
