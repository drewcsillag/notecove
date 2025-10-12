import { z } from 'zod';

/**
 * Core note schema defining the structure of a note document
 */
export const NoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  created: z.string().datetime(),
  modified: z.string().datetime(),
  tags: z.array(z.string()).default([]),
  syncPoints: z.array(z.string()).default([]),
  attachments: z.array(z.string()).default([]),
  deleted: z.boolean().default(false),
  version: z.number().default(1),
  // CRDT document will be added later
  document: z.record(z.any()).optional()
});

export type Note = z.infer<typeof NoteSchema>;

/**
 * Sync point configuration schema
 */
export const SyncPointSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  path: z.string(),
  enabled: z.boolean().default(true),
  lastSync: z.string().datetime().optional(),
  created: z.string().datetime()
});

export type SyncPoint = z.infer<typeof SyncPointSchema>;

/**
 * Application settings schema
 */
export const SettingsSchema = z.object({
  syncPoints: z.array(SyncPointSchema).default([]),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  fontSize: z.number().min(12).max(24).default(16),
  fontFamily: z.string().default('AtlasGrotesk'),
  editorMode: z.enum(['rich', 'markdown']).default('rich'),
  autoSave: z.boolean().default(true),
  autoSaveInterval: z.number().min(1000).max(30000).default(5000), // ms
  lastOpenNote: z.string().uuid().optional(),
  windowGeometry: z.object({
    width: z.number().default(1200),
    height: z.number().default(800),
    x: z.number().optional(),
    y: z.number().optional()
  }).optional()
});

export type Settings = z.infer<typeof SettingsSchema>;

/**
 * Tag schema for note organization
 */
export const TagSchema = z.object({
  name: z.string(),
  color: z.string().optional(),
  count: z.number().default(0)
});

export type Tag = z.infer<typeof TagSchema>;

/**
 * Search result schema
 */
export const SearchResultSchema = z.object({
  noteId: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  matches: z.array(z.object({
    type: z.enum(['title', 'content', 'tag']),
    text: z.string(),
    start: z.number(),
    end: z.number()
  })),
  score: z.number()
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * CRDT operation schema for synchronization
 */
export const CRDTOperationSchema = z.object({
  id: z.string().uuid(),
  noteId: z.string().uuid(),
  timestamp: z.string().datetime(),
  operation: z.record(z.any()), // Yjs/Loro specific operation data
  author: z.string() // Device/user identifier
});

export type CRDTOperation = z.infer<typeof CRDTOperationSchema>;

/**
 * Validation helpers
 */
export const validateNote = (data: unknown): Note => {
  return NoteSchema.parse(data);
};

export const validateSettings = (data: unknown): Settings => {
  return SettingsSchema.parse(data);
};

export const validateSyncPoint = (data: unknown): SyncPoint => {
  return SyncPointSchema.parse(data);
};