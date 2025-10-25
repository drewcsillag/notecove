/**
 * CRDT Core - Yjs-based document management
 */

export { NoteDoc } from './note-doc';
export { FolderTreeDoc } from './folder-tree-doc';
export {
  UpdateType,
  UPDATE_FORMAT_VERSION,
  parseUpdateFilename,
  generateUpdateFilename,
  encodeUpdateFile,
  decodeUpdateFile,
  type UpdateFileMetadata,
} from './update-format';
