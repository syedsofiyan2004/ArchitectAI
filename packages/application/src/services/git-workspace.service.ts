import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  RepositoryWorkspace,
  RepositoryWorkspaceSchema,
  PackageManifestSummary,
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
  /\.(pem|key|pfx|p12)$/i,
  /id_(rsa|dsa|ecdsa|ed25519)($|\.)/i,
  /(^|\/|\\)(credentials|secrets|token|auth)\.json$/i,
  /(^|\/|\\)\.git($|\/|\\)/i,
  /(^|\/|\\)node_modules($|\/|\\)/i,
  /(^|\/|\\)(dist|build|\.turbo|\.next|target)($|\/|\\)/i,
  /\.log$/i,
];

export function isSensitivePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export class GitWorkspaceService {
  async inspectRepository(repoPath: string): Promise<RepositoryWorkspace> {
    const resolvedPath = path.resolve(repoPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new NonGitRepositoryError(resolvedPath, 'Path does not exist');
    }

    // Verify git repository and that resolvedPath is the top level of this repository
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
      // In detached HEAD or fresh repo
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

    // Package manifests & build scripts
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

  private findPackageManifests(repoPath: string): PackageManifestSummary[] {
    const manifests: PackageManifestSummary[] = [];
    const rootPkgPath = path.join(repoPath, 'package.json');

    if (fs.existsSync(rootPkgPath) && !isSensitivePath(rootPkgPath)) {
      try {
        const raw = fs.readFileSync(rootPkgPath, 'utf-8');
        const parsed = JSON.parse(raw);
        manifests.push({
          path: 'package.json',
          name: typeof parsed.name === 'string' ? parsed.name : undefined,
          version: typeof parsed.version === 'string' ? parsed.version : undefined,
          dependencies: typeof parsed.dependencies === 'object' && parsed.dependencies !== null ? parsed.dependencies : {},
          devDependencies: typeof parsed.devDependencies === 'object' && parsed.devDependencies !== null ? parsed.devDependencies : {},
          scripts: typeof parsed.scripts === 'object' && parsed.scripts !== null ? parsed.scripts : {},
        });
      } catch {
        // ignore parse errors in unformatted manifests
      }
    }

    return manifests;
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
