/**
 * AttachmentManager - Manages file attachments (images, documents, etc.)
 * Stores attachments as separate files on disk instead of embedding in CRDT
 */

// Generate UUID - compatible with both Node.js and browser
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface FileStorage {
  isElectron: boolean;
  notesPath: string;
  readFile?: (path: string) => Promise<Uint8Array>;
  writeFile?: (path: string, data: Uint8Array) => Promise<void>;
  exists?: (path: string) => Promise<boolean>;
  mkdir?: (path: string) => Promise<void>;
  deleteFile?: (path: string) => Promise<void>;
  readDir?: (path: string) => Promise<string[]>;
}

export interface Attachment {
  id: string;           // Unique attachment ID (UUID)
  noteId: string;       // Note this attachment belongs to
  filename: string;     // Original filename (e.g., "screenshot.png")
  mimeType: string;     // MIME type (e.g., "image/png")
  size: number;         // File size in bytes
  created: string;      // ISO timestamp
}

export interface AttachmentData {
  attachment: Attachment;
  data: Uint8Array;     // File data (browser-compatible)
}

export class AttachmentManager {
  private fileStorage: FileStorage;
  private isElectron: boolean;

  constructor(fileStorage: FileStorage) {
    this.fileStorage = fileStorage;
    this.isElectron = fileStorage.isElectron;
  }

  /**
   * Get path to attachments directory for a note
   * @param noteId - Note ID
   * @returns Path to attachments directory
   */
  getAttachmentsDir(noteId: string): string {
    return `${this.fileStorage.notesPath}/${noteId}/attachments`;
  }

  /**
   * Get path to a specific attachment file
   * @param noteId - Note ID
   * @param attachmentId - Attachment ID
   * @param extension - File extension (e.g., "png", "jpg")
   * @returns Path to attachment file
   */
  getAttachmentPath(noteId: string, attachmentId: string, extension: string): string {
    return `${this.getAttachmentsDir(noteId)}/${attachmentId}.${extension}`;
  }

  /**
   * Get path to attachment metadata file
   * @param noteId - Note ID
   * @param attachmentId - Attachment ID
   * @returns Path to metadata file
   */
  getAttachmentMetaPath(noteId: string, attachmentId: string): string {
    return `${this.getAttachmentsDir(noteId)}/${attachmentId}.meta.json`;
  }

