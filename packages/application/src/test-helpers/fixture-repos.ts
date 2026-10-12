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

export function createMonorepoFixtureRepo(): FixtureRepo {
  const tmpDir = path.join(os.tmpdir(), `architectai-fixture-monorepo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(path.join(tmpDir, 'apps', 'api', 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'packages', 'shared', 'src'), { recursive: true });

  const rootPkg = {
    name: 'demo-monorepo',
    private: true,
    workspaces: ['packages/*', 'apps/*'],
  };
  const apiPkg = {
    name: '@demo/api',
    version: '1.0.0',
    scripts: {
      test: 'node -e "console.log(\'api tests ok\')"',
    },
    dependencies: {
      express: '^4.19.2',
    },
  };
  const sharedPkg = {
    name: '@demo/shared',
    version: '1.0.0',
    dependencies: {},
  };

  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(rootPkg, null, 2));
  fs.writeFileSync(path.join(tmpDir, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'packages/*'\n");
  fs.writeFileSync(path.join(tmpDir, 'apps', 'api', 'package.json'), JSON.stringify(apiPkg, null, 2));
  fs.writeFileSync(path.join(tmpDir, 'apps', 'api', 'src', 'index.js'), "module.exports = { app: 'api' };\n");
  fs.writeFileSync(path.join(tmpDir, 'packages', 'shared', 'package.json'), JSON.stringify(sharedPkg, null, 2));
  fs.writeFileSync(path.join(tmpDir, 'packages', 'shared', 'src', 'index.js'), "module.exports = { util: true };\n");

  execSync('git init -b main', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git config user.name "ArchitectAI Tester"', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git config user.email "test@architectai.dev"', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git add .', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git commit -m "initial monorepo commit"', { cwd: tmpDir, stdio: 'ignore' });

  const initialHead = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf8' }).trim();
  const initialBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: tmpDir, encoding: 'utf8' }).trim();

  return {
    name: 'monorepo',
    repoPath: tmpDir,
    initialHead,
    initialBranch,
    cleanup: () => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    },
  };
}

export function createDirtyFixtureRepo(): FixtureRepo {
  const base = createDemoFixtureRepo('rate-limiter');
  // Write uncommitted changes
  fs.writeFileSync(path.join(base.repoPath, 'uncommitted.txt'), 'dirty working tree content');
  fs.writeFileSync(path.join(base.repoPath, 'src', 'index.js'), '// modified uncommitted\n');
  return base;
}

export function createFailingNativeTestFixtureRepo(): FixtureRepo {
  const tmpDir = path.join(os.tmpdir(), `architectai-fixture-failing-native-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });

  const pkgJson = {
    name: 'demo-failing-native',
    version: '1.0.0',
    scripts: {
      test: 'node test.cjs',
    },
  };
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
  fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), "module.exports = {};\n");
  fs.writeFileSync(path.join(tmpDir, 'test.cjs'), "console.error('Native test failure!'); process.exit(1);\n");

  execSync('git init -b main', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git config user.name "ArchitectAI Tester"', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git config user.email "test@architectai.dev"', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git add .', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git commit -m "initial failing native commit"', { cwd: tmpDir, stdio: 'ignore' });

  const initialHead = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf8' }).trim();
  const initialBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: tmpDir, encoding: 'utf8' }).trim();

  return {
    name: 'failing-native',
    repoPath: tmpDir,
    initialHead,
    initialBranch,
    cleanup: () => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    },
  };
}

export function createSecretsAndBinariesFixtureRepo(): FixtureRepo {
  const tmpDir = path.join(os.tmpdir(), `architectai-fixture-secrets-binaries-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.aws'), { recursive: true });

  const pkgJson = {
    name: 'demo-secrets-and-binaries',
    version: '1.0.0',
    scripts: {
      test: 'node -e "process.exit(0)"',
    },
  };
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
  fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), "module.exports = { clean: true };\n");

  // Secrets
  fs.writeFileSync(path.join(tmpDir, '.env.production'), 'DATABASE_URL=postgres://user:super_secret_pw@localhost:5432/db\nAPI_KEY=sk-test-live-1234567890abcdef12345678\n');
  fs.writeFileSync(path.join(tmpDir, 'id_rsa'), '-----BEGIN OPENSSH PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END OPENSSH PRIVATE KEY-----\n');
  fs.writeFileSync(path.join(tmpDir, '.aws', 'credentials'), '[default]\naws_access_key_id = AKIAIOSFODNN7EXAMPLE\naws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n');

  // Binary and Huge Files
  fs.writeFileSync(path.join(tmpDir, 'archive.zip'), Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00]));
  fs.writeFileSync(path.join(tmpDir, 'image.png'), Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
  const hugeBuffer = Buffer.alloc(300 * 1024, 0x41); // 300 KB
  fs.writeFileSync(path.join(tmpDir, 'huge-file.bin'), hugeBuffer);

  execSync('git init -b main', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git config user.name "ArchitectAI Tester"', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git config user.email "test@architectai.dev"', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git add .', { cwd: tmpDir, stdio: 'ignore' });
  execSync('git commit -m "initial secrets and binaries commit"', { cwd: tmpDir, stdio: 'ignore' });

  const initialHead = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf8' }).trim();
  const initialBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: tmpDir, encoding: 'utf8' }).trim();

  return {
    name: 'secrets-binaries',
    repoPath: tmpDir,
    initialHead,
    initialBranch,
    cleanup: () => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    },
  };
}
