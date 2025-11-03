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
export {
  SNAPSHOT_FORMAT_VERSION,
  parseSnapshotFilename,
  generateSnapshotFilename,
  encodeSnapshotFile,
  decodeSnapshotFile,
  createEmptyVectorClock,
  updateVectorClock,
  shouldApplyUpdate,
  selectBestSnapshot,
  type SnapshotData,
  type SnapshotFileMetadata,
  type VectorClock,
} from './snapshot-format';
export { extractTitleFromFragment, extractTitleFromDoc } from './title-extractor';
