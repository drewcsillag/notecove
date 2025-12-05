/**
 * Diagnostics API Routes
 *
 * REST endpoints for diagnostics operations.
 */

import { FastifyInstance, FastifyReply } from 'fastify';
import { getServices, hasServices, sendError, handleServiceError } from './context';

/**
 * Register diagnostics routes
 */
export function registerDiagnosticsRoutes(fastify: FastifyInstance): void {
  // Get diagnostics status
  fastify.get('/api/diagnostics/status', async (_request, reply: FastifyReply) => {
    if (!hasServices()) {
      return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
    }

    try {
      const services = getServices();
      const status = await services.diagnosticsGetStatus();
      return status;
    } catch (err) {
      return handleServiceError(reply, err);
    }
  });
}
