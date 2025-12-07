/**
 * Tests for Route Handler Context
 */

import type { FastifyReply } from 'fastify';
import {
  setRouteContext,
  getRouteContext,
  getServices,
  hasServices,
  sendError,
  handleServiceError,
  type ServiceHandlers,
} from '../context';

// Mock FastifyReply
interface MockReply extends FastifyReply {
  status: jest.Mock;
  send: jest.Mock;
}

const createMockReply = (): MockReply => {
  const reply = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return reply as unknown as MockReply;
};

describe('Route Handler Context', () => {
  // Reset context before each test
  beforeEach(() => {
    setRouteContext({ services: null });
  });

  describe('setRouteContext / getRouteContext', () => {
    it('should set and get route context', () => {
      const mockServices = {} as ServiceHandlers;
      setRouteContext({ services: mockServices });

      const context = getRouteContext();
      expect(context.services).toBe(mockServices);
    });

    it('should start with null services', () => {
      const context = getRouteContext();
      expect(context.services).toBeNull();
    });
  });

  describe('hasServices', () => {
    it('should return false when services are null', () => {
      expect(hasServices()).toBe(false);
    });

    it('should return true when services are set', () => {
      setRouteContext({ services: {} as ServiceHandlers });
      expect(hasServices()).toBe(true);
    });
  });

  describe('getServices', () => {
    it('should throw error when services are not configured', () => {
      expect(() => getServices()).toThrow('Services not configured');
    });

    it('should return services when configured', () => {
      const mockServices = {} as ServiceHandlers;
      setRouteContext({ services: mockServices });

      const services = getServices();
      expect(services).toBe(mockServices);
    });
  });

  describe('sendError', () => {
    it('should send error response with status code and message', () => {
      const reply = createMockReply();

      sendError(reply, 404, 'Not Found', 'Resource not found');

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Resource not found',
        statusCode: 404,
      });
    });

    it('should use error as message when message is not provided', () => {
      const reply = createMockReply();

      sendError(reply, 500, 'Internal Server Error');

      expect(reply.send).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Internal Server Error',
        statusCode: 500,
      });
    });

    it('should handle various status codes', () => {
      const testCases = [
        { code: 400, error: 'Bad Request' },
        { code: 401, error: 'Unauthorized' },
        { code: 403, error: 'Forbidden' },
        { code: 409, error: 'Conflict' },
        { code: 503, error: 'Service Unavailable' },
      ];

      testCases.forEach(({ code, error }) => {
        const reply = createMockReply();
        sendError(reply, code, error);
        expect(reply.status).toHaveBeenCalledWith(code);
      });
    });
  });

  describe('handleServiceError', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log the error', () => {
      const reply = createMockReply();
      const error = new Error('Test error');

      handleServiceError(reply, error);

      expect(consoleSpy).toHaveBeenCalledWith('[API] Service error:', error);
    });

    it('should return 404 for not found errors', () => {
      const reply = createMockReply();
      const error = new Error('Resource not found');

      handleServiceError(reply, error);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Not Found',
          statusCode: 404,
        })
      );
    });

    it('should return 404 for "Not found" errors (capitalized)', () => {
      const reply = createMockReply();
      const error = new Error('Note Not found');

      handleServiceError(reply, error);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should return 409 for conflict errors', () => {
      const reply = createMockReply();
      const error = new Error('Resource already exists');

      handleServiceError(reply, error);

      expect(reply.status).toHaveBeenCalledWith(409);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Conflict',
          statusCode: 409,
        })
      );
    });

    it('should return 409 for "conflict" errors', () => {
      const reply = createMockReply();
      const error = new Error('Naming conflict detected');

      handleServiceError(reply, error);

      expect(reply.status).toHaveBeenCalledWith(409);
    });

    it('should return 400 for invalid errors', () => {
      const reply = createMockReply();
      const error = new Error('invalid parameter');

      handleServiceError(reply, error);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          statusCode: 400,
        })
      );
    });

    it('should return 400 for "Invalid" errors (capitalized)', () => {
      const reply = createMockReply();
      const error = new Error('Invalid note ID format');

      handleServiceError(reply, error);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 for unknown errors', () => {
      const reply = createMockReply();
      const error = new Error('Some unexpected error');

      handleServiceError(reply, error);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
          statusCode: 500,
        })
      );
    });

    it('should return 500 for non-Error objects', () => {
      const reply = createMockReply();

      handleServiceError(reply, 'string error');

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should return 500 for null/undefined errors', () => {
      const reply = createMockReply();

      handleServiceError(reply, null);

      expect(reply.status).toHaveBeenCalledWith(500);

      const reply2 = createMockReply();
      handleServiceError(reply2, undefined);
      expect(reply2.status).toHaveBeenCalledWith(500);
    });
  });
});
