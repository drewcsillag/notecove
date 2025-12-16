/**
 * SQLite Database Implementation
 *
 * Implements the Database interface using better-sqlite3 adapter.
 * Provides all CRUD operations for notes, folders, tags, app state, and users.
 *
 * This class delegates to specialized repository classes for better organization.
 */

import type {
  Database,
  DatabaseAdapter,
  NoteCache,
  FolderCache,
  Tag,
  User,
  AppState,
  SearchResult,
  SchemaVersionRecord,
  StorageDirCache,
  NoteSyncState,
  FolderSyncState,
  CachedProfilePresence,
  ImageCache,
  CommentThreadCache,
  CommentReplyCache,
  CommentReactionCache,
} from '@notecove/shared';
import type { UUID } from '@notecove/shared';

import { NoteRepository } from './note-repository';
import { FolderRepository } from './folder-repository';
import { TagRepository } from './tag-repository';
import { LinkRepository } from './link-repository';
import { AppStateRepository } from './app-state-repository';
import { UserRepository } from './user-repository';
import { StorageDirRepository } from './storage-dir-repository';
import { SchemaRepository } from './schema-repository';
import { SyncStateRepository } from './sync-state-repository';
import { ProfilePresenceRepository } from './profile-presence-repository';
import { ImageRepository } from './image-repository';
import { CommentRepository } from './comment-repository';

export class SqliteDatabase implements Database {
  private readonly noteRepo: NoteRepository;
  private readonly folderRepo: FolderRepository;
  private readonly tagRepo: TagRepository;
  private readonly linkRepo: LinkRepository;
  private readonly appStateRepo: AppStateRepository;
  private readonly userRepo: UserRepository;
  private readonly storageDirRepo: StorageDirRepository;
  private readonly schemaRepo: SchemaRepository;
  private readonly syncStateRepo: SyncStateRepository;
  private readonly profilePresenceRepo: ProfilePresenceRepository;
  private readonly imageRepo: ImageRepository;
  private readonly commentRepo: CommentRepository;

  constructor(private readonly adapter: DatabaseAdapter) {
    this.noteRepo = new NoteRepository(adapter);
    this.folderRepo = new FolderRepository(adapter);
    this.tagRepo = new TagRepository(adapter);
    this.linkRepo = new LinkRepository(adapter);
    this.appStateRepo = new AppStateRepository(adapter);
    this.userRepo = new UserRepository(adapter);
    this.storageDirRepo = new StorageDirRepository(adapter);
    this.schemaRepo = new SchemaRepository(adapter);
    this.syncStateRepo = new SyncStateRepository(adapter);
    this.profilePresenceRepo = new ProfilePresenceRepository(adapter);
    this.imageRepo = new ImageRepository(adapter);
    this.commentRepo = new CommentRepository(adapter);
  }

  getAdapter(): DatabaseAdapter {
    return this.adapter;
  }

  async initialize(): Promise<void> {
    await this.adapter.initialize();
    await this.schemaRepo.createSchema();
    await this.schemaRepo.ensureSchemaVersion();
  }

  async close(): Promise<void> {
    await this.adapter.close();
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.adapter.beginTransaction();
    try {
      const result = await fn();
      await this.adapter.commit();
      return result;
    } catch (error) {
      await this.adapter.rollback();
      throw error;
    }
  }

  // ============================================================================
  // Note Cache Operations - Delegated to NoteRepository
  // ============================================================================

  async upsertNote(note: NoteCache): Promise<void> {
    return this.noteRepo.upsertNote(note);
  }

  async getNote(noteId: UUID): Promise<NoteCache | null> {
    return this.noteRepo.getNote(noteId);
  }

  async getNotesByFolder(folderId: UUID | null): Promise<NoteCache[]> {
    return this.noteRepo.getNotesByFolder(folderId);
  }

  async getNotesBySd(sdId: string): Promise<NoteCache[]> {
    return this.noteRepo.getNotesBySd(sdId);
  }

  async getActiveNotes(): Promise<NoteCache[]> {
    return this.noteRepo.getActiveNotes();
  }

  async getDeletedNotes(sdId?: string): Promise<NoteCache[]> {
    return this.noteRepo.getDeletedNotes(sdId);
  }

  async deleteNote(noteId: UUID): Promise<void> {
    return this.noteRepo.deleteNote(noteId);
  }

  async autoCleanupDeletedNotes(thresholdDays = 30): Promise<UUID[]> {
    return this.noteRepo.autoCleanupDeletedNotes(thresholdDays);
  }

