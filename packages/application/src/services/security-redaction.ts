/**
 * Central security redaction utility.
 * Guarantees that credentials, tokens, secret keys, passwords, and private keys
 * never leak into user-facing errors, telemetry, logs, or prompt contexts.
 */
export function redactSensitiveData(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  let text = input;

  // 1. Private keys (PEM format)
  text = text.replace(
    /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
    '[REDACTED PRIVATE KEY]'
  );

  // 2. OpenAI / Anthropic / LLM API keys: sk-..., ant-...
  text = text.replace(/sk-[a-zA-Z0-9_-]{16,}/g, 'sk-[REDACTED]');
  text = text.replace(/sk-ant-[a-zA-Z0-9_-]{16,}/g, 'sk-ant-[REDACTED]');

  // 3. GitHub personal access tokens
  text = text.replace(/(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{30,}/g, '$1_[REDACTED]');

  // 4. AWS Access Key IDs
  text = text.replace(/AKIA[0-9A-Z]{16}/g, 'AKIA[REDACTED]');

  // 5. Bearer tokens
  text = text.replace(/Bearer\s+[a-zA-Z0-9_.-]{16,}/gi, 'Bearer [REDACTED]');

  // 6. Passwords in database URIs (postgres://user:pass@host)
  text = text.replace(
    /(postgres|postgresql|mysql|redis|mongodb):\/\/([^:]+):([^@\s]+)@/gi,
    '$1://$2:[REDACTED]@'
  );

  // 7. Common JSON secret keys
  text = text.replace(
    /"(api[_-]?key|secret|password|auth[_-]?token|accessToken|refreshToken)"\s*:\s*"[^"]+"/gi,
    '"$1": "[REDACTED]"'
  );

  return text;
}
