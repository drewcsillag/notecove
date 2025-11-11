/**
 * Manual script to extract content from a snapshot file
 *
 * Usage: NODE_ENV=test node dist/cjs/__manual__/extract-snapshot.js <snapshot-file>
 */

import * as fs from 'fs/promises';
import * as Y from 'yjs';
import { decodeSnapshotFile } from '../crdt/snapshot-format';

async function main() {
  const snapshotFile = process.argv[2];
  if (!snapshotFile) {
    console.error('Usage: NODE_ENV=test node dist/cjs/__manual__/extract-snapshot.js <snapshot-file>');
    process.exit(1);
  }

  try {
    const fileData = await fs.readFile(snapshotFile);
    console.log(`Read snapshot file: ${fileData.length} bytes`);

    // Decode the snapshot using the proper format
    const snapshot = await decodeSnapshotFile(fileData);

    console.log(`Note ID: ${snapshot.noteId}`);
    console.log(`Timestamp: ${new Date(snapshot.timestamp).toISOString()}`);
    console.log(`Total changes: ${snapshot.totalChanges}`);
    console.log(`Document state size: ${snapshot.documentState.length} bytes`);

    // Apply the document state to a Yjs doc
    const doc = new Y.Doc();
    Y.applyUpdate(doc, snapshot.documentState);

    // Function to extract text from Yjs document
    function extractText(doc: Y.Doc): string {
      const content = doc.getXmlFragment('content');
      let text = '';

      content.forEach(item => {
        if (item instanceof Y.XmlText) {
          text += item.toString() + '\n';
        } else if (item instanceof Y.XmlElement) {
          const extractFromElement = (el: Y.XmlElement | Y.XmlText): string => {
            if (el instanceof Y.XmlText) {
              return el.toString();
            }
            let result = '';
            el.forEach((child: unknown) => {
              result += extractFromElement(child as Y.XmlElement | Y.XmlText);
            });
            return result;
          };
          text += extractFromElement(item) + '\n';
        }
      });

      return text.trim();
    }

    const text = extractText(doc);

    console.log('\n' + '='.repeat(80));
    console.log('SNAPSHOT CONTENT');
    console.log('='.repeat(80));
    console.log(text);
    console.log('='.repeat(80));
    console.log(`Total characters: ${text.length}`);
  } catch (error) {
    console.error('Error:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

main().catch(console.error);