  async getNoteCountForFolder(sdId: string, folderId: string | null): Promise<number> {
    return this.noteRepo.getNoteCountForFolder(sdId, folderId);
  }

  async getAllNotesCount(sdId: string): Promise<number> {
    return this.noteRepo.getAllNotesCount(sdId);
  }

  async getDeletedNoteCount(sdId: string): Promise<number> {
    return this.noteRepo.getDeletedNoteCount(sdId);
  }

  async searchNotes(query: string, limit = 50): Promise<SearchResult[]> {
    return this.noteRepo.searchNotes(query, limit);
  }

  async reindexNotes(onProgress?: (current: number, total: number) => void): Promise<void> {
    return this.noteRepo.reindexNotes(onProgress);
  }

  // ============================================================================
  // Folder Cache Operations - Delegated to FolderRepository
  // ============================================================================

  async upsertFolder(folder: FolderCache): Promise<void> {
    return this.folderRepo.upsertFolder(folder);
  }

  async getFolder(folderId: UUID): Promise<FolderCache | null> {
    return this.folderRepo.getFolder(folderId);
  }

  async getFoldersBySd(sdId: string): Promise<FolderCache[]> {
    return this.folderRepo.getFoldersBySd(sdId);
  }

  async getRootFolders(sdId: string): Promise<FolderCache[]> {
    return this.folderRepo.getRootFolders(sdId);
  }

  async getChildFolders(parentId: UUID): Promise<FolderCache[]> {
    return this.folderRepo.getChildFolders(parentId);
  }

  async deleteFolder(folderId: UUID): Promise<void> {
    return this.folderRepo.deleteFolder(folderId);
  }

  // ============================================================================
  // Tag Operations - Delegated to TagRepository
  // ============================================================================

  async createTag(name: string): Promise<Tag> {
    return this.tagRepo.createTag(name);
  }

  async getTag(tagId: UUID): Promise<Tag | null> {
    return this.tagRepo.getTag(tagId);
  }

  async getTagByName(name: string): Promise<Tag | null> {
    return this.tagRepo.getTagByName(name);
  }

  async getAllTags(): Promise<(Tag & { count: number })[]> {
    return this.tagRepo.getAllTags();
  }

  async getTagsForNote(noteId: UUID): Promise<Tag[]> {
    return this.tagRepo.getTagsForNote(noteId);
  }

  async addTagToNote(noteId: UUID, tagId: UUID): Promise<void> {
    return this.tagRepo.addTagToNote(noteId, tagId);
  }

  async removeTagFromNote(noteId: UUID, tagId: UUID): Promise<void> {
    return this.tagRepo.removeTagFromNote(noteId, tagId);
  }

  async getNotesWithTag(tagId: UUID): Promise<NoteCache[]> {
    return this.tagRepo.getNotesWithTag(tagId);
  }

  async deleteTag(tagId: UUID): Promise<void> {
    return this.tagRepo.deleteTag(tagId);
  }

  // ============================================================================
  // Inter-Note Link Operations - Delegated to LinkRepository
  // ============================================================================

  async addLink(sourceNoteId: UUID, targetNoteId: UUID): Promise<void> {
    return this.linkRepo.addLink(sourceNoteId, targetNoteId);
  }

  async removeLink(sourceNoteId: UUID, targetNoteId: UUID): Promise<void> {
    return this.linkRepo.removeLink(sourceNoteId, targetNoteId);
  }

  async getLinksFromNote(sourceNoteId: UUID): Promise<UUID[]> {
    return this.linkRepo.getLinksFromNote(sourceNoteId);
  }

  async getLinksToNote(targetNoteId: UUID): Promise<UUID[]> {
    return this.linkRepo.getLinksToNote(targetNoteId);
  }

  async getBacklinks(targetNoteId: UUID): Promise<NoteCache[]> {
    return this.linkRepo.getBacklinks(targetNoteId);
  }

  async removeAllLinksFromNote(noteId: UUID): Promise<void> {
    return this.linkRepo.removeAllLinksFromNote(noteId);
  }

  async removeAllLinksToNote(noteId: UUID): Promise<void> {
    return this.linkRepo.removeAllLinksToNote(noteId);
  }

  // ============================================================================
  // App State Operations - Delegated to AppStateRepository
  // ============================================================================

  async getState(key: string): Promise<string | null> {
    return this.appStateRepo.getState(key);
  }

  async setState(key: string, value: string): Promise<void> {
    return this.appStateRepo.setState(key, value);
  }

  async deleteState(key: string): Promise<void> {
    return this.appStateRepo.deleteState(key);
  }

  async getAllState(): Promise<AppState[]> {
    return this.appStateRepo.getAllState();
  }

