/**
 * Image and Thumbnail API
 */

import { ipcRenderer } from 'electron';

export const imageApi = {
  /**
   * Save an image to the storage directory
   * @param sdId Storage directory ID
   * @param data Image binary data
   * @param mimeType MIME type (e.g., 'image/png', 'image/jpeg')
   * @returns { imageId, filename }
   */
  save: (
    sdId: string,
    data: Uint8Array,
    mimeType: string
  ): Promise<{ imageId: string; filename: string }> =>
    ipcRenderer.invoke('image:save', sdId, data, mimeType) as Promise<{
      imageId: string;
      filename: string;
    }>,

  /**
   * Get image data as base64 data URL for display
   * @param sdId Storage directory ID
   * @param imageId Image ID
   * @returns Base64 data URL (e.g., 'data:image/png;base64,...') or null if not found
   */
  getDataUrl: (sdId: string, imageId: string): Promise<string | null> =>
    ipcRenderer.invoke('image:getDataUrl', sdId, imageId) as Promise<string | null>,

  /**
   * Get the file system path for an image
   * @param sdId Storage directory ID
   * @param imageId Image ID
   * @returns File path or null if not found
   */
  getPath: (sdId: string, imageId: string): Promise<string | null> =>
    ipcRenderer.invoke('image:getPath', sdId, imageId) as Promise<string | null>,

  /**
   * Delete an image
   * @param sdId Storage directory ID
   * @param imageId Image ID
   */
  delete: (sdId: string, imageId: string): Promise<void> =>
    ipcRenderer.invoke('image:delete', sdId, imageId) as Promise<void>,

  /**
   * Check if an image exists
   * @param sdId Storage directory ID
   * @param imageId Image ID
   */
  exists: (sdId: string, imageId: string): Promise<boolean> =>
    ipcRenderer.invoke('image:exists', sdId, imageId) as Promise<boolean>,

  /**
   * Get image metadata from database
   * @param imageId Image ID
   * @returns Image metadata or null if not found
   */
  getMetadata: (
    imageId: string
  ): Promise<{
    id: string;
    sdId: string;
    filename: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    size: number;
    created: number;
  } | null> =>
    ipcRenderer.invoke('image:getMetadata', imageId) as Promise<{
      id: string;
      sdId: string;
      filename: string;
      mimeType: string;
      width: number | null;
      height: number | null;
      size: number;
      created: number;
    } | null>,

  /**
   * List all images in a storage directory
   * @param sdId Storage directory ID
   */
  list: (
    sdId: string
  ): Promise<
    {
      id: string;
      sdId: string;
      filename: string;
      mimeType: string;
      width: number | null;
      height: number | null;
      size: number;
      created: number;
    }[]
  > =>
    ipcRenderer.invoke('image:list', sdId) as Promise<
      {
        id: string;
        sdId: string;
        filename: string;
        mimeType: string;
        width: number | null;
        height: number | null;
        size: number;
        created: number;
      }[]
    >,

  /**
   * Get storage statistics for images in a storage directory
   * @param sdId Storage directory ID
   */
  getStorageStats: (sdId: string): Promise<{ totalSize: number; imageCount: number }> =>
    ipcRenderer.invoke('image:getStorageStats', sdId) as Promise<{
      totalSize: number;
      imageCount: number;
    }>,

  /**
   * Open file picker dialog and save selected images
   * @param sdId Storage directory ID
   * @returns Array of imageIds for saved images
   */
  pickAndSave: (sdId: string): Promise<string[]> =>
    ipcRenderer.invoke('image:pickAndSave', sdId) as Promise<string[]>,

  /**
   * Download an image from a URL and save it to the media folder
   * @param sdId Storage directory ID
   * @param url Image URL (http://, https://, or file://)
   * @returns The imageId of the saved image
   */
  downloadAndSave: (sdId: string, url: string): Promise<string> =>
    ipcRenderer.invoke('image:downloadAndSave', sdId, url) as Promise<string>,

  /**
   * Copy image to clipboard
   * @param sdId Storage directory ID
   * @param imageId Image ID
   */
  copyToClipboard: (sdId: string, imageId: string): Promise<void> =>
    ipcRenderer.invoke('image:copyToClipboard', sdId, imageId) as Promise<void>,

  /**
   * Save image as... (with file dialog)
   * @param sdId Storage directory ID
   * @param imageId Image ID
   * @returns The file path where the image was saved, or null if cancelled
   */
  saveAs: (sdId: string, imageId: string): Promise<string | null> =>
    ipcRenderer.invoke('image:saveAs', sdId, imageId) as Promise<string | null>,

  /**
   * Open image in external application
   * @param sdId Storage directory ID
   * @param imageId Image ID
   */
  openExternal: (sdId: string, imageId: string): Promise<void> =>
    ipcRenderer.invoke('image:openExternal', sdId, imageId) as Promise<void>,

  /**
   * Copy an image from one sync directory to another
   * Used when pasting content containing images across different SDs
   * @param sourceSdId Source storage directory ID
   * @param targetSdId Target storage directory ID
   * @param imageId Image ID to copy
   * @returns Copy result with success status
   */
  copyToSD: (
    sourceSdId: string,
    targetSdId: string,
    imageId: string
  ): Promise<{ success: boolean; imageId: string; alreadyExists?: boolean; error?: string }> =>
    ipcRenderer.invoke('image:copyToSD', sourceSdId, targetSdId, imageId) as Promise<{
      success: boolean;
      imageId: string;
      alreadyExists?: boolean;
      error?: string;
    }>,

  /**
   * Subscribe to image availability events (when synced images arrive)
   * @param listener Callback when image becomes available
   * @returns Cleanup function to remove listener
   */
  onAvailable: (
    listener: (event: { sdId: string; imageId: string; filename: string }) => void
  ): (() => void) => {
    const wrapper = (
      _: Electron.IpcRendererEvent,
      data: { sdId: string; imageId: string; filename: string }
    ) => {
      listener(data);
    };
    ipcRenderer.on('image:available', wrapper);
    return () => {
      ipcRenderer.removeListener('image:available', wrapper);
    };
  },
};

