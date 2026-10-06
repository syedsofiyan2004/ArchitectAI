import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { KnowledgeSource, SourceSnapshot } from '@architectai/domain';
import { segmentDocument } from './knowledge-segmentation.js';
import { SafeDocumentationFetcher, SafeFetchOptions } from './safe-documentation-fetcher.js';

export interface KnowledgeSourceConnector {
  readonly id: string;
  canHandle(source: KnowledgeSource): boolean;
  retrieve(source: KnowledgeSource): Promise<SourceSnapshot>;
}

export class LocalFixtureConnector implements KnowledgeSourceConnector {
  readonly id = 'local-fixture';
  private readonly fixturesRoot: string;

  constructor(customFixturesRoot?: string) {
    this.fixturesRoot = path.resolve(
      process.cwd(),
      customFixturesRoot || 'packages/knowledge/src/fixtures'
    );
  }

  canHandle(source: KnowledgeSource): boolean {
    return source.canonicalUrl.startsWith('fixture://');
  }

  async retrieve(source: KnowledgeSource): Promise<SourceSnapshot> {
    const rawFixturePath = source.canonicalUrl.replace('fixture://', '');
    
    // Path traversal hardening
    const resolvedPath = path.resolve(this.fixturesRoot, rawFixturePath);
    const normalizedRoot = path.normalize(this.fixturesRoot) + path.sep;
    const normalizedTarget = path.normalize(resolvedPath);

    if (!normalizedTarget.startsWith(normalizedRoot) && normalizedTarget !== path.normalize(this.fixturesRoot)) {
      throw new Error(`Path traversal blocked: Fixture path "${rawFixturePath}" attempts to escape fixture root.`);
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Fixture not found: ${resolvedPath}`);
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      throw new Error(`Fixture path "${rawFixturePath}" is not a file.`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const sections = segmentDocument(content);

    return {
      id: `snapshot-${crypto.randomUUID()}`,
      sourceId: source.id,
      url: source.canonicalUrl,
      retrievedAt: new Date().toISOString(),
      contentHash: hash,
      title: `${source.publisher} ${source.technology || ''}`.trim(),
      normalizedTextContent: content,
      sections,
      documentMetadata: {
        fixturePath: rawFixturePath,
      },
    };
  }
}

export class HttpDocumentationConnector implements KnowledgeSourceConnector {
  readonly id = 'http-docs';
  private readonly fetcher: SafeDocumentationFetcher;

  constructor(fetchOptions?: SafeFetchOptions) {
    this.fetcher = new SafeDocumentationFetcher(fetchOptions);
  }

  canHandle(source: KnowledgeSource): boolean {
    return source.canonicalUrl.startsWith('http://') || source.canonicalUrl.startsWith('https://');
  }

  async retrieve(source: KnowledgeSource): Promise<SourceSnapshot> {
    const maxSizeBytes = source.retrievalPolicy?.maxSizeBytes;
    const { content, contentType } = await this.fetcher.fetch(source.canonicalUrl);

    if (maxSizeBytes && Buffer.byteLength(content, 'utf8') > maxSizeBytes) {
      throw new Error(`Content exceeds max size of ${maxSizeBytes} bytes.`);
    }

    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const sections = segmentDocument(content);

    return {
      id: `snapshot-${crypto.randomUUID()}`,
      sourceId: source.id,
      url: source.canonicalUrl,
      retrievedAt: new Date().toISOString(),
      contentHash: hash,
      title: `${source.publisher} ${source.technology || ''}`.trim(),
      normalizedTextContent: content,
      sections,
      documentMetadata: {
        contentType,
      },
    };
  }
}
