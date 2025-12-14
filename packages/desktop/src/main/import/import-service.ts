/**
 * Import Service
 *
 * Orchestrates the import of markdown files and folders into NoteCove.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { Database } from '@notecove/shared';
import {
  markdownToProsemirror,
  prosemirrorJsonToYXmlFragment,
  extractImageReferences,
  resolveImportImages,
  liftImagesToBlockLevel,
  convertLinksToImportMarkers,
  resolveImportLinkMarkers,
  ImageStorage,
  SyncDirectoryStructure,
  type FileSystemAdapter,
} from '@notecove/shared';
import type { CRDTManager } from '../crdt';
import type { ScanResult, ScannedFile, ImportOptions, ImportProgress, ImportResult } from './types';
import { scanPath, getUniqueFolderPaths } from './file-scanner';

/**
 * Node.js implementation of FileSystemAdapter for ImageStorage
 */
class NodeFsAdapter implements FileSystemAdapter {
  async exists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(dirpath: string): Promise<void> {
    await fs.mkdir(dirpath, { recursive: true });
  }

  async readFile(filepath: string): Promise<Uint8Array> {
    const buffer = await fs.readFile(filepath);
    return new Uint8Array(buffer);
  }

  async writeFile(filepath: string, data: Uint8Array): Promise<void> {
    await fs.writeFile(filepath, data);
  }

  async appendFile(filepath: string, data: Uint8Array): Promise<void> {
    await fs.appendFile(filepath, data);
  }

  async deleteFile(filepath: string): Promise<void> {
    await fs.unlink(filepath);
  }

  async listFiles(dirpath: string): Promise<string[]> {
    const entries = await fs.readdir(dirpath);
    return entries;
  }

  joinPath(...segments: string[]): string {
    return path.join(...segments);
  }

  basename(filepath: string): string {
    return path.basename(filepath);
  }

  async stat(filepath: string): Promise<{ size: number; mtimeMs: number; ctimeMs: number }> {
    const stats = await fs.stat(filepath);
    return {
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      ctimeMs: stats.ctimeMs,
    };
  }
}

/**
 * Callback for progress updates
 */
export type ProgressCallback = (progress: ImportProgress) => void;

/**
 * Callback for broadcasting events
 */
export type BroadcastCallback = (channel: string, ...args: unknown[]) => void;

/**
 * Import Service - handles markdown import operations
 */
export class ImportService {
  private cancelled = false;
  private progressCallback: ProgressCallback | undefined;
  private progress: ImportProgress;

  constructor(
    private crdtManager: CRDTManager,
    private database: Database,
    private broadcastCallback?: BroadcastCallback
  ) {
    this.progress = this.createInitialProgress();
  }

