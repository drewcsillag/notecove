/**
 * Folder API Routes
 *
 * REST endpoints for folder operations.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getServices, hasServices, sendError, handleServiceError } from './context';

/**
 * Query parameters for listing folders
 */
interface ListFoldersQuery {
  sdId?: string;
}

/**
 * Request body for creating a folder
 */
interface CreateFolderBody {
  sdId?: string;
  parentId?: string | null;
  name?: string;
}

/**
 * Request body for renaming a folder
 */
interface RenameFolderBody {
  name?: string;
}

/**
 * Request body for moving a folder
 */
interface MoveFolderBody {
  parentId?: string | null;
}

/**
 * Request body for reordering a folder
 */
interface ReorderFolderBody {
  order?: number;
}

/**
 * Route parameters with folder ID and sdId
 */
interface FolderWithSdParams {
  sdId: string;
  id: string;
}

/**
 * Register folder routes
 */
export function registerFolderRoutes(fastify: FastifyInstance): void {
  // List folders for a storage directory
  fastify.get<{ Querystring: ListFoldersQuery }>(
    '/api/folders',
    async (request: FastifyRequest<{ Querystring: ListFoldersQuery }>, reply: FastifyReply) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { sdId } = request.query;

      if (!sdId) {
        return sendError(reply, 400, 'Bad Request', 'sdId query parameter is required');
      }

      try {
        const services = getServices();
        const folders = await services.folderList(sdId);
        return folders;
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );

  // Create folder
  fastify.post<{ Body: CreateFolderBody }>(
    '/api/folders',
    async (request: FastifyRequest<{ Body: CreateFolderBody }>, reply: FastifyReply) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { sdId, parentId, name } = request.body;

      if (!sdId) {
        return sendError(reply, 400, 'Bad Request', 'sdId is required in request body');
      }
      if (!name) {
        return sendError(reply, 400, 'Bad Request', 'name is required in request body');
      }

      try {
        const services = getServices();
        const folderId = await services.folderCreate(sdId, parentId ?? null, name);
        reply.status(201);
        return { id: folderId };
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );

  // Rename folder
  fastify.put<{ Params: FolderWithSdParams; Body: RenameFolderBody }>(
    '/api/folders/:sdId/:id',
    async (
      request: FastifyRequest<{ Params: FolderWithSdParams; Body: RenameFolderBody }>,
      reply: FastifyReply
    ) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { sdId, id } = request.params;
      const { name } = request.body;

      if (!name) {
        return sendError(reply, 400, 'Bad Request', 'name is required in request body');
      }

      try {
        const services = getServices();
        await services.folderRename(sdId, id, name);
        return { success: true };
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );

  // Delete folder
  fastify.delete<{ Params: FolderWithSdParams }>(
    '/api/folders/:sdId/:id',
    async (request: FastifyRequest<{ Params: FolderWithSdParams }>, reply: FastifyReply) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { sdId, id } = request.params;

      try {
        const services = getServices();
        await services.folderDelete(sdId, id);
        reply.status(204);
        return;
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );

  // Move folder
  fastify.post<{ Params: FolderWithSdParams; Body: MoveFolderBody }>(
    '/api/folders/:sdId/:id/move',
    async (
      request: FastifyRequest<{ Params: FolderWithSdParams; Body: MoveFolderBody }>,
      reply: FastifyReply
    ) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { sdId, id } = request.params;
      const { parentId } = request.body;

      try {
        const services = getServices();
        await services.folderMove(sdId, id, parentId ?? null);
        return { success: true };
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );

  // Reorder folder
  fastify.post<{ Params: FolderWithSdParams; Body: ReorderFolderBody }>(
    '/api/folders/:sdId/:id/reorder',
    async (
      request: FastifyRequest<{ Params: FolderWithSdParams; Body: ReorderFolderBody }>,
      reply: FastifyReply
    ) => {
      if (!hasServices()) {
        return sendError(reply, 503, 'Service Unavailable', 'Services not configured');
      }

      const { sdId, id } = request.params;
      const { order } = request.body;

      if (order === undefined) {
        return sendError(reply, 400, 'Bad Request', 'order is required in request body');
      }

      try {
        const services = getServices();
        await services.folderReorder(sdId, id, order);
        return { success: true };
      } catch (err) {
        return handleServiceError(reply, err);
      }
    }
  );
}
