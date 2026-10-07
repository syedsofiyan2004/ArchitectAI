import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';

export interface ArtifactStorageOptions {
  baseDir?: string;
  maxSizeBytes?: number;
}

export interface StoreArtifactResult {
  relativePath: string;
  contentHash: string;
  sizeBytes: number;
}

export class BoundedArtifactStorage {
  private readonly baseDir: string;
  private readonly maxSizeBytes: number;

  constructor(options: ArtifactStorageOptions = {}) {
    this.baseDir = path.resolve(options.baseDir || path.resolve(process.cwd(), 'data/artifacts'));
    this.maxSizeBytes = options.maxSizeBytes || 5 * 1024 * 1024; // 5 MB

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public getBaseDir(): string {
    return this.baseDir;
  }

  public storeArtifact(runId: string, filename: string, content: string | Buffer): StoreArtifactResult {
    const safeRunId = this.sanitizeIdentifier(runId);
    const safeFilename = this.sanitizeIdentifier(filename);

    const runDir = path.resolve(this.baseDir, safeRunId);
    const targetPath = path.resolve(runDir, safeFilename);

    // Path traversal defense
    this.assertPathInsideBase(targetPath);

    if (!fs.existsSync(runDir)) {
      fs.mkdirSync(runDir, { recursive: true });
    }

    let finalContent: Buffer;
    if (typeof content === 'string') {
      const buf = Buffer.from(content, 'utf-8');
      if (buf.length > this.maxSizeBytes) {
        const excess = buf.length - this.maxSizeBytes;
        const notice = `\n\n[... Truncated ${excess} bytes of content ...]`;
        const noticeLen = Buffer.byteLength(notice, 'utf-8');
        const allowedPrefixLen = Math.max(0, this.maxSizeBytes - noticeLen);
        const truncatedStr = buf.subarray(0, allowedPrefixLen).toString('utf-8') + notice;
        finalContent = Buffer.from(truncatedStr, 'utf-8');
      } else {
        finalContent = buf;
      }
    } else {
      if (content.length > this.maxSizeBytes) {
        finalContent = content.subarray(0, this.maxSizeBytes);
      } else {
        finalContent = content;
      }
    }

    fs.writeFileSync(targetPath, finalContent);

    const hash = crypto.createHash('sha256').update(finalContent).digest('hex');
    const relativePath = path.relative(this.baseDir, targetPath).replace(/\\/g, '/');

    return {
      relativePath,
      contentHash: hash,
      sizeBytes: finalContent.length,
    };
  }

  public readArtifact(runId: string, filename: string): string {
    const safeRunId = this.sanitizeIdentifier(runId);
    const safeFilename = this.sanitizeIdentifier(filename);
    const targetPath = path.resolve(this.baseDir, safeRunId, safeFilename);

    this.assertPathInsideBase(targetPath);

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Artifact '${filename}' for run '${runId}' does not exist.`);
    }

    return fs.readFileSync(targetPath, 'utf-8');
  }

  private sanitizeIdentifier(name: string): string {
    if (!name || typeof name !== 'string') {
      throw new Error('Invalid identifier: empty');
    }
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
      throw new Error(`Access denied: Identifier '${name}' contains directory traversal or separator characters.`);
    }
    const cleaned = name.trim();
    if (cleaned.length === 0) {
      throw new Error(`Invalid identifier: '${name}'`);
    }
    return cleaned;
  }

  private assertPathInsideBase(targetPath: string): void {
    const relative = path.relative(this.baseDir, targetPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Access denied: Target path '${targetPath}' attempts traversal outside '${this.baseDir}'.`);
    }
  }
}
