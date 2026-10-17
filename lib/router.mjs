/**
 * Minimal request router.
 *
 * Usage:
 *   const router = new Router();
 *   router.get('/api/health', handler);
 *   router.post(/^\/api\/tasks\/([a-z0-9-]+)\/advance$/, handler);
 *   // In server: const matched = router.dispatch(request, response);
 *
 * Handlers receive (request, response, match) where match is the RegExp
 * match array (null for string patterns) so capture groups are accessible.
 *
 * dispatch() returns true when a handler was found, false otherwise.
 */
export class Router {
  #routes = [];

  #add(method, pattern, handler) {
    const regex = typeof pattern === 'string'
      ? new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
      : pattern;
    this.#routes.push({ method, regex, handler });
    return this;
  }

  get(pattern, handler) { return this.#add('GET', pattern, handler); }
  post(pattern, handler) { return this.#add('POST', pattern, handler); }
  delete(pattern, handler) { return this.#add('DELETE', pattern, handler); }

  /**
   * Dispatch a request to the first matching route.
   *
   * Async handlers are awaited; any rejection is forwarded to `onError`.
   * This prevents unhandled Promise rejections when route handlers are async.
   *
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:http').ServerResponse} response
   * @param {(err: unknown) => void} [onError] called if an async handler rejects
   * @returns {boolean} true if a route matched (handler may still be pending)
   */
  dispatch(request, response, onError) {
    const method = request.method ?? '';
    const pathname = (() => {
      try {
        return new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
      } catch {
        return '/';
      }
    })();

    for (const route of this.#routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.regex);
      if (match) {
        const result = route.handler(request, response, match);
        // If the handler returned a Promise, catch rejections and forward them.
        if (result && typeof result.catch === 'function' && onError) {
          result.catch(onError);
        }
        return true;
      }
    }
    return false;
  }
}
