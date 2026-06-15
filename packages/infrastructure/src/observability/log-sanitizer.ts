const REDACTED = '[REDACTED]';
const TRUNCATED = '[TRUNCATED]';
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 2_000;
const MAX_SERIALIZED_BYTES = 16 * 1_024;

const sensitiveKeyPattern =
  /authorization|cookie|password|passphrase|secret|token|hash|credential|api[-_]?key/i;
const jwtPattern = /^Bearer\s+\S+|^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/i;

function sanitizeString(value: string): string {
  if (jwtPattern.test(value)) {
    return REDACTED;
  }

  let sanitized = value;

  try {
    const url = new URL(value);
    if (url.username || url.password) {
      url.username = '';
      url.password = '';
      sanitized = url.toString();
    }
  } catch {
    // Non-URL strings do not need URL credential sanitization.
  }

  if (sanitized.length > MAX_STRING_LENGTH) {
    return `${sanitized.slice(0, MAX_STRING_LENGTH)}${TRUNCATED}`;
  }

  return sanitized;
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > MAX_DEPTH) {
    return TRUNCATED;
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return sanitizeError(value, depth, seen);
  }

  if (typeof value !== 'object') {
    return typeof value === 'symbol' ? (value.description ?? 'Symbol') : `[${typeof value}]`;
  }

  if (seen.has(value)) {
    return '[CIRCULAR]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1, seen));

    if (value.length > MAX_ARRAY_ITEMS) {
      result.push(TRUNCATED);
    }

    return result;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) ? REDACTED : sanitizeValue(item, depth + 1, seen),
    ]),
  );
}

function sanitizeError(error: Error, depth = 0, seen = new WeakSet<object>()): unknown {
  const errorWithMetadata = error as Error & {
    code?: unknown;
    cause?: unknown;
  };

  return {
    name: error.name,
    message: sanitizeString(error.message),
    code: sanitizeValue(errorWithMetadata.code, depth + 1, seen),
    cause: sanitizeValue(errorWithMetadata.cause, depth + 1, seen),
    stack: error.stack ? sanitizeString(error.stack) : undefined,
  };
}

export function sanitizeLogValue(value: unknown): unknown {
  const sanitized = sanitizeValue(value, 0, new WeakSet<object>());
  const serialized = JSON.stringify(sanitized);

  if (serialized && Buffer.byteLength(serialized, 'utf8') > MAX_SERIALIZED_BYTES) {
    return {
      data: `${serialized.slice(0, MAX_SERIALIZED_BYTES)}${TRUNCATED}`,
      originalSizeBytes: Buffer.byteLength(serialized, 'utf8'),
    };
  }

  return sanitized;
}

export function sanitizeLogError(error: unknown): unknown {
  return error instanceof Error
    ? sanitizeError(error)
    : sanitizeLogValue({ message: String(error) });
}
