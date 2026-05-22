/**
 * Evidence redaction.
 *
 * The console shows raw JSON evidence (receipts, envelopes, checkpoint metadata,
 * boundary records) so operators can inspect what actually happened. That JSON
 * must never carry secrets. This module deep-clones a value and replaces any
 * sensitive field with a redaction marker before the value is rendered or
 * exported.
 *
 * Redaction is conservative and key-name based: if a key *looks* sensitive it
 * is redacted even if the value appears harmless. Hashes, digests, signatures,
 * and reference IDs are intentionally NOT redacted — they are the proof surface
 * operators need, and they are not secrets.
 */

const REDACTED = '[redacted]';

// Substrings that, if present in a key name, mark the value as sensitive.
// Matched case-insensitively against the normalised key.
const SENSITIVE_KEY_PATTERNS: string[] = [
  'resume_token',
  'resumetoken',
  'secret',
  'password',
  'passwd',
  'private_key',
  'privatekey',
  'priv_key',
  'credential',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'bearer',
  'authorization',
  'auth_token',
  'session_token',
  'client_secret',
  'signing_key',
  'encryption_key',
  'env',
  'environment_variables',
  'cookie',
  'mnemonic',
  'seed_phrase',
];

// Keys that contain a sensitive substring but are themselves safe to show.
// (e.g. `runtime_capabilities` contains no secret; `public_key` is public.)
const SAFE_KEY_EXCEPTIONS: string[] = [
  'public_key',
  'publickey',
  'runtime_key_found',
  'environment_label',
  'env_label',
];

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[\s-]+/g, '_');
}

/** True when a key name should have its value redacted. */
export function isSensitiveKey(key: string): boolean {
  const normalised = normaliseKey(key);
  if (SAFE_KEY_EXCEPTIONS.some((safe) => normalised === safe || normalised.endsWith(`_${safe}`))) {
    return false;
  }
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalised.includes(pattern));
}

/**
 * Return a deep copy of `value` with every sensitive field replaced by a
 * redaction marker. Safe to call on any JSON-serialisable input, including
 * `undefined`/`null`. Arrays and nested objects are walked recursively.
 */
export function redactEvidence<T = unknown>(value: T): T {
  return redactInternal(value, new WeakSet()) as T;
}

function redactInternal(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value as object)) {
    return '[circular]';
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redactInternal(item, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      out[key] = REDACTED;
    } else {
      out[key] = redactInternal(child, seen);
    }
  }
  return out;
}

/**
 * Count how many fields were redacted in a value. Used to show an honest
 * "N sensitive fields hidden" note next to evidence panels.
 */
export function countRedactedFields(value: unknown): number {
  let count = 0;
  const walk = (node: unknown, seen: WeakSet<object>): void => {
    if (node === null || typeof node !== 'object') return;
    if (seen.has(node as object)) return;
    seen.add(node as object);
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, seen));
      return;
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        count += 1;
      } else {
        walk(child, seen);
      }
    }
  };
  walk(value, new WeakSet());
  return count;
}
