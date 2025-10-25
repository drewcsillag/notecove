/**
 * Logging and error handling
 */

export * from './types';
export { ConsoleLogger } from './console-logger';
export {
  SimpleErrorHandlerRegistry,
  getGlobalErrorRegistry,
  setGlobalErrorRegistry,
  registerErrorHandler,
  unregisterErrorHandler,
  handleError,
  withErrorHandling,
} from './error-handler';