  /**
   * Get file extension from filename
   * @param filename - Filename
   * @returns Extension without dot (e.g., "png")
   */
  private getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * Detect MIME type from file extension
   * @param filename - Filename
   * @returns MIME type
   */
  private getMimeType(filename: string): string {
    const ext = this.getExtension(filename);
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
      txt: 'text/plain',
      md: 'text/markdown',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Save an attachment to disk
   * @param noteId - Note ID
   * @param filename - Original filename (e.g., "screenshot.png")
   * @param data - File data (Uint8Array or base64 string)
   * @returns Attachment metadata
   */
  async saveAttachment(
    noteId: string,
    filename: string,
    data: Uint8Array | string
  ): Promise<Attachment> {
    if (!this.isElectron) {
      throw new Error('Attachments are only supported in Electron mode');
    }

    // Convert base64 to Uint8Array if needed (browser-compatible)
    let uint8Array: Uint8Array;
    if (typeof data === 'string') {
      // Remove data URL prefix if present
      const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
      // Use atob for browser-compatible base64 decoding
      const binaryString = atob(base64Data);
      uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
    } else {
      uint8Array = data;
    }

    // Generate unique ID
    const attachmentId = generateUUID();
    const extension = this.getExtension(filename);
    const mimeType = this.getMimeType(filename);

    // Create attachment metadata
    const attachment: Attachment = {
      id: attachmentId,
      noteId,
      filename,
      mimeType,
      size: uint8Array.length,
      created: new Date().toISOString(),
    };

    // Ensure attachments directory exists
    const attachmentsDir = this.getAttachmentsDir(noteId);
    if (!(await this.fileStorage.exists!(attachmentsDir))) {
      await this.fileStorage.mkdir!(attachmentsDir);
    }

    // Save file data
    const filePath = this.getAttachmentPath(noteId, attachmentId, extension);
    await this.fileStorage.writeFile!(filePath, uint8Array);

    // Save metadata
    const metaPath = this.getAttachmentMetaPath(noteId, attachmentId);
    const metaJson = JSON.stringify(attachment, null, 2);
    // Convert JSON string to Uint8Array (browser-compatible)
    const encoder = new TextEncoder();
    const metaBytes = encoder.encode(metaJson);
    console.log(`[AttachmentManager] Writing metadata to ${metaPath}:`, {
      jsonLength: metaJson.length,
      bytesLength: metaBytes.length,
      jsonPreview: metaJson.substring(0, 100)
    });
    await this.fileStorage.writeFile!(metaPath, metaBytes);

    console.log(`[AttachmentManager] Saved attachment: ${attachmentId} (${filename}, ${uint8Array.length} bytes)`);

    return attachment;
  }

  /**
   * Load an attachment from disk
   * @param noteId - Note ID
   * @param attachmentId - Attachment ID
   * @returns Attachment data and metadata, or null if not found
   */
  async loadAttachment(noteId: string, attachmentId: string): Promise<AttachmentData | null> {
    if (!this.isElectron) {
      throw new Error('Attachments are only supported in Electron mode');
    }

    // Load metadata first to get file extension
    const metaPath = this.getAttachmentMetaPath(noteId, attachmentId);
    if (!(await this.fileStorage.exists!(metaPath))) {
      console.warn(`[AttachmentManager] Attachment metadata not found: ${attachmentId}`);
      return null;
    }

    const metaBytes = await this.fileStorage.readFile!(metaPath);
    // Decode Uint8Array to string (browser-compatible)
    const decoder = new TextDecoder();
    const metaJson = decoder.decode(metaBytes);
    console.log(`[AttachmentManager] Read metadata for ${attachmentId}:`, {
      bytesLength: metaBytes.length,
      jsonLength: metaJson.length,
      jsonPreview: metaJson.substring(0, 100)
    });
    const attachment = JSON.parse(metaJson) as Attachment;

    // Load file data
    const extension = this.getExtension(attachment.filename);
    const filePath = this.getAttachmentPath(noteId, attachmentId, extension);

    if (!(await this.fileStorage.exists!(filePath))) {
      console.warn(`[AttachmentManager] Attachment file not found: ${filePath}`);
      return null;
    }

    const data = await this.fileStorage.readFile!(filePath);

    return {
      attachment,
      data,
    };
  }

  /**
   * Load attachment as data URL for embedding in HTML
   * @param noteId - Note ID
   * @param attachmentId - Attachment ID
   * @returns Data URL (e.g., "data:image/png;base64,...") or null if not found
   */
  async loadAttachmentAsDataURL(noteId: string, attachmentId: string): Promise<string | null> {
    const attachmentData = await this.loadAttachment(noteId, attachmentId);
    if (!attachmentData) {
      return null;
    }

    const { attachment, data } = attachmentData;
    // Convert Uint8Array to base64 (browser-compatible)
    let binaryString = '';
    for (let i = 0; i < data.length; i++) {
      binaryString += String.fromCharCode(data[i]);
    }
    const base64 = btoa(binaryString);
    return `data:${attachment.mimeType};base64,${base64}`;
  }

  /**
   * Delete an attachment from disk
   * @param noteId - Note ID
   * @param attachmentId - Attachment ID
   */
  async deleteAttachment(noteId: string, attachmentId: string): Promise<void> {
    if (!this.isElectron) {
      throw new Error('Attachments are only supported in Electron mode');
    }

    // Load metadata to get file extension
    const metaPath = this.getAttachmentMetaPath(noteId, attachmentId);
    if (await this.fileStorage.exists!(metaPath)) {
      const metaBytes = await this.fileStorage.readFile!(metaPath);
      // Decode Uint8Array to string (browser-compatible)
      const decoder = new TextDecoder();
      const metaJson = decoder.decode(metaBytes);
      const attachment = JSON.parse(metaJson) as Attachment;

      // Delete file data
      const extension = this.getExtension(attachment.filename);
      const filePath = this.getAttachmentPath(noteId, attachmentId, extension);
      if (await this.fileStorage.exists!(filePath)) {
        await this.fileStorage.deleteFile!(filePath);
      }

      // Delete metadata
      await this.fileStorage.deleteFile!(metaPath);

      console.log(`[AttachmentManager] Deleted attachment: ${attachmentId}`);
    }
  }

  /**
   * List all attachments for a note
   * @param noteId - Note ID
   * @returns Array of attachment metadata
   */
  async listAttachments(noteId: string): Promise<Attachment[]> {
    if (!this.isElectron) {
      return [];
    }

    const attachmentsDir = this.getAttachmentsDir(noteId);
    if (!(await this.fileStorage.exists!(attachmentsDir))) {
      return [];
    }

    const files = await this.fileStorage.readDir!(attachmentsDir);
    const metaFiles = files.filter(f => f.endsWith('.meta.json'));

    const attachments: Attachment[] = [];
    for (const metaFile of metaFiles) {
      const metaPath = `${attachmentsDir}/${metaFile}`;
      const metaBytes = await this.fileStorage.readFile!(metaPath);
      // Decode Uint8Array to string (browser-compatible)
      const decoder = new TextDecoder();
      const metaJson = decoder.decode(metaBytes);
      const attachment = JSON.parse(metaJson) as Attachment;
      attachments.push(attachment);
    }

    return attachments;
  }

  /**
   * Check if an attachment exists
   * @param noteId - Note ID
   * @param attachmentId - Attachment ID
   * @returns true if attachment exists
   */
  async hasAttachment(noteId: string, attachmentId: string): Promise<boolean> {
    if (!this.isElectron) {
      return false;
    }

    const metaPath = this.getAttachmentMetaPath(noteId, attachmentId);
    return await this.fileStorage.exists!(metaPath);
  }

  /**
   * Get total size of all attachments for a note
   * @param noteId - Note ID
   * @returns Total size in bytes
   */
  async getTotalSize(noteId: string): Promise<number> {
    const attachments = await this.listAttachments(noteId);
    return attachments.reduce((sum, att) => sum + att.size, 0);
  }
}
