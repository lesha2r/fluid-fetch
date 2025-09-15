import MwManager from './MwManager.js';

// Type definitions
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Custom error class for request timeouts
class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

interface RequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  cache?: boolean | number;
  timeout?: number; // Request timeout in milliseconds
}

interface CacheEntry {
  response: Response;
  expires: number; // Timestamp when this entry expires
}

interface RequestMiddleware {
  (request: Request): Promise<Request> | Request;
}

interface ResponseMiddleware {
  (response: Response): Promise<Response> | Response;
}

interface Request {
  method: HttpMethod;
  url: string;
  data: any | null;
  headers: Record<string, string>;
  params: Record<string, string | number | boolean>;
  cache?: boolean | number;
  timeout?: number;
  abortController: AbortController;
}

class FluidFetch {
  private cache: Map<string, CacheEntry>;
  private pendingRequests: Map<string, AbortController>;
  
  // API for middleware functionality
  middlewares: {
    request: MwManager<Request>;
    response: MwManager<Response>;
  };

  constructor() {
    this.cache = new Map<string, CacheEntry>();
    this.pendingRequests = new Map<string, AbortController>();
    
    // Set up the middlewares object
    this.middlewares = {
      request: new MwManager<Request>(),
      response: new MwManager<Response>()
    };
  }

  // Main methods
  public get<T = any>(url: string, config: RequestConfig = {}): FluidFetchRequest<T> {
    return this._createRequest<T>('GET', url, null, config);
  }

  public post<T = any>(url: string, data: any = null, config: RequestConfig = {}): FluidFetchRequest<T> {
    return this._createRequest<T>('POST', url, data, config);
  }

  public put<T = any>(url: string, data: any = null, config: RequestConfig = {}): FluidFetchRequest<T> {
    return this._createRequest<T>('PUT', url, data, config);
  }

  public delete<T = any>(url: string, config: RequestConfig = {}): FluidFetchRequest<T> {
    return this._createRequest<T>('DELETE', url, null, config);
  }

  // Request creation
  private _createRequest<T>(method: HttpMethod, url: string, data: any = null, config: RequestConfig = {}): FluidFetchRequest<T> {
    const request: Request = {
      method,
      url,
      data,
      headers: { ...(config.headers || {}) },
      params: { ...(config.params || {}) },
      cache: config.cache,
      timeout: config.timeout,
      abortController: new AbortController()
    };

    return new FluidFetchRequest<T>(this, request);
  }

  // Helper methods
  _getCacheKey(request: Request): string {
    return `${request.method}:${request.url}:${JSON.stringify(request.params)}`;
  }

  _buildUrl(url: string, params: Record<string, string | number | boolean> | undefined): string {
    if (!params || Object.keys(params).length === 0) return url;
    
    const query = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    return `${url}?${query}`;
  }

  // Methods to manage cache and pending requests (added to support FluidFetchRequest)
  public getCachedResponse(cacheKey: string): Response | undefined {
    const entry = this.cache.get(cacheKey);
    
    // If entry exists and is not expired
    if (entry && entry.expires > Date.now()) {
      return entry.response;
    }
    
    // If entry exists but is expired, remove it
    if (entry) {
      this.cache.delete(cacheKey);
    }
    
    return undefined;
  }

  public getPendingRequest(cacheKey: string): AbortController | undefined {
    return this.pendingRequests.get(cacheKey);
  }

  public registerPendingRequest(cacheKey: string, controller: AbortController): void {
    this.pendingRequests.set(cacheKey, controller);
  }

  public removePendingRequest(cacheKey: string): void {
    this.pendingRequests.delete(cacheKey);
  }

  public cacheResponse(cacheKey: string, response: Response, ttl?: number): void {
    // Default TTL is 1 hour if ttl is true or undefined
    const duration = typeof ttl === 'number' ? ttl : 3600000;
    
    const entry: CacheEntry = {
      response: response,
      expires: Date.now() + duration
    };
    
    this.cache.set(cacheKey, entry);
  }

  /**
   * Clears all request middleware handlers
   */
  public clearRequestMiddlewares(): void {
    this.middlewares.request.clear();
  }

