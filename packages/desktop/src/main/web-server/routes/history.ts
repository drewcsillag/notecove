/**
 * History API Routes
 *
 * REST endpoints for note history operations.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getServices, hasServices, sendError, handleServiceError } from './context';

/**
 * Route parameters with note ID
 */
interface NoteParams {
  noteId: string;
}

/**
 * Register history routes
 */
export function registerHistoryRoutes(fastify: FastifyInstance): void {
  // Get timeline for a note
  fastify.get<{ Params: NoteParams }>(
    '/api/notes/:noteId/history/timeline',
    async (request: FastifyRequest<{ Params: NoteParams }>, reply: FastifyReply) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { noteId } = request.params;

      try {
        const services = getServices();
        const timeline = await services.historyGetTimeline(noteId);
        return timeline;
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );

  // Get stats for a note
  fastify.get<{ Params: NoteParams }>(
    '/api/notes/:noteId/history/stats',
    async (request: FastifyRequest<{ Params: NoteParams }>, reply: FastifyReply) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { noteId } = request.params;

      try {
        const services = getServices();
        const stats = await services.historyGetStats(noteId);
        return stats;
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );
}
