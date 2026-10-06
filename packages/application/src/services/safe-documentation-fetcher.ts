import * as dns from 'node:dns';
import * as net from 'node:net';
import * as url from 'node:url';

export interface SafeFetchOptions {
  maxSizeBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  allowHttpForTesting?: boolean;
  dnsResolver?: (hostname: string) => Promise<string[]>;
}

export function isBlockedIp(ip: string): boolean {
  // Check IPv4-mapped IPv6 like ::ffff:127.0.0.1
  if (ip.startsWith('::ffff:')) {
    const v4Part = ip.slice(7);
    if (net.isIPv4(v4Part)) {
      return isBlockedIp(v4Part);
    }
  }

  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return true; // invalid -> block
    }
    const [b0, b1] = parts;
    // 0.0.0.0/8 (unspecified)
    if (b0 === 0) return true;
    // 127.0.0.0/8 (loopback)
    if (b0 === 127) return true;
    // 10.0.0.0/8 (RFC1918)
    if (b0 === 10) return true;
    // 172.16.0.0/12 (RFC1918: 172.16.x - 172.31.x)
    if (b0 === 172 && b1 !== undefined && b1 >= 16 && b1 <= 31) return true;
    // 192.168.0.0/16 (RFC1918)
    if (b0 === 192 && b1 === 168) return true;
    // 169.254.0.0/16 (link-local, cloud metadata 169.254.169.254)
    if (b0 === 169 && b1 === 254) return true;
    // 224.0.0.0/4 (multicast)
    if (b0 !== undefined && b0 >= 224 && b0 <= 239) return true;
    // 240.0.0.0/4 (reserved) & 255.255.255.255 (broadcast)
    if (b0 !== undefined && b0 >= 240) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // :: (unspecified)
    if (normalized === '::' || normalized === '0000:0000:0000:0000:0000:0000:0000:0000') return true;
    // ::1 (loopback)
    if (normalized === '::1' || normalized.endsWith(':0001') || normalized === '0:0:0:0:0:0:0:1') return true;
    // fe80::/10 (link-local: starts with fe8, fe9, fea, feb)
    if (/^fe[89ab]/i.test(normalized)) return true;
    // fc00::/7 (unique local: fc00 - fdff)
    if (/^f[cd]/i.test(normalized)) return true;
    // ff00::/8 (multicast)
    if (/^ff/i.test(normalized)) return true;
    // IPv4-mapped IPv6
    if (normalized.includes('::ffff:')) {
      const parts = normalized.split(':');
      const last = parts[parts.length - 1];
      if (last && net.isIPv4(last)) {
        return isBlockedIp(last);
      }
    }
    return false;
  }

  return true; // Not valid IP -> block
}

export class SafeDocumentationFetcher {
  private readonly defaultMaxSizeBytes = 5 * 1024 * 1024; // 5MB
  private readonly defaultTimeoutMs = 15000;
  private readonly defaultMaxRedirects = 3;

  constructor(private readonly options: SafeFetchOptions = {}) {}

  async validateUrl(targetUrl: string): Promise<void> {
    let parsed: url.URL;
    try {
      parsed = new url.URL(targetUrl);
    } catch {
      throw new Error(`Invalid URL: ${targetUrl}`);
    }

    // Reject credentials embedded in URL
    if (parsed.username || parsed.password) {
      throw new Error(`SSRF Blocked: URL contains embedded credentials`);
    }

    // Protocol check: HTTPS required unless explicitly allowed for testing
    if (parsed.protocol !== 'https:') {
      if (!this.options.allowHttpForTesting || parsed.protocol !== 'http:') {
        throw new Error(`SSRF Blocked: HTTPS is required for documentation sources, received: ${parsed.protocol}`);
      }
    }

    const hostname = parsed.hostname;
    if (hostname.toLowerCase() === 'localhost' || hostname.toLowerCase().endsWith('.localhost')) {
      throw new Error(`SSRF Blocked: localhost is prohibited`);
    }

    // DNS resolution & IP check
    const isIp = net.isIP(hostname);
    if (isIp) {
      if (isBlockedIp(hostname)) {
        throw new Error(`SSRF Blocked: Destination IP ${hostname} belongs to private/restricted range`);
      }
    } else {
      let resolvedIps: string[];
      if (this.options.dnsResolver) {
        resolvedIps = await this.options.dnsResolver(hostname);
      } else {
        const lookupResult = await dns.promises.lookup(hostname, { all: true });
        resolvedIps = lookupResult.map(r => r.address);
      }

      if (resolvedIps.length === 0) {
        throw new Error(`DNS lookup yielded no addresses for ${hostname}`);
      }

      for (const ip of resolvedIps) {
        if (isBlockedIp(ip)) {
          throw new Error(`SSRF Blocked: Hostname ${hostname} resolved to private/restricted IP: ${ip}`);
        }
      }
    }
  }

  async fetch(targetUrl: string): Promise<{ content: string; contentType: string }> {
    const maxSizeBytes = this.options.maxSizeBytes ?? this.defaultMaxSizeBytes;
    const timeoutMs = this.options.timeoutMs ?? this.defaultTimeoutMs;
    const maxRedirects = this.options.maxRedirects ?? this.defaultMaxRedirects;

    let currentUrl = targetUrl;
    let redirectsRemaining = maxRedirects;

    while (true) {
      await this.validateUrl(currentUrl);

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'ArchitectAI-SafeDocumentationFetcher/1.0',
            'Accept': 'text/html, text/plain, text/markdown, application/xhtml+xml, application/json',
          },
          redirect: 'manual',
          signal: abortController.signal,
        });
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error(`Fetch timed out after ${timeoutMs}ms for ${currentUrl}`);
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }

      // Handle Redirects manually to validate each target destination before following
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new Error(`Redirect response (${response.status}) missing location header`);
        }
        if (redirectsRemaining <= 0) {
          throw new Error(`SSRF Blocked: Exceeded maximum allowed redirects (${maxRedirects})`);
        }
        redirectsRemaining--;

        const nextUrl = new url.URL(location, currentUrl).toString();
        currentUrl = nextUrl;
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText} for ${currentUrl}`);
      }

      const contentType = response.headers.get('content-type') || 'text/plain';
      const allowedContentTypes = [
        'text/html',
        'text/plain',
        'text/markdown',
        'application/xhtml+xml',
        'application/json',
        'text/xml',
      ];
      if (!allowedContentTypes.some(t => contentType.toLowerCase().includes(t))) {
        throw new Error(`SSRF / Content Validation Error: Unsupported content type "${contentType}". Must be text/documentation.`);
      }

      // Stream body and enforce maxSizeBytes BEFORE buffering complete content
      if (!response.body) {
        return { content: '', contentType };
      }

      const reader = response.body.getReader();
      let totalBytes = 0;
      const chunks: Uint8Array[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.byteLength;
            if (totalBytes > maxSizeBytes) {
              await reader.cancel();
              throw new Error(`Resource Limit Exceeded: Response size exceeded maximum limit of ${maxSizeBytes} bytes during streaming.`);
            }
            chunks.push(value);
          }
        }
      } catch (streamErr) {
        throw streamErr;
      }

      const fullBuffer = Buffer.concat(chunks);
      const content = fullBuffer.toString('utf-8');

      return { content, contentType };
    }
  }
}
