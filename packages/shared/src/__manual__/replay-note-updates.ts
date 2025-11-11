/**
 * Manual script to replay CRDT updates and show document state at each point
 *
 * Usage: NODE_ENV=test node dist/cjs/__manual__/replay-note-updates.js <note-directory>
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as Y from 'yjs';

async function main() {
  const noteDir = process.argv[2];
  if (!noteDir) {
    console.error('Usage: NODE_ENV=test node dist/cjs/__manual__/replay-note-updates.js <note-directory>');
    process.exit(1);
  }

  const updatesDir = path.join(noteDir, 'updates');

  // Read all update files
  const allFiles = await fs.readdir(updatesDir);
  const files = allFiles
    .filter(f => f.endsWith('.yjson'))
    .map(f => {
      // Parse filename: instanceId_noteId_timestamp-sequence.yjson
      const match = f.match(/_(\d+)-(\d+)\.yjson$/);
      if (!match) return null;
      return {
        filename: f,
        path: path.join(updatesDir, f),
        sequence: parseInt(match[2], 10),
        timestamp: parseInt(match[1], 10),
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null)
    .sort((a, b) => a.sequence - b.sequence);

  console.log(`Found ${files.length} update files\n`);

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

  // Replay updates
  const doc = new Y.Doc();
  let lastText = '';

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    try {
      const fileData = await fs.readFile(file.path);
      const size = fileData.length;

      // Skip the first byte (0x01 prefix indicating write completion)
      const updateData = fileData.slice(1);

      // Apply update
      Y.applyUpdate(doc, updateData);

      // Extract text
      const currentText = extractText(doc);
      const charCount = currentText.length;

      // Check if this was a deletion
      const wasDeletion = lastText.length > 0 && currentText.length < lastText.length;
      const deletedChars = wasDeletion ? lastText.length - currentText.length : 0;

      console.log(`\n${'='.repeat(80)}`);
      console.log(`Update ${index + 1}/${files.length} - Sequence ${file.sequence}`);
      console.log(`File: ${file.filename}`);
      console.log(`Size: ${size} bytes | Content length: ${charCount} chars`);

      if (wasDeletion) {
        console.log(`⚠️  DELETION: Removed ${deletedChars} characters`);
      }

      console.log(`${'='.repeat(80)}`);
      console.log('Content:');
      console.log(currentText || '(empty)');

      lastText = currentText;
    } catch (error) {
      console.error(`Error processing ${file.filename}:`, (error as Error).message);
    }
  }

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('FINAL STATE');
  console.log(`${'='.repeat(80)}`);
  console.log(`Total characters: ${lastText.length}`);
  console.log('Content:');
  console.log(lastText || '(empty)');
}

main().catch(console.error);
