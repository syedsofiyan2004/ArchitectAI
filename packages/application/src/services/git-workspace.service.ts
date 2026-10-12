import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  RepositoryWorkspace,
  RepositoryWorkspaceSchema,
  PackageManifestSummary,
  RepositoryFingerprint,
  RepositoryFingerprintSchema,
  ProductFailureCode,
} from '@architectai/domain';

const execFileAsync = promisify(execFile);

export class NonGitRepositoryError extends Error {
  constructor(path: string, reason?: string) {
    super(`Target path '${path}' is not a valid Git repository${reason ? `: ${reason}` : ''}.`);
    this.name = 'NonGitRepositoryError';
  }
}

export const SENSITIVE_PATTERNS = [
  /^\.env($|\..*)/i,
  /\.(pem|key|pfx|p12|pkcs12)$/i,
  /id_(rsa|dsa|ecdsa|ed25519)($|\.)/i,
  /(^|\/|\\)(credentials|secrets|token|auth)\.json$/i,
  /(^|\/|\\)\.aws(\/|\\)(credentials|config)$/i,
  /(^|\/|\\)\.git($|\/|\\)/i,
  /(^|\/|\\)node_modules($|\/|\\)/i,
  /(^|\/|\\)(dist|build|\.turbo|\.next|target)($|\/|\\)/i,
  /\.log$/i,
];

export const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svgz',
  '.pdf', '.zip', '.tar', '.gz', '.tgz', '.7z', '.rar',
  '.exe', '.bin', '.dll', '.so', '.dylib', '.wasm',
  '.db', '.sqlite', '.sqlite3',
  '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.woff', '.woff2', '.ttf', '.eot',
]);

export function isSensitivePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isBinaryOrHugeFile(filePath: string, fullPath?: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return true;
  }
  if (fullPath && fs.existsSync(fullPath)) {
    try {
      const stat = fs.statSync(fullPath);
      if (stat.size > 256 * 1024) { // > 256 KB
        return true;
      }
      // Check first 512 bytes for null byte (binary indicator)
      const fd = fs.openSync(fullPath, 'r');
      const buffer = Buffer.alloc(Math.min(512, stat.size));
      fs.readSync(fd, buffer, 0, buffer.length, 0);
      fs.closeSync(fd);
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }
    } catch {
      // ignore
    }
  }
  return false;
}

