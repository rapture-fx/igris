/**
 * Authentication module exports
 */

export * from './auth-manager';
export { FileTokenStorage } from './token-storage';
export { BrowserTokenStorage, MemoryTokenStorage } from './token-storage.browser';

// Export the browser version of createTokenStorage as the main one
export { createTokenStorage } from './token-storage.browser';

export { AuthManager as default } from './auth-manager';