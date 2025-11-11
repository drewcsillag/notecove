/**
 * Tests for StateReconstructor
 */

import * as Y from 'yjs';
import { StateReconstructor } from '../state-reconstructor';
import type { UpdateManager } from '../../storage/update-manager';
import type { HistoryUpdate, ActivitySession } from '../timeline-builder';

describe('StateReconstructor', () => {
  let mockUpdateManager: jest.Mocked<UpdateManager>;
  let stateReconstructor: StateReconstructor;

  beforeEach(() => {
    mockUpdateManager = {
      listSnapshotFiles: jest.fn(),
      readSnapshot: jest.fn(),
    } as unknown as jest.Mocked<UpdateManager>;

    stateReconstructor = new StateReconstructor(mockUpdateManager);
  });

  describe('reconstructAt', () => {
    it('should reconstruct from updates without snapshot', async () => {
      mockUpdateManager.listSnapshotFiles.mockResolvedValue([]);

      // Create test doc and capture updates using observer
      const doc = new Y.Doc();
      const capturedUpdates: Uint8Array[] = [];

      doc.on('update', (update: Uint8Array) => {
        capturedUpdates.push(update);
      });

      // First change - wrap in transaction to ensure separate update
      doc.transact(() => {
        const text1 = doc.getXmlFragment('content');
        const p1 = new Y.XmlElement('paragraph');
        const t1 = new Y.XmlText('Hello');
        p1.insert(0, [t1]);
        text1.insert(0, [p1]);
      });

      // Second change - wrap in transaction to ensure separate update
      doc.transact(() => {
        const text1 = doc.getXmlFragment('content');
        const p2 = text1.get(0) as Y.XmlElement;
        const t2 = p2.get(0) as Y.XmlText;
        t2.insert(5, ' World');
      });

      const updates: HistoryUpdate[] = [
        { instanceId: 'inst1', timestamp: 1000, sequence: 1, data: capturedUpdates[0] },
        { instanceId: 'inst1', timestamp: 2000, sequence: 2, data: capturedUpdates[1] },
      ];

      const reconstructedDoc = await stateReconstructor.reconstructAt('sd1', 'note1', updates, {
        timestamp: 2000,
      });

      // Verify reconstructed state
      const content = reconstructedDoc.getXmlFragment('content');
      const paragraph = content.get(0) as Y.XmlElement;
      const textNode = paragraph.get(0) as Y.XmlText;
      expect(textNode.toString()).toBe('Hello World');
    });

    it('should reconstruct up to specific timestamp', async () => {
      mockUpdateManager.listSnapshotFiles.mockResolvedValue([]);

      // Create test doc and capture updates using observer
      const doc = new Y.Doc();
      const capturedUpdates: Uint8Array[] = [];

      doc.on('update', (update: Uint8Array) => {
        capturedUpdates.push(update);
      });

      // First change - wrap in transaction to ensure separate update
      doc.transact(() => {
        const text1 = doc.getXmlFragment('content');
        const p1 = new Y.XmlElement('paragraph');
        const t1 = new Y.XmlText('First');
        p1.insert(0, [t1]);
        text1.insert(0, [p1]);
      });

      // Second change - wrap in transaction to ensure separate update
      doc.transact(() => {
        const text1 = doc.getXmlFragment('content');
        const p2 = text1.get(0) as Y.XmlElement;
        const t2 = p2.get(0) as Y.XmlText;
        t2.insert(5, ' Second');
      });

      const updates: HistoryUpdate[] = [
        { instanceId: 'inst1', timestamp: 1000, sequence: 1, data: capturedUpdates[0] },
        { instanceId: 'inst1', timestamp: 2000, sequence: 2, data: capturedUpdates[1] },
      ];

      // Reconstruct at timestamp 1500 (between the two updates)
      const reconstructedDoc = await stateReconstructor.reconstructAt('sd1', 'note1', updates, {
        timestamp: 1500,
      });

      const content = reconstructedDoc.getXmlFragment('content');
      const paragraph = content.get(0) as Y.XmlElement;
      const textNode = paragraph.get(0) as Y.XmlText;
      expect(textNode.toString()).toBe('First'); // Should not include " Second"
    });

    it('should use snapshot when available', async () => {
      // Create a snapshot at sequence 1 using update observer
      const snapshotDoc = new Y.Doc();
      const snapshotText = snapshotDoc.getXmlFragment('content');
      const snapshotP = new Y.XmlElement('paragraph');
      const snapshotT = new Y.XmlText('Snapshot');
      snapshotP.insert(0, [snapshotT]);
      snapshotText.insert(0, [snapshotP]);
      const snapshotData = Y.encodeStateAsUpdate(snapshotDoc);

      mockUpdateManager.listSnapshotFiles.mockResolvedValue([
        { totalChanges: 1, instanceId: 'inst1', filename: 'snap1' },
      ]);

      mockUpdateManager.readSnapshot.mockResolvedValue({
        version: 1,
        noteId: 'note1',
        timestamp: 1000,
        totalChanges: 1,
        maxSequences: { inst1: 1 },
        documentState: snapshotData,
      });

      // Create update 2 using observer
      const doc2 = new Y.Doc();
      Y.applyUpdate(doc2, snapshotData);
      const capturedUpdates: Uint8Array[] = [];

      doc2.on('update', (update: Uint8Array) => {
        capturedUpdates.push(update);
      });

      doc2.transact(() => {
        const text2 = doc2.getXmlFragment('content');
        const p2 = text2.get(0) as Y.XmlElement;
        const t2 = p2.get(0) as Y.XmlText;
        t2.insert(8, ' Content');
      });

      const updates: HistoryUpdate[] = [
        { instanceId: 'inst1', timestamp: 2000, sequence: 2, data: capturedUpdates[0] },
      ];

      const reconstructedDoc = await stateReconstructor.reconstructAt('sd1', 'note1', updates, {
        timestamp: 2000,
      });

      const content = reconstructedDoc.getXmlFragment('content');
      const paragraph = content.get(0) as Y.XmlElement;
      const textNode = paragraph.get(0) as Y.XmlText;
      expect(textNode.toString()).toBe('Snapshot Content');
    });

    it('should handle reconstruction with updateIndex', async () => {
      mockUpdateManager.listSnapshotFiles.mockResolvedValue([]);

      // Create test doc and capture updates using observer
      const doc = new Y.Doc();
      const capturedUpdates: Uint8Array[] = [];

      doc.on('update', (update: Uint8Array) => {
        capturedUpdates.push(update);
      });

      // First change - wrap in transaction
      doc.transact(() => {
        const text1 = doc.getXmlFragment('content');
        const p1 = new Y.XmlElement('paragraph');
        const t1 = new Y.XmlText('A');
        p1.insert(0, [t1]);
        text1.insert(0, [p1]);
      });

      // Second change - wrap in transaction
      doc.transact(() => {
        const text1 = doc.getXmlFragment('content');
        const p2 = text1.get(0) as Y.XmlElement;
        const t2 = p2.get(0) as Y.XmlText;
        t2.insert(1, 'B');
      });

      // Third change - wrap in transaction
      doc.transact(() => {
        const text1 = doc.getXmlFragment('content');
        const p3 = text1.get(0) as Y.XmlElement;
        const t3 = p3.get(0) as Y.XmlText;
        t3.insert(2, 'C');
      });

      const updates: HistoryUpdate[] = [
        { instanceId: 'inst1', timestamp: 1000, sequence: 1, data: capturedUpdates[0] },
        { instanceId: 'inst1', timestamp: 2000, sequence: 2, data: capturedUpdates[1] },
        { instanceId: 'inst1', timestamp: 3000, sequence: 3, data: capturedUpdates[2] },
      ];

      // Reconstruct up to index 1 (should have updates 0 and 1)
      const reconstructedDoc = await stateReconstructor.reconstructAt('sd1', 'note1', updates, {
        timestamp: 3000,
        updateIndex: 1,
      });

      const content = reconstructedDoc.getXmlFragment('content');
      const paragraph = content.get(0) as Y.XmlElement;
      const textNode = paragraph.get(0) as Y.XmlText;
      expect(textNode.toString()).toBe('AB'); // Should not include 'C'
    });
  });

  describe('getSessionPreview', () => {
    it('should extract text preview from session start and end', async () => {
      mockUpdateManager.listSnapshotFiles.mockResolvedValue([]);

      // Create test doc and capture updates using observer
      const doc = new Y.Doc();
      const capturedUpdates: Uint8Array[] = [];

      doc.on('update', (update: Uint8Array) => {
        capturedUpdates.push(update);
      });

      // First change - wrap in transaction
      doc.transact(() => {
        const text1 = doc.getXmlFragment('content');
        const p1 = new Y.XmlElement('paragraph');
        const t1 = new Y.XmlText('Start text');
        p1.insert(0, [t1]);
        text1.insert(0, [p1]);
      });

      // Second change - wrap in transaction
      doc.transact(() => {
        const text1 = doc.getXmlFragment('content');
        const p2 = text1.get(0) as Y.XmlElement;
        const t2 = p2.get(0) as Y.XmlText;
        t2.insert(10, ' and end text');
      });

      const updates: HistoryUpdate[] = [
        { instanceId: 'inst1', timestamp: 1000, sequence: 1, data: capturedUpdates[0] },
        { instanceId: 'inst1', timestamp: 2000, sequence: 2, data: capturedUpdates[1] },
      ];

      const session: ActivitySession = {
        id: 'session1',
        startTime: 1000,
        endTime: 2000,
        updateCount: 2,
        instanceIds: ['inst1'],
        updates,
      };

      const preview = await stateReconstructor.getSessionPreview('sd1', 'note1', session, updates);

      expect(preview.firstPreview).toBe('Start text');
      expect(preview.lastPreview).toBe('Start text and end text');
    });
  });
});