export function isSafeSymlink(targetPath: string, rootDir: string): boolean {
  try {
    const realTarget = fs.realpathSync(targetPath);
    const resolvedRoot = path.resolve(rootDir);
    const relative = path.relative(resolvedRoot, realTarget);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

export class GitWorkspaceService {
  async inspectRepository(repoPath: string): Promise<RepositoryWorkspace> {
    const resolvedPath = path.resolve(repoPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new NonGitRepositoryError(resolvedPath, 'Path does not exist');
    }

    const hasGitEntry = fs.existsSync(path.join(resolvedPath, '.git'));
    if (!hasGitEntry) {
      throw new NonGitRepositoryError(resolvedPath, 'Directory is not the root of a Git repository (missing .git)');
    }

    try {
      const { stdout: insideOut } = await execFileAsync('git', ['-C', resolvedPath, 'rev-parse', '--is-inside-work-tree']);
      if (insideOut.trim() !== 'true') {
        throw new NonGitRepositoryError(resolvedPath, 'Not inside a Git work tree');
      }
    } catch (err) {
      if (err instanceof NonGitRepositoryError) throw err;
      throw new NonGitRepositoryError(
        resolvedPath,
        err instanceof Error ? err.message : 'Failed to invoke git'
      );
    }

    // Current branch
    let currentBranch = 'unknown';
    try {
      const { stdout } = await execFileAsync('git', ['-C', resolvedPath, 'rev-parse', '--abbrev-ref', 'HEAD']);
      currentBranch = stdout.trim();
    } catch {
      try {
        const { stdout } = await execFileAsync('git', ['-C', resolvedPath, 'branch', '--show-current']);
        currentBranch = stdout.trim() || 'detached';
      } catch {
        currentBranch = 'main';
      }
    }

    // HEAD commit
    let headCommit = 'unknown';
    try {
      const { stdout } = await execFileAsync('git', ['-C', resolvedPath, 'rev-parse', 'HEAD']);
      headCommit = stdout.trim();
    } catch {
      headCommit = '0000000000000000000000000000000000000000';
    }

    // Dirty/Clean status
    let isClean = true;
    try {
      const { stdout } = await execFileAsync('git', ['-C', resolvedPath, 'status', '--porcelain']);
      isClean = stdout.trim().length === 0;
    } catch {
      isClean = false;
    }

    // Tracked files
    let trackedFiles: string[] = [];
    try {
      const { stdout } = await execFileAsync('git', ['-C', resolvedPath, 'ls-files']);
      trackedFiles = stdout
        .split(/\r?\n/)
        .map((f) => f.trim())
        .filter((f) => f.length > 0 && !isSensitivePath(f));
    } catch {
      trackedFiles = [];
    }

    // Package manifests & build scripts (supporting monorepos)
    const manifests = this.findPackageManifests(resolvedPath);
    const buildScripts: Record<string, string> = {};
    for (const manifest of manifests) {
      for (const [key, cmd] of Object.entries(manifest.scripts)) {
        if (!buildScripts[key]) {
          buildScripts[key] = cmd;
        }
      }
    }

    // Language signals
    const detectedLanguages = this.detectLanguages(trackedFiles);

    // Framework signals
    const detectedFrameworks = this.detectFrameworks(manifests);

    // Major directories
    const majorDirectories = this.getMajorDirectories(resolvedPath);

    return RepositoryWorkspaceSchema.parse({
      repositoryPath: resolvedPath,
      currentBranch,
      headCommit,
      isClean,
      detectedLanguages,
      detectedFrameworks,
      packageManifests: manifests,
      buildScripts,
      majorDirectories,
      trackedFileCount: trackedFiles.length,
    });
  }

  /**
   * Computes an immutable repository fingerprint against the current repository state.
   */
  async computeFingerprint(repoPath: string, repositoryId: string = 'repo-default'): Promise<RepositoryFingerprint> {
    const resolvedPath = path.resolve(repoPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Repository path '${resolvedPath}' does not exist.`);
    }

    const { stdout: gitRootOut } = await execFileAsync('git', ['-C', resolvedPath, 'rev-parse', '--show-toplevel']);
    const gitRoot = path.resolve(gitRootOut.trim());

    const { stdout: headOut } = await execFileAsync('git', ['-C', resolvedPath, 'rev-parse', 'HEAD']);
    const headCommit = headOut.trim();

    let branch = 'unknown';
    try {
      const { stdout: branchOut } = await execFileAsync('git', ['-C', resolvedPath, 'rev-parse', '--abbrev-ref', 'HEAD']);
      branch = branchOut.trim();
    } catch {
      branch = 'detached';
    }

    const { stdout: statusOut } = await execFileAsync('git', ['-C', resolvedPath, 'status', '--porcelain']);
    const dirtyLines = statusOut.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const isClean = dirtyLines.length === 0;

    let initialCommit = headCommit;
    try {
      const { stdout: rootOut } = await execFileAsync('git', ['-C', resolvedPath, 'rev-list', '--max-parents=0', 'HEAD']);
      const roots = rootOut.trim().split(/\r?\n/);
      initialCommit = roots[0] || headCommit;
    } catch {
      initialCommit = headCommit;
    }

    let remoteUrl: string | undefined;
    try {
      const { stdout: remoteOut } = await execFileAsync('git', ['-C', resolvedPath, 'config', '--get', 'remote.origin.url']);
      remoteUrl = remoteOut.trim() || undefined;
    } catch {
      remoteUrl = undefined;
    }

    return RepositoryFingerprintSchema.parse({
      repositoryId,
      gitRoot,
      headCommit,
      branch,
      isClean,
      dirtyFilesCount: dirtyLines.length,
      initialCommit,
      remoteUrl,
      fingerprintedAt: new Date().toISOString(),
    });
  }

  /**
   * Validates repository identity before executing implementation or repair.
   * Catches moved, deleted, or replaced repositories.
   */
  async verifyRepositoryIdentity(
    canonicalLocalPath: string,
    expectedInitialCommit?: string,
    expectedGitRoot?: string
  ): Promise<{ valid: boolean; failureCode?: ProductFailureCode; reason?: string }> {
    const resolvedPath = path.resolve(canonicalLocalPath);

    if (!fs.existsSync(resolvedPath)) {
      return {
        valid: false,
        failureCode: 'REPOSITORY_UNAVAILABLE',
        reason: `Registered repository path '${resolvedPath}' does not exist on filesystem.`,
      };
    }

    const hasGit = fs.existsSync(path.join(resolvedPath, '.git'));
    if (!hasGit) {
      return {
        valid: false,
        failureCode: 'REPOSITORY_UNAVAILABLE',
        reason: `Directory '${resolvedPath}' is no longer a valid Git repository (missing .git).`,
      };
    }

    try {
      const { stdout: rootOut } = await execFileAsync('git', ['-C', resolvedPath, 'rev-parse', '--show-toplevel']);
      const actualGitRoot = path.resolve(rootOut.trim());

      if (
        expectedGitRoot &&
        path.resolve(expectedGitRoot).toLowerCase().replace(/\\/g, '/') !==
          actualGitRoot.toLowerCase().replace(/\\/g, '/')
      ) {
        return {
          valid: false,
          failureCode: 'REPOSITORY_IDENTITY_MISMATCH',
          reason: `Git root mismatch: expected '${expectedGitRoot}', but found '${actualGitRoot}'.`,
        };
      }

      if (expectedInitialCommit) {
        const { stdout: initOut } = await execFileAsync('git', ['-C', resolvedPath, 'rev-list', '--max-parents=0', 'HEAD']);
        const roots = initOut.trim().split(/\r?\n/);
        const actualInitialCommit = roots[0];

        if (actualInitialCommit && actualInitialCommit !== expectedInitialCommit) {
          return {
            valid: false,
            failureCode: 'REPOSITORY_IDENTITY_MISMATCH',
            reason: `Repository replacement detected: initial commit root '${actualInitialCommit}' does not match registered repository root '${expectedInitialCommit}'.`,
          };
        }
      }

      return { valid: true };
    } catch (err: unknown) {
      return {
        valid: false,
        failureCode: 'REPOSITORY_UNAVAILABLE',
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  public findPackageManifests(repoPath: string): PackageManifestSummary[] {
    const manifests: PackageManifestSummary[] = [];

    // 1. Root package.json
    const rootPkgPath = path.join(repoPath, 'package.json');
    if (fs.existsSync(rootPkgPath) && !isSensitivePath(rootPkgPath)) {
      const rootManifest = this.parseManifest(rootPkgPath, 'package.json');
      if (rootManifest) manifests.push(rootManifest);
    }

    // 2. Discover monorepo package.json in packages/*, apps/*, modules/*
    const subDirs = ['packages', 'apps', 'modules', 'services'];
    for (const sub of subDirs) {
      const parentDir = path.join(repoPath, sub);
      if (fs.existsSync(parentDir) && fs.statSync(parentDir).isDirectory()) {
        try {
          const entries = fs.readdirSync(parentDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const childPkgPath = path.join(parentDir, entry.name, 'package.json');
              if (fs.existsSync(childPkgPath) && !isSensitivePath(childPkgPath)) {
                const relPath = path.relative(repoPath, childPkgPath).replace(/\\/g, '/');
                const m = this.parseManifest(childPkgPath, relPath);
                if (m) manifests.push(m);
              }
            }
          }
        } catch {
          // ignore unreadable subdirectories
        }
      }
    }

    return manifests;
  }

  private parseManifest(fullPath: string, relPath: string): PackageManifestSummary | null {
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        path: relPath,
        name: typeof parsed.name === 'string' ? parsed.name : undefined,
        version: typeof parsed.version === 'string' ? parsed.version : undefined,
        dependencies: typeof parsed.dependencies === 'object' && parsed.dependencies !== null ? parsed.dependencies : {},
        devDependencies: typeof parsed.devDependencies === 'object' && parsed.devDependencies !== null ? parsed.devDependencies : {},
        scripts: typeof parsed.scripts === 'object' && parsed.scripts !== null ? parsed.scripts : {},
      };
    } catch {
      return null;
    }
  }

  private detectLanguages(files: string[]): string[] {
    const langs = new Set<string>();
    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (ext === '.ts' || ext === '.tsx') langs.add('TypeScript');
      else if (ext === '.js' || ext === '.mjs' || ext === '.cjs' || ext === '.jsx') langs.add('JavaScript');
      else if (ext === '.py') langs.add('Python');
      else if (ext === '.go') langs.add('Go');
      else if (ext === '.rs') langs.add('Rust');
      else if (ext === '.java') langs.add('Java');
    }
    return Array.from(langs);
  }

  private detectFrameworks(manifests: PackageManifestSummary[]): string[] {
    const frameworks = new Set<string>();
    const frameworkMap: Record<string, string> = {
      express: 'Express',
      fastify: 'Fastify',
      koa: 'Koa',
      next: 'Next.js',
      react: 'React',
      vue: 'Vue',
      redis: 'Redis',
      ioredis: 'Redis',
      pg: 'PostgreSQL',
      knex: 'Knex',
      prisma: 'Prisma',
      kafkajs: 'Kafka',
      sharp: 'Sharp (Image Processing)',
      jimp: 'Jimp',
    };

    for (const manifest of manifests) {
      const allDeps = { ...manifest.dependencies, ...manifest.devDependencies };
      for (const [dep, label] of Object.entries(frameworkMap)) {
        if (dep in allDeps) {
          frameworks.add(label);
        }
      }
    }

    return Array.from(frameworks);
  }

  private getMajorDirectories(repoPath: string): string[] {
    try {
      const entries = fs.readdirSync(repoPath, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && !isSensitivePath(e.name))
        .map((e) => e.name);
    } catch {
      return [];
    }
  }
}
