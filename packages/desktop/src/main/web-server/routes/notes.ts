/**
 * Note API Routes
 *
 * REST endpoints for note operations.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getServices, hasServices, sendError, handleServiceError } from './context';

/**
 * Query parameters for listing notes
 */
interface ListNotesQuery {
  sdId?: string;
  folderId?: string;
}

/**
 * Query parameters for search
 */
interface SearchQuery {
  q?: string;
  limit?: string;
}

/**
 * Request body for creating a note
 */
interface CreateNoteBody {
  sdId?: string;
  folderId?: string | null;
  initialContent?: string;
}

/**
 * Request body for moving a note
 */
interface MoveNoteBody {
  folderId?: string | null;
}

/**
 * Route parameters with note ID
 */
interface NoteParams {
  id: string;
}

/**
 * Register note routes
 */
export function registerNoteRoutes(fastify: FastifyInstance): void {
  // List notes
  fastify.get<{ Querystring: ListNotesQuery }>(
    '/api/notes',
    async (request: FastifyRequest<{ Querystring: ListNotesQuery }>, reply: FastifyReply) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { sdId, folderId } = request.query;

      if (!sdId) {
        return sendError(reply, 400, 'Bad Request', 'sdId query parameter is required');
      }

      try {
        const services = getServices();
        const notes = await services.noteList(sdId, folderId ?? undefined);
        return notes;
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );

  // Get note metadata
  fastify.get<{ Params: NoteParams }>(
    '/api/notes/:id',
    async (request: FastifyRequest<{ Params: NoteParams }>, reply: FastifyReply) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { id } = request.params;

      try {
        const services = getServices();
        const metadata = await services.noteGetMetadata(id);
        return metadata;
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );

  // Create note
  fastify.post<{ Body: CreateNoteBody }>(
    '/api/notes',
    async (request: FastifyRequest<{ Body: CreateNoteBody }>, reply: FastifyReply) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { sdId, folderId, initialContent } = request.body;

      if (!sdId) {
        return sendError(reply, 400, 'Bad Request', 'sdId is required in request body');
      }

      try {
        const services = getServices();
        const noteId = await services.noteCreate(sdId, folderId ?? null, initialContent);
        reply.status(201);
        return { id: noteId };
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );

  // Delete note
  fastify.delete<{ Params: NoteParams }>(
    '/api/notes/:id',
    async (request: FastifyRequest<{ Params: NoteParams }>, reply: FastifyReply) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { id } = request.params;

      try {
        const services = getServices();
        await services.noteDelete(id);
        reply.status(204);
        return;
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );

  // Move note
  fastify.post<{ Params: NoteParams; Body: MoveNoteBody }>(
    '/api/notes/:id/move',
    async (
      request: FastifyRequest<{ Params: NoteParams; Body: MoveNoteBody }>,
      reply: FastifyReply
    ) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { id } = request.params;
      const { folderId } = request.body;

      try {
        const services = getServices();
        await services.noteMove(id, folderId ?? null);
        return { success: true };
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );

  // Search notes
  fastify.get<{ Querystring: SearchQuery }>(
    '/api/search',
    async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { q, limit } = request.query;

      if (!q) {
        return sendError(reply, 400, 'Bad Request', 'q query parameter is required');
      }

      try {
        const services = getServices();
        const limitNum = limit ? parseInt(limit, 10) : undefined;
        const results = await services.noteSearch(q, limitNum);
        return results;
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );

  // Load note (prepare for editing)
  fastify.post<{ Params: NoteParams }>(
    '/api/notes/:id/load',
    async (_request: FastifyRequest<{ Params: NoteParams }>, _reply: FastifyReply) => {
      // In the browser client, this is a no-op since we don't manage CRDT state on server
      return { success: true };
    }
  );

  // Unload note
  fastify.post<{ Params: NoteParams }>(
    '/api/notes/:id/unload',
    async (_request: FastifyRequest<{ Params: NoteParams }>, _reply: FastifyReply) => {
      // No-op for browser client
      return { success: true };
    }
  );

  // Get note state (CRDT state)
  fastify.get<{ Params: NoteParams }>(
    '/api/notes/:id/state',
    async (request: FastifyRequest<{ Params: NoteParams }>, reply: FastifyReply) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { id } = request.params;

      try {
        const services = getServices();
        const state = await services.noteGetState(id);
        return { state: Array.from(state) };
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );

  // Update note title
  fastify.post<{ Params: NoteParams; Body: { title?: string; contentText?: string } }>(
    '/api/notes/:id/title',
    async (
      _request: FastifyRequest<{
        Params: NoteParams;
        Body: { title?: string; contentText?: string };
      }>,
      _reply: FastifyReply
    ) => {
      // For the mock server, just acknowledge the update
      // In real implementation, this would update the note's title metadata
      return { success: true };
    }
  );

  // Restore deleted note
  fastify.post<{ Params: NoteParams }>(
    '/api/notes/:id/restore',
    async (request: FastifyRequest<{ Params: NoteParams }>, reply: FastifyReply) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { id } = request.params;

      try {
        const services = getServices();
        await services.noteRestore(id);
        return { success: true };
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );
}