export const thumbnailApi = {
  /**
   * Get or generate a thumbnail for an image
   * @param sdId Storage directory ID
   * @param imageId Image ID
   * @returns Thumbnail result or null if not found
   */
  get: (
    sdId: string,
    imageId: string
  ): Promise<{
    path: string;
    format: 'jpeg' | 'png' | 'gif';
    width: number;
    height: number;
    size: number;
  } | null> =>
    ipcRenderer.invoke('thumbnail:get', sdId, imageId) as Promise<{
      path: string;
      format: 'jpeg' | 'png' | 'gif';
      width: number;
      height: number;
      size: number;
    } | null>,

  /**
   * Get thumbnail as data URL (for rendering in browser)
   * @param sdId Storage directory ID
   * @param imageId Image ID
   * @returns Data URL string or null if not found
   */
  getDataUrl: (sdId: string, imageId: string): Promise<string | null> =>
    ipcRenderer.invoke('thumbnail:getDataUrl', sdId, imageId) as Promise<string | null>,

  /**
   * Check if a thumbnail exists
   * @param sdId Storage directory ID
   * @param imageId Image ID
   */
  exists: (sdId: string, imageId: string): Promise<boolean> =>
    ipcRenderer.invoke('thumbnail:exists', sdId, imageId) as Promise<boolean>,

  /**
   * Delete a thumbnail
   * @param sdId Storage directory ID
   * @param imageId Image ID
   */
  delete: (sdId: string, imageId: string): Promise<void> =>
    ipcRenderer.invoke('thumbnail:delete', sdId, imageId) as Promise<void>,

  /**
   * Force regenerate a thumbnail
   * @param sdId Storage directory ID
   * @param imageId Image ID
   * @returns Thumbnail result or null if not found
   */
  generate: (
    sdId: string,
    imageId: string
  ): Promise<{
    path: string;
    format: 'jpeg' | 'png' | 'gif';
    width: number;
    height: number;
    size: number;
  } | null> =>
    ipcRenderer.invoke('thumbnail:generate', sdId, imageId) as Promise<{
      path: string;
      format: 'jpeg' | 'png' | 'gif';
      width: number;
      height: number;
      size: number;
    } | null>,
};