  // ============================================================================
  // User Operations - Delegated to UserRepository
  // ============================================================================

  async upsertUser(user: User): Promise<void> {
    return this.userRepo.upsertUser(user);
  }

  async getUser(userId: UUID): Promise<User | null> {
    return this.userRepo.getUser(userId);
  }

  async getAllUsers(): Promise<User[]> {
    return this.userRepo.getAllUsers();
  }

  // ============================================================================
  // Storage Directory Operations - Delegated to StorageDirRepository
  // ============================================================================

  async createStorageDir(id: string, name: string, sdPath: string): Promise<StorageDirCache> {
    return this.storageDirRepo.createStorageDir(id, name, sdPath);
  }

  async getStorageDir(id: string): Promise<StorageDirCache | null> {
    return this.storageDirRepo.getStorageDir(id);
  }

  async getStorageDirByUuid(uuid: string): Promise<StorageDirCache | null> {
    return this.storageDirRepo.getStorageDirByUuid(uuid);
  }

  async getAllStorageDirs(): Promise<StorageDirCache[]> {
    return this.storageDirRepo.getAllStorageDirs();
  }

  async getActiveStorageDir(): Promise<StorageDirCache | null> {
    return this.storageDirRepo.getActiveStorageDir();
  }

  async setActiveStorageDir(id: string): Promise<void> {
    return this.storageDirRepo.setActiveStorageDir(id);
  }

  async deleteStorageDir(id: string): Promise<void> {
    return this.storageDirRepo.deleteStorageDir(id);
  }

  async cleanupOrphanedData(): Promise<{
    notesDeleted: number;
    foldersDeleted: number;
    tagAssociationsDeleted: number;
    unusedTagsDeleted: number;
  }> {
    return this.storageDirRepo.cleanupOrphanedData();
  }

  async updateStorageDirPath(id: string, newPath: string): Promise<void> {
    return this.storageDirRepo.updateStorageDirPath(id, newPath);
  }

  async updateStorageDirName(id: string, newName: string): Promise<void> {
    return this.storageDirRepo.updateStorageDirName(id, newName);
  }

  // ============================================================================
  // Schema Version Operations - Delegated to SchemaRepository
  // ============================================================================

  async getCurrentVersion(): Promise<number | null> {
    return this.schemaRepo.getCurrentVersion();
  }

  async getVersionHistory(): Promise<SchemaVersionRecord[]> {
    return this.schemaRepo.getVersionHistory();
  }

  async recordVersion(version: number, description: string): Promise<void> {
    return this.schemaRepo.recordVersion(version, description);
  }

  // ============================================================================
  // Note Sync State Operations - Delegated to SyncStateRepository
  // ============================================================================

  async getNoteSyncState(noteId: string, sdId: string): Promise<NoteSyncState | null> {
    return this.syncStateRepo.getNoteSyncState(noteId, sdId);
  }

  async upsertNoteSyncState(state: NoteSyncState): Promise<void> {
    return this.syncStateRepo.upsertNoteSyncState(state);
  }

  async deleteNoteSyncState(noteId: string, sdId: string): Promise<void> {
    return this.syncStateRepo.deleteNoteSyncState(noteId, sdId);
  }

  async getNoteSyncStatesBySd(sdId: string): Promise<NoteSyncState[]> {
    return this.syncStateRepo.getNoteSyncStatesBySd(sdId);
  }

  async deleteNoteSyncStatesBySd(sdId: string): Promise<void> {
    return this.syncStateRepo.deleteNoteSyncStatesBySd(sdId);
  }

  // ============================================================================
  // Folder Sync State Operations - Delegated to SyncStateRepository
  // ============================================================================

  async getFolderSyncState(sdId: string): Promise<FolderSyncState | null> {
    return this.syncStateRepo.getFolderSyncState(sdId);
  }

  async upsertFolderSyncState(state: FolderSyncState): Promise<void> {
    return this.syncStateRepo.upsertFolderSyncState(state);
  }

  async deleteFolderSyncState(sdId: string): Promise<void> {
    return this.syncStateRepo.deleteFolderSyncState(sdId);
  }

  // ============================================================================
  // Profile Presence Cache Operations - Delegated to ProfilePresenceRepository
  // ============================================================================

  async getProfilePresenceCache(
    profileId: string,
    sdId: string
  ): Promise<CachedProfilePresence | null> {
    return this.profilePresenceRepo.getProfilePresenceCache(profileId, sdId);
  }

