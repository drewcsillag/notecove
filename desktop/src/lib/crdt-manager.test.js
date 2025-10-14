/**
 * Tests for CRDTManager
 * Critical: These tests verify CRDT operations and TipTap integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CRDTManager } from './crdt-manager.js';
import * as Y from 'yjs';

describe('CRDTManager', () => {
  let manager;
  const noteId = 'test-note-123';

  beforeEach(() => {
    manager = new CRDTManager();
  });

  describe('Document Management', () => {
    it('should create a new Y.Doc for a note', () => {
      const doc = manager.getDoc(noteId);
      expect(doc).toBeInstanceOf(Y.Doc);
    });

    it('should return the same Y.Doc for subsequent calls', () => {
      const doc1 = manager.getDoc(noteId);
      const doc2 = manager.getDoc(noteId);
      expect(doc1).toBe(doc2);
    });

    it('should create separate Y.Docs for different notes', () => {
      const doc1 = manager.getDoc('note-1');
      const doc2 = manager.getDoc('note-2');
      expect(doc1).not.toBe(doc2);
    });

    it('should track update events', () => {
      const updates = [];
      manager.addListener((event, data) => {
        if (event === 'doc-updated') {
          updates.push(data);
        }
      });

      const doc = manager.getDoc(noteId);
      const text = doc.getText('test');
      text.insert(0, 'Hello');

      expect(updates.length).toBe(1);
      expect(updates[0].noteId).toBe(noteId);
      expect(updates[0].update).toBeInstanceOf(Array);
    });

    it('should not track updates with origin "silent"', () => {
      const updates = [];
      manager.addListener((event, data) => {
        if (event === 'doc-updated') {
          updates.push(data);
        }
      });

      const doc = manager.getDoc(noteId);
      doc.transact(() => {
        const text = doc.getText('test');
        text.insert(0, 'Hello');
      }, 'silent');

      expect(updates.length).toBe(0);
    });

    it('should not track updates with origin "remote"', () => {
      const updates = [];
      manager.addListener((event, data) => {
        if (event === 'doc-updated') {
          updates.push(data);
        }
      });

      const doc = manager.getDoc(noteId);
      doc.transact(() => {
        const text = doc.getText('test');
        text.insert(0, 'Hello');
      }, 'remote');

      expect(updates.length).toBe(0);
    });

    it('should remove documents correctly', () => {
      const doc = manager.getDoc(noteId);
      expect(manager.docs.has(noteId)).toBe(true);

      manager.removeDoc(noteId);
      expect(manager.docs.has(noteId)).toBe(false);
    });
  });

  describe('Note Initialization', () => {
    it('should initialize note with metadata', () => {
      const note = {
        id: noteId,
        title: 'Test Note',
        content: { type: 'doc', content: [] },
        created: '2025-01-01T00:00:00Z',
        modified: '2025-01-01T00:00:00Z',
        tags: ['test', 'demo'],
        folder: 'work'
      };

      manager.initializeNote(noteId, note);

      const doc = manager.getDoc(noteId);
      const metadata = doc.getMap('metadata');

      expect(metadata.get('title')).toBe('Test Note');
      expect(metadata.get('created')).toBe('2025-01-01T00:00:00Z');
      expect(metadata.get('modified')).toBe('2025-01-01T00:00:00Z');
      expect(metadata.get('tags')).toEqual(['test', 'demo']);
      expect(metadata.get('folder')).toBe('work');
    });

    it('should not reinitialize already initialized note', () => {
      const note1 = {
        id: noteId,
        title: 'Original Title',
        created: '2025-01-01T00:00:00Z',
        tags: []
      };

      manager.initializeNote(noteId, note1);

      const note2 = {
        id: noteId,
        title: 'New Title',
        created: '2025-01-02T00:00:00Z',
        tags: []
      };

      manager.initializeNote(noteId, note2);

      const doc = manager.getDoc(noteId);
      const metadata = doc.getMap('metadata');

      // Should keep original values
      expect(metadata.get('title')).toBe('Original Title');
      expect(metadata.get('created')).toBe('2025-01-01T00:00:00Z');
    });

    it('should handle missing optional fields', () => {
      const note = {
        id: noteId,
        title: 'Test Note'
      };

      manager.initializeNote(noteId, note);

      const doc = manager.getDoc(noteId);
      const metadata = doc.getMap('metadata');

      expect(metadata.get('title')).toBe('Test Note');
      expect(metadata.get('tags')).toEqual([]);
      expect(metadata.get('folder')).toBe(null);
      expect(metadata.get('created')).toBeDefined();
      expect(metadata.get('modified')).toBeDefined();
    });
  });

  describe('TipTap Integration', () => {
    it('should provide Y.XmlFragment for TipTap', () => {
      const fragment = manager.getContentFragment(noteId);
      expect(fragment).toBeInstanceOf(Y.XmlFragment);
    });

    it('should return the same fragment for a note', () => {
      const fragment1 = manager.getContentFragment(noteId);
      const fragment2 = manager.getContentFragment(noteId);
      expect(fragment1).toBe(fragment2);
    });

    it('should track changes to content fragment', () => {
      const updates = [];
      manager.addListener((event, data) => {
        if (event === 'doc-updated') {
          updates.push(data);
        }
      });

      const doc = manager.getDoc(noteId);
      const fragment = manager.getContentFragment(noteId);

      // Simulate TipTap editing the fragment
      doc.transact(() => {
        const paragraph = new Y.XmlElement('paragraph');
        const text = new Y.XmlText();
        text.insert(0, 'Hello World');
        paragraph.insert(0, [text]);
        fragment.insert(0, [paragraph]);
      });

      expect(updates.length).toBeGreaterThan(0);
    });
  });

  describe('Metadata Updates', () => {
    beforeEach(() => {
      manager.initializeNote(noteId, {
        id: noteId,
        title: 'Original Title',
        tags: ['tag1']
      });
    });

    it('should update title', () => {
      manager.updateMetadata(noteId, { title: 'New Title' });

      const doc = manager.getDoc(noteId);
      const metadata = doc.getMap('metadata');
      expect(metadata.get('title')).toBe('New Title');
    });

    it('should update tags', () => {
      manager.updateMetadata(noteId, { tags: ['tag1', 'tag2', 'tag3'] });

      const doc = manager.getDoc(noteId);
      const metadata = doc.getMap('metadata');
      expect(metadata.get('tags')).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should update folder', () => {
      manager.updateMetadata(noteId, { folder: 'projects' });

      const doc = manager.getDoc(noteId);
      const metadata = doc.getMap('metadata');
      expect(metadata.get('folder')).toBe('projects');
    });

    it('should update modified timestamp', async () => {
      const doc = manager.getDoc(noteId);
      const metadata = doc.getMap('metadata');
      const originalModified = metadata.get('modified');

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));
      manager.updateMetadata(noteId, { title: 'Updated' });

      const newModified = metadata.get('modified');
      expect(newModified).not.toBe(originalModified);
    });

    it('should handle multiple metadata updates', () => {
      manager.updateMetadata(noteId, {
        title: 'Updated Title',
        tags: ['new', 'tags'],
        folder: 'archive'
      });

      const doc = manager.getDoc(noteId);
      const metadata = doc.getMap('metadata');

      expect(metadata.get('title')).toBe('Updated Title');
      expect(metadata.get('tags')).toEqual(['new', 'tags']);
      expect(metadata.get('folder')).toBe('archive');
    });
  });

  describe('Note Extraction', () => {
    it('should extract note from Y.Doc', () => {
      manager.initializeNote(noteId, {
        id: noteId,
        title: 'Test Note',
        created: '2025-01-01T00:00:00Z',
        modified: '2025-01-01T00:00:00Z',
        tags: ['test'],
        folder: 'work'
      });

      const note = manager.getNoteFromDoc(noteId);

      expect(note.id).toBe(noteId);
      expect(note.title).toBe('Test Note');
      expect(note.created).toBe('2025-01-01T00:00:00Z');
      expect(note.modified).toBe('2025-01-01T00:00:00Z');
      expect(note.tags).toEqual(['test']);
      expect(note.folderId).toBe('work'); // Changed from note.folder to note.folderId
      expect(note.content).toBeDefined(); // Verify content is present
    });

    it('should provide default title for empty note', () => {
      manager.getDoc(noteId); // Create doc but don't initialize

      const note = manager.getNoteFromDoc(noteId);
      expect(note.title).toBe('Untitled');
    });

    it('should provide default values for missing metadata', () => {
      manager.getDoc(noteId);

      const note = manager.getNoteFromDoc(noteId);
      expect(note.tags).toEqual([]);
      expect(note.folderId).toBe('all-notes'); // Changed from note.folder to note.folderId with default value
      expect(note.title).toBe('Untitled'); // Verify title extraction works
      expect(note.content).toBeDefined(); // Verify content is present
    });
  });

  describe('State Management', () => {
    it('should check if document is empty', () => {
      expect(manager.isDocEmpty(noteId)).toBe(true);

      manager.initializeNote(noteId, {
        id: noteId,
        title: 'Test'
      });

      expect(manager.isDocEmpty(noteId)).toBe(false);
    });

    it('should get full state as update', () => {
      manager.initializeNote(noteId, {
        id: noteId,
        title: 'Test Note'
      });

      const state = manager.getState(noteId);
      expect(state).toBeInstanceOf(Uint8Array);
      expect(state.length).toBeGreaterThan(0);
    });

    it('should apply update from external source', () => {
      // Create two managers (simulating two instances)
      const manager1 = new CRDTManager();
      const manager2 = new CRDTManager();

      // Manager 1 creates a note
      manager1.initializeNote(noteId, {
        id: noteId,
        title: 'Test Note'
      });

      // Get the state from manager 1
      const state = manager1.getState(noteId);

      // Apply to manager 2
      manager2.applyUpdate(noteId, state);

      // Manager 2 should have the same note
      const note = manager2.getNoteFromDoc(noteId);
      expect(note.title).toBe('Test Note');
    });

    it('should track pending updates', () => {
      const doc = manager.getDoc(noteId);
      const metadata = doc.getMap('metadata');

      // Make a change (not silent or remote)
      metadata.set('title', 'Test');

      const pending = manager.getPendingUpdates(noteId);
      expect(pending.length).toBeGreaterThan(0);
    });

    it('should clear pending updates', () => {
      const doc = manager.getDoc(noteId);
      const metadata = doc.getMap('metadata');

      metadata.set('title', 'Test');
      expect(manager.getPendingUpdates(noteId).length).toBeGreaterThan(0);

      manager.clearPendingUpdates(noteId);
      expect(manager.getPendingUpdates(noteId).length).toBe(0);
    });
  });

  describe('Multi-instance CRDT Merging', () => {
    it('should merge concurrent edits correctly', () => {
      const manager1 = new CRDTManager();
      const manager2 = new CRDTManager();

      // Both start with empty docs
      manager1.initializeNote(noteId, { id: noteId, title: '' });
      manager2.initializeNote(noteId, { id: noteId, title: '' });

      // Manager 1: Set title to "Hello"
      manager1.updateMetadata(noteId, { title: 'Hello' });
      const update1 = manager1.getState(noteId);

      // Manager 2: Set title to "World"
      manager2.updateMetadata(noteId, { title: 'World' });
      const update2 = manager2.getState(noteId);

      // Apply updates to each other
      manager1.applyUpdate(noteId, update2, 'remote');
      manager2.applyUpdate(noteId, update1, 'remote');

      // Both should converge to the same state (Yjs picks one deterministically)
      const note1 = manager1.getNoteFromDoc(noteId);
      const note2 = manager2.getNoteFromDoc(noteId);

      expect(note1.title).toBe(note2.title);
    });

    it('should merge content fragment edits', () => {
      const manager1 = new CRDTManager();
      const manager2 = new CRDTManager();

      const doc1 = manager1.getDoc(noteId);
      const doc2 = manager2.getDoc(noteId);

      const fragment1 = manager1.getContentFragment(noteId);
      const fragment2 = manager2.getContentFragment(noteId);

      // Manager 1: Add "Hello"
      doc1.transact(() => {
        const p1 = new Y.XmlElement('paragraph');
        const t1 = new Y.XmlText();
        t1.insert(0, 'Hello');
        p1.insert(0, [t1]);
        fragment1.insert(0, [p1]);
      });

      // Manager 2: Add "World"
      doc2.transact(() => {
        const p2 = new Y.XmlElement('paragraph');
        const t2 = new Y.XmlText();
        t2.insert(0, 'World');
        p2.insert(0, [t2]);
        fragment2.insert(0, [p2]);
      });

      // Exchange updates
      const update1 = Y.encodeStateAsUpdate(doc1);
      const update2 = Y.encodeStateAsUpdate(doc2);

      Y.applyUpdate(doc1, update2, 'remote');
      Y.applyUpdate(doc2, update1, 'remote');

      // Both should have both paragraphs (order may vary but content is there)
      expect(fragment1.length).toBe(2);
      expect(fragment2.length).toBe(2);

      // Verify content
      const content1 = fragment1.toJSON();
      const content2 = fragment2.toJSON();
      expect(content1).toEqual(content2);
    });

    it('should handle incremental updates correctly', () => {
      const manager1 = new CRDTManager();
      const manager2 = new CRDTManager();

      manager1.initializeNote(noteId, { id: noteId, title: 'Start' });

      // Sync initial state
      const state0 = manager1.getState(noteId);
      manager2.applyUpdate(noteId, state0);

      // Manager 1 makes multiple edits
      manager1.updateMetadata(noteId, { title: 'Edit 1' });
      manager1.updateMetadata(noteId, { tags: ['tag1'] });
      manager1.updateMetadata(noteId, { folder: 'work' });

      // Get incremental updates
      const pendingUpdates = manager1.getPendingUpdates(noteId);

      // Apply each update to manager 2
      for (const update of pendingUpdates) {
        manager2.applyUpdate(noteId, new Uint8Array(update), 'remote');
      }

      // Both should be in sync
      const note1 = manager1.getNoteFromDoc(noteId);
      const note2 = manager2.getNoteFromDoc(noteId);

      expect(note1.title).toBe(note2.title);
      expect(note1.tags).toEqual(note2.tags);
      expect(note1.folder).toBe(note2.folder);
    });
  });

  describe('Statistics and Cleanup', () => {
    it('should provide statistics', () => {
      manager.getDoc('note-1');
      manager.getDoc('note-2');
      manager.getDoc('note-3');

      const stats = manager.getStats();
      expect(stats.documentCount).toBe(3);
      expect(stats.documents).toEqual(['note-1', 'note-2', 'note-3']);
    });

    it('should track pending updates in stats', () => {
      const doc = manager.getDoc(noteId);
      const metadata = doc.getMap('metadata');
      metadata.set('title', 'Test');

      const stats = manager.getStats();
      expect(stats.pendingUpdates.length).toBe(1);
      expect(stats.pendingUpdates[0].noteId).toBe(noteId);
      expect(stats.pendingUpdates[0].updateCount).toBeGreaterThan(0);
    });

    it('should cleanup all resources', () => {
      manager.getDoc('note-1');
      manager.getDoc('note-2');

      manager.destroy();

      expect(manager.docs.size).toBe(0);
      expect(manager.updateHandlers.size).toBe(0);
      expect(manager.pendingUpdates.size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string title', () => {
      manager.initializeNote(noteId, {
        id: noteId,
        title: ''
      });

      const note = manager.getNoteFromDoc(noteId);
      expect(note.title).toBe('Untitled');
    });

    it('should handle very large metadata', () => {
      const largeTags = Array.from({ length: 1000 }, (_, i) => `tag-${i}`);

      manager.initializeNote(noteId, {
        id: noteId,
        title: 'Test',
        tags: largeTags
      });

      const note = manager.getNoteFromDoc(noteId);
      expect(note.tags.length).toBe(1000);
    });

    it('should handle rapid sequential updates', () => {
      manager.initializeNote(noteId, { id: noteId, title: 'Start' });

      // Make 100 rapid updates
      for (let i = 0; i < 100; i++) {
        manager.updateMetadata(noteId, { title: `Update ${i}` });
      }

      const note = manager.getNoteFromDoc(noteId);
      expect(note.title).toBe('Update 99');

      const pending = manager.getPendingUpdates(noteId);
      expect(pending.length).toBeGreaterThan(0);
    });
  });
});
