/**
 * Manual script to extract content from a pack file
 *
 * Usage: NODE_ENV=test node dist/cjs/__manual__/extract-pack.js <pack-file>
 */

import * as fs from 'fs/promises';
import * as Y from 'yjs';

interface PackUpdate {
  seq: number;
  timestamp: number;
  data: number[];
}

interface PackData {
  version: number;
  instanceId: string;
  noteId: string;
  sequenceRange: [number, number];
  updates: PackUpdate[];
}

async function main() {
  const packFile = process.argv[2];
  if (!packFile) {
    console.error('Usage: NODE_ENV=test node dist/cjs/__manual__/extract-pack.js <pack-file>');
    process.exit(1);
  }

  try {
    const fileData = await fs.readFile(packFile, 'utf-8');
    console.log(`Read pack file: ${fileData.length} bytes`);

    // Parse the JSON
    const pack: PackData = JSON.parse(fileData);

    console.log(`Instance ID: ${pack.instanceId}`);
    console.log(`Note ID: ${pack.noteId}`);
    console.log(`Sequence range: ${pack.sequenceRange[0]}-${pack.sequenceRange[1]}`);
    console.log(`Total updates in pack: ${pack.updates.length}`);

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

    // Create a new doc and apply updates sequentially
    const doc = new Y.Doc();
    let lastText = '';

    for (let i = 0; i < pack.updates.length; i++) {
      const update = pack.updates[i];
      const updateData = new Uint8Array(update.data);

      try {
        Y.applyUpdate(doc, updateData);

        const currentText = extractText(doc);
        const wasChange = currentText !== lastText;

        if (wasChange) {
          console.log(`\n${'='.repeat(80)}`);
          console.log(`After Update ${i + 1}/${pack.updates.length} - Sequence ${update.seq}`);
          console.log(`Timestamp: ${new Date(update.timestamp).toISOString()}`);
          console.log(`Content length: ${currentText.length} chars`);
          console.log(`${'='.repeat(80)}`);
          console.log(currentText || '(empty)');
        }

        lastText = currentText;
      } catch (error) {
        console.error(`\nError applying update ${i + 1} (seq ${update.seq}):`, (error as Error).message);
      }
    }

    console.log(`\n\n${'='.repeat(80)}`);
    console.log('FINAL PACK STATE');
    console.log(`${'='.repeat(80)}`);
    console.log(`Total characters: ${lastText.length}`);
    console.log('Content:');
    console.log(lastText || '(empty)');
  } catch (error) {
    console.error('Error:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

main().catch(console.error);
