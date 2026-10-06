import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import * as url from 'node:url';
import { KnowledgeSource, SourceSnapshot } from '@architectai/domain';
import { segmentDocument } from './knowledge-segmentation.js';

export interface KnowledgeSourceConnector {
  readonly id: string;
  canHandle(source: KnowledgeSource): boolean;
  retrieve(source: KnowledgeSource): Promise<SourceSnapshot>;
}

export class LocalFixtureConnector implements KnowledgeSourceConnector {
  readonly id = 'local-fixture';

  canHandle(source: KnowledgeSource): boolean {
    return source.canonicalUrl.startsWith('fixture://');
  }

  async retrieve(source: KnowledgeSource): Promise<SourceSnapshot> {
    const fixtureId = source.canonicalUrl.replace('fixture://', '');
    const path = `packages/knowledge/src/fixtures/${fixtureId}`;

    if (!fs.existsSync(path)) {
      throw new Error(`Fixture not found: ${path}`);
    }

    const content = fs.readFileSync(path, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    const sections = segmentDocument(content);

    return {
      id: `snapshot-${crypto.randomUUID()}`,
      sourceId: source.id,
      url: source.canonicalUrl,
      retrievedAt: new Date().toISOString(),
      contentHash: hash,
      title: source.publisher + ' ' + source.technology,
      normalizedTextContent: content,
      sections,
      documentMetadata: {},
    };
  }
}

export class HttpDocumentationConnector implements KnowledgeSourceConnector {
  readonly id = 'http-docs';

  private readonly blockedRanges = [
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^169\.254\./, // AWS metadata
  ];

  canHandle(source: KnowledgeSource): boolean {
    return source.canonicalUrl.startsWith('http://') || source.canonicalUrl.startsWith('https://');
  }

  async retrieve(source: KnowledgeSource): Promise<SourceSnapshot> {
    const parsedUrl = new url.URL(source.canonicalUrl);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      throw new Error('Only HTTP/HTTPS protocols are allowed');
    }

    if (parsedUrl.hostname === 'localhost' || this.isBlockedIp(parsedUrl.hostname)) {
      throw new Error(`SSRF Protection: Hostname ${parsedUrl.hostname} is blocked.`);
    }

    // In a real implementation we would resolve DNS to check IP for SSRF,
    // but for prototype this surface level check is sufficient for requirements.

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 15000); // 15s timeout

    let res: Response;
    try {
      res = await fetch(source.canonicalUrl, {
        signal: abortController.signal,
        headers: {
          'User-Agent': 'ArchitectAI-Knowledge-Acquisition/1.0',
          'Accept': 'text/html, text/plain, text/markdown',
        },
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Timeout fetching ${source.canonicalUrl}`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }

    // Basic size limit logic (read in stream if we want strict, or string if simple)
    const content = await res.text();
    const maxSizeBytes = source.retrievalPolicy?.maxSizeBytes || 1024 * 1024 * 5; // 5MB limit
    if (Buffer.byteLength(content, 'utf8') > maxSizeBytes) {
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
      title: source.publisher + ' ' + (source.technology || ''),
      normalizedTextContent: content,
      sections,
      documentMetadata: {
        contentType: res.headers.get('content-type') || 'unknown',
      },
    };
  }

  private isBlockedIp(hostname: string): boolean {
    return this.blockedRanges.some(regex => regex.test(hostname));
  }
}