  /**
   * Clears all response middleware handlers
   */
  public clearResponseMiddlewares(): void {
    this.middlewares.response.clear();
  }
}

class FluidFetchRequest<T = any> implements PromiseLike<Response> {
  private fluidFetch: FluidFetch;
  private request: Request;
  private promise: Promise<Response> | null;

  constructor(fluidFetch: FluidFetch, request: Request) {
    this.fluidFetch = fluidFetch;
    this.request = request;
    this.promise = null;
  }

  // Chainable methods
  public headers(headers: Record<string, string>): FluidFetchRequest<T> {
    Object.assign(this.request.headers, headers);
    return this;
  }

  public params(params: Record<string, string | number | boolean>): FluidFetchRequest<T> {
    Object.assign(this.request.params, params);
    return this;
  }

  public body(data: any): FluidFetchRequest<T> {
    this.request.data = data;
    return this;
  }

  public cache(ttl: boolean | number): FluidFetchRequest<T> {
    // Store the TTL duration directly rather than as a timestamp
    this.request.cache = typeof ttl === 'boolean' ? 
      60 * 60 * 1000 :  // 10 minutes default in milliseconds
      ttl;
    return this;
  }

  public timeout(ms: number): FluidFetchRequest<T> {
    // Set the timeout in milliseconds
    this.request.timeout = ms;
    return this;
  }

  public cancel(): FluidFetchRequest<T> {
    this.request.abortController.abort();
    return this;
  }

  // Promise execution
  public then<TResult1 = Response, TResult2 = never>(
    onFulfilled?: ((value: Response) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): PromiseLike<TResult1 | TResult2> {
    if (!this.promise) {
      this.promise = this._executeRequest();
    }
    return this.promise.then(onFulfilled, onRejected);
  }

  public catch<TResult = never>(
    onRejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
  ): PromiseLike<Response | TResult> {
    if (!this.promise) {
      this.promise = this._executeRequest();
    }
    return this.promise.catch(onRejected);
  }

  private async _executeRequest(): Promise<Response> {
    // Apply request middlewares
    let request = this.request;
    
    // Run request through the middleware manager
    request = await this.fluidFetch.middlewares.request.runMiddlewares(request);

    const cacheKey = this.fluidFetch._getCacheKey(request);
    
    // Check cache
    if (request.cache) {
      // We need to access the private cache using a method that needs to be added to FluidFetch
      const cachedResponse = this.fluidFetch.getCachedResponse(cacheKey);
      if (cachedResponse) {
        return cachedResponse.clone();
      }
    }

    // Cancel duplicate requests
    // We need to access the private pendingRequests using a method that needs to be added to FluidFetch
    const pendingController = this.fluidFetch.getPendingRequest(cacheKey);
    if (pendingController) {
      pendingController.abort();
    }

    // Register this request as pending
    this.fluidFetch.registerPendingRequest(cacheKey, request.abortController);

    // Setup timeout if specified
    let timeoutId: NodeJS.Timeout | undefined;
    if (request.timeout && request.timeout > 0) {
      timeoutId = setTimeout(() => {
        // Abort the request on timeout with a custom error
        const timeoutError = new TimeoutError(`Request timed out after ${request.timeout}ms`);
        request.abortController.abort(timeoutError);
      }, request.timeout);
    }

    try {
      const response = await fetch(this.fluidFetch._buildUrl(request.url, request.params), {
        method: request.method,
        headers: request.headers,
        body: request.data ? JSON.stringify(request.data) : undefined,
        signal: request.abortController.signal
      });

      // Apply response middlewares
      let processedResponse = response;
      
      // Run response through the middleware manager
      processedResponse = await this.fluidFetch.middlewares.response.runMiddlewares(processedResponse);

      // Caching
      if (request.cache) {
        // Pass the TTL duration directly
        this.fluidFetch.cacheResponse(
          cacheKey, 
          processedResponse.clone(), 
          typeof request.cache === 'boolean' ? undefined : request.cache
        );
      }

      return processedResponse;
    } finally {
      // Clear the timeout to prevent memory leaks
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Remove from pending requests
      this.fluidFetch.removePendingRequest(cacheKey);
    }
  }
}

export { TimeoutError, MwManager, RequestMiddleware, ResponseMiddleware };
export default FluidFetch;