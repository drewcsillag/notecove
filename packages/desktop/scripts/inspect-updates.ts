/**
 * Tool to inspect Yjs updates and see what operations they contain
 *
 * Usage: npx tsx scripts/inspect-updates.ts <note-path> <start-timestamp> <end-timestamp>
 */

import * as Y from 'yjs';
import * as fs from 'fs';
import * as path from 'path';
import { parseUpdateFilename } from '../../shared/src/crdt/update-format';
import { parsePackFilename, decodePackFile } from '../../shared/src/crdt/pack-format';

async function inspectUpdate(data: Uint8Array, label: string): Promise<void> {
  // Create a temporary document to apply the update
  const doc = new Y.Doc();

  try {
    Y.applyUpdate(doc, data);

    // Inspect what's in the document
    const content = doc.getXmlFragment('content');
    const metadata = doc.get('metadata');

    console.log(`\n=== ${label} ===`);
    console.log(`Update size: ${data.length} bytes`);
    console.log(`Content fragment length: ${content.length}`);

    if (content.length > 0) {
      console.log('Content structure:');
      content.forEach((child, idx) => {
        if (child instanceof Y.XmlElement) {
          console.log(`  [${idx}] ${child.nodeName} (${child.length} children)`);
          if (child.length > 0) {
            child.forEach((subchild, subidx) => {
              if (subchild instanceof Y.XmlText) {
                const text = subchild.toString();
                console.log(
                  `    [${subidx}] Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`
                );
              } else if (subchild instanceof Y.XmlElement) {
                console.log(
                  `    [${subidx}] ${subchild.constructor.name}: ${subchild.nodeName || 'unknown'}`
                );
              }
            });
          }
        } else if (child instanceof Y.XmlText) {
          const text = child.toString();
          console.log(
            `  [${idx}] Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`
          );
        }
      });
    }

    if (metadata) {
      console.log('Has metadata');
    }

    // Also check what types exist in the document
    const sharedTypes = Array.from(doc.share.keys());
    console.log(`Shared types: ${sharedTypes.join(', ')}`);
  } catch (error) {
    console.error(`Failed to apply update for ${label}:`, error);
  }
}

async function main() {
  const notePath = process.argv[2];
  const startTime = parseInt(process.argv[3] || '0', 10);
  const endTime = parseInt(process.argv[4] || String(Date.now() * 1000), 10);

  if (!notePath) {
    console.error(
      'Usage: npx tsx scripts/inspect-updates.ts <note-path> [start-timestamp] [end-timestamp]'
    );
    process.exit(1);
  }

  console.log(`Inspecting updates for note: ${notePath}`);
  console.log(`Time range: ${startTime} - ${endTime}`);

  // Read pack files
  const packsDir = path.join(notePath, 'packs');
  if (fs.existsSync(packsDir)) {
    const packFiles = fs
      .readdirSync(packsDir)
      .filter((f) => f.endsWith('.yjson.zst') || f.endsWith('.yjson'));

    for (const packFile of packFiles) {
      const packPath = path.join(packsDir, packFile);
      const packMeta = parsePackFilename(packFile);

      if (!packMeta) continue;

      console.log(`\n### Pack: ${packFile} ###`);

      const packData = fs.readFileSync(packPath);

      // For now, just skip compressed packs - we'd need zstd to decompress
      if (packFile.endsWith('.zst')) {
        console.log('Skipping compressed pack (need zstd)');
        continue;
      }

      try {
        const decoded = await decodePackFile(packData);
        console.log(
          `Instance: ${decoded.instanceId}, sequences: ${decoded.sequenceRange[0]}-${decoded.sequenceRange[1]}`
        );

        // Check each update in the pack
        for (const entry of decoded.updates) {
          if (entry.timestamp >= startTime && entry.timestamp <= endTime) {
            await inspectUpdate(
              entry.data,
              `Pack ${packFile} seq=${entry.seq} ts=${entry.timestamp}`
            );
          }
        }
      } catch (error) {
        console.error(`Failed to decode pack ${packFile}:`, error);
      }
    }
  }

  // Read individual update files
  const updatesDir = path.join(notePath, 'updates');
  if (fs.existsSync(updatesDir)) {
    const updateFiles = fs
      .readdirSync(updatesDir)
      .filter((f) => f.endsWith('.yjson'))
      .sort();

    console.log(`\n### Individual Updates (${updateFiles.length} files) ###`);

    let inspected = 0;
    for (const updateFile of updateFiles) {
      const updatePath = path.join(updatesDir, updateFile);
      const fileMeta = parseUpdateFilename(updateFile);

      if (!fileMeta || !fileMeta.timestamp) continue;

      if (fileMeta.timestamp >= startTime && fileMeta.timestamp <= endTime) {
        const data = fs.readFileSync(updatePath);

        // Skip status byte if present
        const updateData = data[0] === 0x00 || data[0] === 0x01 ? data.slice(1) : data;

        await inspectUpdate(updateData, `Update ${updateFile}`);
        inspected++;

        // Limit output
        if (inspected >= 10) {
          console.log(`\n... stopping after 10 updates (out of ${updateFiles.length} total)`);
          break;
        }
      }
    }
  }
}

main().catch(console.error);
