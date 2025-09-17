# fluid-fetch β

A lightweight and flexible HTTP client for JavaScript and TypeScript applications, providing a fluid/chainable API for making HTTP requests. FluidFetch is designed to be tiny yet powerful, making it perfect for client-side applications where bundle size matters.

## Features

- 🔄 **Chainable API** - Build requests with a fluent interface
- 🚀 **Promise-based** - Works with async/await and Promise methods
- 💾 **Caching** - Built-in request caching with configurable TTL
- ⏱️ **Timeouts** - Automatic request timeout handling
- 🔌 **Middleware support** - Intercept and modify requests and responses
- 🔄 **Request cancellation** - Cancel ongoing requests
- 📦 **TypeScript support** - Full TypeScript definitions included

## Installation

```bash
npm i fluid-fetch
```

## Basic Usage

```typescript
import FluidFetch from 'fluid-fetch';

const api = new FluidFetch();

// Simple GET request
const response = await api.get('https://api.example.com/users');
const data = await response.json();

// POST request with data
const createUser = await api.post('https://api.example.com/users', {
  name: 'Dwight Schrute',
  email: 'schrute@dundermifflin.com'
});
```

## Chainable API

FluidFetch provides a fluent interface for configuring requests:

```typescript
const response = await api.get('https://api.example.com/posts')
  .headers({
    'Authorization': 'Bearer token123',
    'Accept': 'application/json'
  })
  .params({
    page: 1,
    limit: 20,
    sort: 'newest'
  })
  .cache(true)
  .timeout(5000);

const data = await response.json();
```

## Request Methods

FluidFetch supports all common HTTP methods:

```typescript
// GET request
api.get(url, config);

// POST request with data
api.post(url, data, config);

// PUT request with data
api.put(url, data, config);

// DELETE request
api.delete(url, config);
```

## Request Configuration

You can configure requests in two ways:
1. Pass a config object when creating the request
2. Use the chainable methods

```typescript
// Method 1: Config object
api.get('https://api.example.com/users', {
  headers: {
    'Authorization': 'Bearer token123'
  },
  params: {
    active: true
  },
  cache: true,
  timeout: 5000
});

// Method 2: Chainable methods (preferred)
api.get('https://api.example.com/users')
  .headers({
    'Authorization': 'Bearer token123'
  })
  .params({
    active: true
  })
  .cache(true)
  .timeout(5000);
```

## Caching

FluidFetch includes built-in request caching:

```typescript
// Enable caching with default TTL (1 hour)
api.get('https://api.example.com/users').cache(true);

// Specify cache TTL in milliseconds (e.g., 5 minutes)
api.get('https://api.example.com/users').cache(5 * 60 * 1000);
```

## Timeouts

Set request timeouts to avoid hanging requests:

```typescript
// Timeout after 5 seconds (5000ms)
api.get('https://api.example.com/users').timeout(5000);
```

## Request Cancellation

Cancel in-flight requests:

```typescript
const request = api.get('https://api.example.com/large-data');

// Later in your code
request.cancel();
```

## Middleware Support

FluidFetch provides powerful middleware support for both requests and responses:

```typescript
// Request middleware
api.middlewares.request.use((request) => {
  // Add authorization token to all requests
  request.headers['Authorization'] = 'Bearer ' + getToken();
  return request;
});

// Response middleware
api.middlewares.response.use((response) => {
  // Log all responses
  console.log('Response received', response.status);
  return response;
});
```

### Error Handling in Middleware

```typescript
api.middlewares.request.use(
  // Success handler
  (request) => {
    // Modify request
    return request;
  },
  // Error handler
  (error) => {
    console.error('Request middleware error:', error);
    throw error; // Re-throw or handle as needed
  }
);
```

## TypeScript Support

FluidFetch includes full TypeScript definitions and supports generic type parameters:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// Specify the expected response type
const response = await api.get<User>('https://api.example.com/users/1');
const user = await response.json();
// user is now of type User
```