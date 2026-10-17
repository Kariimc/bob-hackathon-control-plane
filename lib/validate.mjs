/**
 * lib/validate.mjs
 *
 * Two exports:
 *   readBody(request, maxBytes?)  — streams + parses JSON request body
 *   validate(schema, data)        — checks shape of a plain object
 *
 * Both throw a ValidationError on failure. The server catches these and
 * sends a 400 response with the error message.
 */

export class ValidationError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const DEFAULT_MAX_BYTES = 64 * 1024; // 64 KiB — generous for this workload

/**
 * Consume and JSON-parse the request body.
 *
 * @param {import('node:http').IncomingMessage} request
 * @param {number} [maxBytes]
 * @returns {Promise<unknown>}
 */
export function readBody(request, maxBytes = DEFAULT_MAX_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        request.destroy();
        reject(new ValidationError('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        reject(new ValidationError('Request body is empty'));
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new ValidationError('Request body is not valid JSON'));
      }
    });

    request.on('error', (error) => reject(error));
  });
}

/**
 * Validate a plain object against a field schema.
 *
 * Schema format:
 *   { fieldName: 'string' | 'string?' | 'string:N' }
 *   'string'    — required, must be a non-empty string
 *   'string?'   — optional, but if present must be a string
 *   'string:N'  — required, non-empty, max N characters (e.g. 'string:200')
 *   'string?:N' — optional, max N characters when present
 *
 * @param {Record<string, string>} schema
 * @param {unknown} data
 * @returns {Record<string, string>} validated subset of data
 */
export function validate(schema, data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  const out = {};
  for (const [field, type] of Object.entries(schema)) {
    // Parse type token: 'string', 'string?', 'string:200', 'string?:200'
    const optional = type.startsWith('string?');
    const colonPos = type.indexOf(':');
    const maxLen = colonPos >= 0 ? Number(type.slice(colonPos + 1)) : Infinity;

    const value = /** @type {Record<string,unknown>} */ (data)[field];
    if (value === undefined || value === null) {
      if (!optional) throw new ValidationError(`Missing required field: ${field}`);
      continue;
    }
    if (typeof value !== 'string') {
      throw new ValidationError(`Field "${field}" must be a string`);
    }
    if (!optional && value.trim() === '') {
      throw new ValidationError(`Field "${field}" must not be empty`);
    }
    if (Number.isFinite(maxLen) && value.length > maxLen) {
      throw new ValidationError(`Field "${field}" must not exceed ${maxLen} characters`);
    }
    out[field] = value;
  }
  return out;
}
