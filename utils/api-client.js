/**
 * Lumière Collection — Reusable API Client
 * Fetch wrapper with retry logic, timeout, and descriptive error handling.
 */

import fetch from 'node-fetch';

const DEFAULT_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Sleep for the given milliseconds.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make an API request with retry logic and exponential backoff.
 * @param {string} url
 * @param {object} options - fetch options
 * @param {object} config
 * @param {number} config.retries - number of retries (default 3)
 * @param {number} config.timeoutMs - request timeout in ms (default 30000)
 * @param {boolean} config.throwOnNon2xx - throw on non-2xx status (default true)
 * @returns {Promise<Response>}
 */
export async function apiRequest(url, options = {}, config = {}) {
  const { retries = DEFAULT_RETRIES, timeoutMs = DEFAULT_TIMEOUT_MS, throwOnNon2xx = true } = config;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (throwOnNon2xx && !response.ok) {
        const body = await response.text();
        throw new ApiError(
          `HTTP ${response.status} from ${url}: ${body.slice(0, 500)}`,
          response.status,
          body
        );
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;

      // Don't retry on auth errors or client errors (4xx except 429)
      if (err instanceof ApiError && err.status >= 400 && err.status !== 429 && err.status < 500) {
        throw err;
      }

      if (attempt < retries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await sleep(backoffMs);
      }
    }
  }

  throw lastError;
}

/**
 * Make a JSON API request.
 * @param {string} url
 * @param {object} options
 * @param {object} config
 * @returns {Promise<any>} Parsed JSON body
 */
export async function apiJson(url, options = {}, config = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const response = await apiRequest(url, { ...options, headers }, config);
  return response.json();
}

/**
 * Make a GraphQL request.
 * @param {string} url
 * @param {string} query - GraphQL query/mutation
 * @param {object} variables
 * @param {object} headers
 * @returns {Promise<object>} GraphQL data object
 */
export async function graphqlRequest(url, query, variables = {}, headers = {}) {
  const response = await apiJson(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    },
    { retries: 2 }
  );

  if (response.errors && response.errors.length > 0) {
    const messages = response.errors.map((e) => e.message).join('; ');
    throw new Error(`GraphQL errors: ${messages}`);
  }

  return response.data;
}

/**
 * Download binary content from a URL.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
export async function downloadBuffer(url, extraHeaders = {}) {
  const response = await apiRequest(url, { headers: extraHeaders }, { retries: 3 });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Custom API error class with HTTP status. */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {string} body
   */
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}
