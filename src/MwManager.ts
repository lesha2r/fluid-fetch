
/**
 * Manages middleware functions for requests or responses
 */
class MiddlewareManager<T> {
  private handlers: Array<{
    fulfilled: (value: T) => Promise<T> | T;
    rejected?: (error: any) => any;
    id: number;
  }> = [];
  private idCounter: number = 0;
  
  /**
   * Add a new middleware handler
   * @param fulfilled Function called with the request/response
   * @param rejected Optional function called when request/response fails
   * @returns ID used to remove this middleware handler later
   */
  use(
    fulfilled: (value: T) => Promise<T> | T,
    rejected?: (error: any) => any
  ): number {
    const id = this.idCounter++;
    
    this.handlers.push({
      fulfilled,
      rejected,
      id
    });
    
    return id;
  }
  
  /**
   * Remove a middleware handler by ID
   * @param id The ID of the middleware handler to remove
   */
  eject(id: number): void {
    const index = this.handlers.findIndex(handler => handler.id === id);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }
  
  /**
   * Clear all middleware handlers
   */
  clear(): void {
    this.handlers = [];
  }
  
  /**
   * Execute all middleware handlers in sequence
   * @param value The value to pass through middleware pipeline
   * @returns The final value after all middleware processing
   */
  async runMiddlewares(value: T): Promise<T> {
    let result = value;
    
    for (const handler of this.handlers) {
      try {
        result = await handler.fulfilled(result);
      } catch (error) {
        if (handler.rejected) {
          result = await handler.rejected(error);
        } else {
          throw error;
        }
      }
    }
    
    return result;
  }
}

export default MiddlewareManager