  async getProfilePresenceCacheByInstanceId(
    instanceId: string,
    sdId: string
  ): Promise<CachedProfilePresence | null> {
    return this.profilePresenceRepo.getProfilePresenceCacheByInstanceId(instanceId, sdId);
  }

  async getProfilePresenceCacheBySd(sdId: string): Promise<CachedProfilePresence[]> {
    return this.profilePresenceRepo.getProfilePresenceCacheBySd(sdId);
  }

  async upsertProfilePresenceCache(presence: CachedProfilePresence): Promise<void> {
    return this.profilePresenceRepo.upsertProfilePresenceCache(presence);
  }

  async deleteProfilePresenceCache(profileId: string, sdId: string): Promise<void> {
    return this.profilePresenceRepo.deleteProfilePresenceCache(profileId, sdId);
  }

  async deleteProfilePresenceCacheBySd(sdId: string): Promise<void> {
    return this.profilePresenceRepo.deleteProfilePresenceCacheBySd(sdId);
  }

  // ============================================================================
  // Image Cache Operations - Delegated to ImageRepository
  // ============================================================================

  async upsertImage(image: ImageCache): Promise<void> {
    return this.imageRepo.upsertImage(image);
  }

  async getImage(imageId: UUID): Promise<ImageCache | null> {
    return this.imageRepo.getImage(imageId);
  }

  async getImagesBySd(sdId: string): Promise<ImageCache[]> {
    return this.imageRepo.getImagesBySd(sdId);
  }

  async deleteImage(imageId: UUID): Promise<void> {
    return this.imageRepo.deleteImage(imageId);
  }

  async imageExists(imageId: UUID): Promise<boolean> {
    return this.imageRepo.imageExists(imageId);
  }

  async getImageStorageSize(sdId: string): Promise<number> {
    return this.imageRepo.getImageStorageSize(sdId);
  }

  async getImageCount(sdId: string): Promise<number> {
    return this.imageRepo.getImageCount(sdId);
  }

  // ============================================================================
  // Comment Thread Operations - Delegated to CommentRepository
  // ============================================================================

  async upsertCommentThread(thread: CommentThreadCache): Promise<void> {
    return this.commentRepo.upsertCommentThread(thread);
  }

  async getCommentThread(threadId: UUID): Promise<CommentThreadCache | null> {
    return this.commentRepo.getCommentThread(threadId);
  }

  async getCommentThreadsForNote(noteId: UUID): Promise<CommentThreadCache[]> {
    return this.commentRepo.getCommentThreadsForNote(noteId);
  }

  async deleteCommentThread(threadId: UUID): Promise<void> {
    return this.commentRepo.deleteCommentThread(threadId);
  }

  async deleteCommentThreadsForNote(noteId: UUID): Promise<void> {
    return this.commentRepo.deleteCommentThreadsForNote(noteId);
  }

  // ============================================================================
  // Comment Reply Operations - Delegated to CommentRepository
  // ============================================================================

  async upsertCommentReply(reply: CommentReplyCache): Promise<void> {
    return this.commentRepo.upsertCommentReply(reply);
  }

  async getCommentReply(replyId: UUID): Promise<CommentReplyCache | null> {
    return this.commentRepo.getCommentReply(replyId);
  }

  async getRepliesForThread(threadId: UUID): Promise<CommentReplyCache[]> {
    return this.commentRepo.getRepliesForThread(threadId);
  }

  async deleteCommentReply(replyId: UUID): Promise<void> {
    return this.commentRepo.deleteCommentReply(replyId);
  }

  async deleteRepliesForThread(threadId: UUID): Promise<void> {
    return this.commentRepo.deleteRepliesForThread(threadId);
  }

  // ============================================================================
  // Comment Reaction Operations - Delegated to CommentRepository
  // ============================================================================

  async upsertCommentReaction(reaction: CommentReactionCache): Promise<void> {
    return this.commentRepo.upsertCommentReaction(reaction);
  }

  async getCommentReaction(reactionId: UUID): Promise<CommentReactionCache | null> {
    return this.commentRepo.getCommentReaction(reactionId);
  }

  async getReactionsForTarget(
    targetType: 'thread' | 'reply',
    targetId: UUID
  ): Promise<CommentReactionCache[]> {
    return this.commentRepo.getReactionsForTarget(targetType, targetId);
  }

  async deleteCommentReaction(reactionId: UUID): Promise<void> {
    return this.commentRepo.deleteCommentReaction(reactionId);
  }

  async deleteReactionsForTarget(targetType: 'thread' | 'reply', targetId: UUID): Promise<void> {
    return this.commentRepo.deleteReactionsForTarget(targetType, targetId);
  }
}