  /**
   * Import markdown files from a source path
   */
  async importFromPath(
    sourcePath: string,
    options: ImportOptions,
    onProgress?: ProgressCallback
  ): Promise<ImportResult> {
    this.cancelled = false;
    this.progressCallback = onProgress;
    this.progress = this.createInitialProgress();

    try {
      // Phase 1: Scan source
      this.updateProgress({ phase: 'scanning' });
      const scanResult = await scanPath(sourcePath);

      this.progress.totalFiles = scanResult.totalFiles;
      this.updateProgress({});

      if (scanResult.totalFiles === 0) {
        return this.buildResult(true);
      }

      // Phase 2: Create folders (if preserving hierarchy)
      const pathToFolderId = new Map<string, string>();
      if (options.folderMode !== 'flatten') {
        this.updateProgress({ phase: 'folders' });
        await this.createFolders(scanResult, options, pathToFolderId);
      }

      // Phase 3a: Pre-assign note IDs for inter-note link resolution
      // This allows links between notes to be resolved during creation
      const pathToNoteId = new Map<string, string>();
      for (const file of scanResult.files) {
        const noteId = randomUUID();
        pathToNoteId.set(file.relativePath, noteId);
        // Also add without extension for convenience
        if (file.relativePath.endsWith('.md')) {
          pathToNoteId.set(file.relativePath.slice(0, -3), noteId);
        }
      }
      console.log(`[Import] Pre-assigned ${pathToNoteId.size / 2} note IDs for link resolution`);

      // Phase 3b: Create notes with resolved links
      this.updateProgress({ phase: 'notes' });
      const noteIds: string[] = [];

      for (const file of scanResult.files) {
        // Check cancellation (can be set asynchronously via cancel() method)
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (this.cancelled) {
          return this.cancelledResult();
        }

        try {
          this.updateProgress({ currentFile: file.name });

          // Get the pre-assigned note ID
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- noteId was pre-assigned in the first pass
          const noteId = pathToNoteId.get(file.relativePath)!;
          const created = await this.createNote(
            file,
            options,
            pathToFolderId,
            pathToNoteId,
            noteId
          );

          if (created) {
            noteIds.push(noteId);
            this.progress.notesCreated++;
          } else {
            this.progress.notesSkipped++;
          }

          this.progress.processedFiles++;
          this.updateProgress({});
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[Import] Failed to import ${file.relativePath}:`, message);
          this.progress.errors.push({
            type: 'file',
            item: file.relativePath || file.name,
            message,
          });
        }
      }

      // Complete
      this.updateProgress({ phase: 'complete' });

      return this.buildResult(true, noteIds);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Import] Import failed:', message);
      this.updateProgress({ phase: 'error' });
      return {
        success: false,
        error: message,
        notesCreated: this.progress.notesCreated,
        foldersCreated: this.progress.foldersCreated,
        skipped: this.progress.notesSkipped,
        errors: this.progress.errors,
        noteIds: [],
        folderIds: [],
      };
    }
  }

  /**
   * Cancel the current import operation
   */
  cancel(): void {
    this.cancelled = true;
    console.log('[Import] Cancellation requested');
  }

  /**
   * Create folder structure for import
   */
  private async createFolders(
    scanResult: ScanResult,
    options: ImportOptions,
    pathToFolderId: Map<string, string>
  ): Promise<void> {
    // Get unique folder paths in creation order (parent before child)
    const folderPaths = getUniqueFolderPaths(scanResult.files);

    if (folderPaths.length === 0 && options.folderMode !== 'container') {
      return;
    }

    // Determine the base folder ID
    let baseFolderId: string | null = options.targetFolderId;

    // If container mode, create the container folder first
    if (options.folderMode === 'container') {
      const containerName = options.containerName ?? path.basename(scanResult.rootPath);
      baseFolderId = await this.createFolder(options.sdId, options.targetFolderId, containerName);
      pathToFolderId.set('', baseFolderId);
      this.progress.foldersCreated++;
    }

    // Create nested folders
    for (const folderPath of folderPaths) {
      if (this.cancelled) return;

      const folderName = path.basename(folderPath);
      const parentPath = path.dirname(folderPath);
      const parentFolderId =
        parentPath === '.' ? baseFolderId : (pathToFolderId.get(parentPath) ?? baseFolderId);

      const folderId = await this.createFolder(options.sdId, parentFolderId, folderName);
      pathToFolderId.set(folderPath, folderId);
      this.progress.foldersCreated++;
    }
  }

  /**
   * Create a single folder, handling duplicates
   */
  private async createFolder(sdId: string, parentId: string | null, name: string): Promise<string> {
    const folderTree = await this.crdtManager.loadFolderTree(sdId);

    // Get siblings to check for duplicates
    const siblings =
      parentId === null ? folderTree.getRootFolders() : folderTree.getChildFolders(parentId);
    const existingNames = new Set(siblings.map((f) => f.name.toLowerCase()));

    // Find unique name
    let uniqueName = name;
    let counter = 1;
    while (existingNames.has(uniqueName.toLowerCase())) {
      uniqueName = `${name} (${counter})`;
      counter++;
    }

    // Calculate order (alphabetical position among siblings)
    const sortedSiblings = [...siblings].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    let order = 0;
    for (const sibling of sortedSiblings) {
      if (uniqueName.toLowerCase().localeCompare(sibling.name.toLowerCase()) > 0) {
        order = sibling.order + 1;
      }
    }

    // Create folder in CRDT
    const folderId = randomUUID();
    folderTree.createFolder({
      id: folderId,
      name: uniqueName,
      parentId,
      sdId,
      order,
      deleted: false,
    });

    // Cache in database
    await this.database.upsertFolder({
      id: folderId,
      name: uniqueName,
      sdId,
      parentId,
      order,
      deleted: false,
    });

    // Broadcast folder creation
    if (this.broadcastCallback) {
      this.broadcastCallback('folder:updated', { sdId, operation: 'create', folderId });
    }

    console.log(`[Import] Created folder: ${uniqueName} (${folderId})`);
    return folderId;
  }

  /**
   * Create a note from a markdown file
   * @returns true if note was created, false if skipped
   */
  private async createNote(
    file: ScannedFile,
    options: ImportOptions,
    pathToFolderId: Map<string, string>,
    pathToNoteId: Map<string, string>,
    noteId: string
  ): Promise<boolean> {
    // Determine target folder
    let folderId: string | null = options.targetFolderId;

    if (options.folderMode === 'container') {
      // Use container folder or subfolder
      folderId = pathToFolderId.get(file.parentPath) ?? pathToFolderId.get('') ?? folderId;
    } else if (options.folderMode === 'preserve' && file.parentPath) {
      // Use matching subfolder
      folderId = pathToFolderId.get(file.parentPath) ?? folderId;
    }

    // Check for duplicates by title
    const markdown = await fs.readFile(file.absolutePath, 'utf-8');
    const prosemirrorJson = markdownToProsemirror(markdown);

    // Extract title from first heading or use filename
    let title = file.name;
    if (prosemirrorJson.content && prosemirrorJson.content.length > 0) {
      const firstNode = prosemirrorJson.content[0];
      if (firstNode?.type === 'heading' && firstNode.content && firstNode.content.length > 0) {
        const textContent = firstNode.content.map((n) => n.text ?? '').join('');
        if (textContent.trim()) {
          title = textContent.trim();
        }
      }
    }

    // Check for duplicate titles in target folder
    if (options.duplicateHandling === 'skip') {
      const existingNotes = await this.database.getNotesByFolder(folderId);
      const existingTitles = new Set(existingNotes.map((n) => n.title.toLowerCase()));
      if (existingTitles.has(title.toLowerCase())) {
        console.log(`[Import] Skipping duplicate: ${title}`);
        return false;
      }
    }

    if (options.duplicateHandling === 'rename') {
      const existingNotes = await this.database.getNotesByFolder(folderId);
      const existingTitles = new Set(existingNotes.map((n) => n.title.toLowerCase()));
      let uniqueTitle = title;
      let counter = 1;
      while (existingTitles.has(uniqueTitle.toLowerCase())) {
        uniqueTitle = `${title} (${counter})`;
        counter++;
      }
      title = uniqueTitle;
    }

    // Process images in the markdown
    const imageMap = await this.importImages(prosemirrorJson, file.absolutePath, options.sdId);

    // Resolve import images to notecoveImage nodes (or text placeholders)
    resolveImportImages(prosemirrorJson, imageMap);

    // Lift images from inline to block level
    liftImagesToBlockLevel(prosemirrorJson);

    // Convert inter-note links to import markers, then resolve them
    convertLinksToImportMarkers(prosemirrorJson);
    resolveImportLinkMarkers(prosemirrorJson, pathToNoteId);

    const now = Date.now();

    // Load note (creates empty CRDT document)
    await this.crdtManager.loadNote(noteId, options.sdId);

    // Get NoteDoc and initialize
    const noteDoc = this.crdtManager.getNoteDoc(noteId);
    if (!noteDoc) {
      throw new Error(`Failed to create NoteDoc for ${noteId}`);
    }

    // Initialize metadata
    noteDoc.initializeNote({
      id: noteId,
      created: file.modifiedAt || now,
      modified: now,
      sdId: options.sdId,
      folderId,
      deleted: false,
      pinned: false,
    });

    // Populate content from markdown
    const content = noteDoc.content;
    prosemirrorJsonToYXmlFragment(prosemirrorJson, content);

    // Extract content text for search
    const contentText = this.extractPlainText(prosemirrorJson);
    const contentPreview = contentText.substring(0, 200);

    // Cache in database
    await this.database.upsertNote({
      id: noteId,
      title,
      sdId: options.sdId,
      folderId,
      created: file.modifiedAt || now,
      modified: now,
      deleted: false,
      pinned: false,
      contentPreview,
      contentText,
    });

    // Broadcast note creation
    if (this.broadcastCallback) {
      this.broadcastCallback('note:created', { sdId: options.sdId, noteId, folderId });
    }

    console.log(`[Import] Created note: ${title} (${noteId}) with ${imageMap.size} images`);
    return true;
  }

  /**
   * Import images referenced in the markdown content
   * Returns a map from original src to { imageId, sdId }
   */
  private async importImages(
    prosemirrorJson: { type: string; content?: unknown[] },
    markdownFilePath: string,
    sdId: string
  ): Promise<Map<string, { imageId: string; sdId: string }>> {
    const imageMap = new Map<string, { imageId: string; sdId: string }>();

    // Extract image references
    const imageRefs = extractImageReferences(
      prosemirrorJson as Parameters<typeof extractImageReferences>[0]
    );

    if (imageRefs.length === 0) {
      return imageMap;
    }

    // Get SD info for ImageStorage
    const sd = await this.database.getStorageDir(sdId);
    if (!sd) {
      console.warn(`[Import] Storage directory ${sdId} not found, skipping image import`);
      return imageMap;
    }

    // Create ImageStorage instance
    const fsAdapter = new NodeFsAdapter();
    const sdStructure = new SyncDirectoryStructure(fsAdapter, {
      id: sdId,
      path: sd.path,
      label: sd.name,
    });
    const imageStorage = new ImageStorage(fsAdapter, sdStructure);

    // Get the directory containing the markdown file
    const markdownDir = path.dirname(markdownFilePath);

    for (const ref of imageRefs) {
      try {
        // Skip external URLs (http://, https://, data:)
        if (
          ref.src.startsWith('http://') ||
          ref.src.startsWith('https://') ||
          ref.src.startsWith('data:')
        ) {
          console.log(`[Import] Skipping external image: ${ref.src}`);
          continue;
        }

        // Resolve relative path to absolute path
        const imagePath = path.isAbsolute(ref.src) ? ref.src : path.resolve(markdownDir, ref.src);

        // Check if file exists
        try {
          await fs.access(imagePath);
        } catch {
          console.warn(`[Import] Image not found: ${imagePath}`);
          continue;
        }

        // Read image file
        const imageData = await fs.readFile(imagePath);

        // Determine MIME type from extension
        const ext = path.extname(imagePath).slice(1).toLowerCase();
        const mimeType = ImageStorage.getMimeTypeFromExtension(ext);

        if (!mimeType) {
          console.warn(`[Import] Unsupported image type: ${ext} (${imagePath})`);
          continue;
        }

        // Save to NoteCove storage
        const result = await imageStorage.saveImage(new Uint8Array(imageData), mimeType);

        // Add to database cache
        await this.database.upsertImage({
          id: result.imageId,
          sdId,
          filename: result.filename,
          mimeType,
          width: null,
          height: null,
          size: imageData.length,
          created: Date.now(),
        });

        // Track the mapping
        imageMap.set(ref.src, { imageId: result.imageId, sdId });

        console.log(`[Import] Imported image: ${path.basename(imagePath)} -> ${result.imageId}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Import] Failed to import image ${ref.src}:`, message);
      }
    }

    return imageMap;
  }

  /**
   * Extract plain text from ProseMirror JSON for search indexing
   */
  private extractPlainText(json: { type: string; content?: unknown[] }): string {
    const texts: string[] = [];

    const extract = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as { type?: string; text?: string; content?: unknown[] };

      if (n.type === 'text' && n.text) {
        texts.push(n.text);
      }
      if (n.content && Array.isArray(n.content)) {
        for (const child of n.content) {
          extract(child);
        }
      }
    };

    extract(json);
    return texts.join(' ');
  }

  /**
   * Create initial progress state
   */
  private createInitialProgress(): ImportProgress {
    return {
      phase: 'scanning',
      processedFiles: 0,
      totalFiles: 0,
      foldersCreated: 0,
      notesCreated: 0,
      notesSkipped: 0,
      errors: [],
    };
  }

  /**
   * Update progress and notify callback
   */
  private updateProgress(updates: Partial<ImportProgress>): void {
    Object.assign(this.progress, updates);
    if (this.progressCallback) {
      this.progressCallback({ ...this.progress });
    }
  }

  /**
   * Build result for cancelled operation
   */
  private cancelledResult(): ImportResult {
    this.updateProgress({ phase: 'cancelled' });
    return {
      success: false,
      error: 'Import cancelled',
      notesCreated: this.progress.notesCreated,
      foldersCreated: this.progress.foldersCreated,
      skipped: this.progress.notesSkipped,
      errors: this.progress.errors,
      noteIds: [],
      folderIds: [],
    };
  }

  /**
   * Build final result
   */
  private buildResult(success: boolean, noteIds: string[] = []): ImportResult {
    return {
      success,
      notesCreated: this.progress.notesCreated,
      foldersCreated: this.progress.foldersCreated,
      skipped: this.progress.notesSkipped,
      errors: this.progress.errors,
      noteIds,
      folderIds: [], // Could track this if needed
    };
  }
}
