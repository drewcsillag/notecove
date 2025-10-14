/**
 * Debug utility to decode and inspect CRDT update files
 */
import * as Y from 'yjs';
import * as fs from 'fs';

export function inspectCRDTFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const packedFile = JSON.parse(content);

    console.log('CRDT File:', filePath);
    console.log('  Instance:', packedFile.instance);
    console.log('  Sequence:', packedFile.sequence);
    console.log('  Timestamp:', packedFile.timestamp);
    console.log('  Updates:', packedFile.updates.length);

    // Decode all updates and merge them
    const doc = new Y.Doc();

    for (const updateStr of packedFile.updates) {
      const updateBytes = Buffer.from(updateStr, 'base64');
      Y.applyUpdate(doc, updateBytes, 'silent');
    }

    // Extract metadata
    const yMetadata = doc.getMap('metadata');
    console.log('  Metadata:');
    console.log('    title:', yMetadata.get('title'));
    console.log('    created:', yMetadata.get('created'));
    console.log('    modified:', yMetadata.get('modified'));
    console.log('    tags:', yMetadata.get('tags'));
    console.log('    folder:', yMetadata.get('folder'));

    // Extract content
    const fragment = doc.getXmlFragment('default');
    console.log('  Content fragment length:', fragment.length);

    if (fragment.length > 0) {
      // Try to get text representation
      let textContent = '';
      fragment.forEach(item => {
        if (item.toString) {
          textContent += item.toString();
        }
      });
      console.log('  Content text (first 200 chars):', textContent.substring(0, 200));
    }

    return { metadata: Object.fromEntries(yMetadata.entries()), fragmentLength: fragment.length };
  } catch (error) {
    console.error('Error inspecting CRDT file:', error);
    return null;
  }
}

// CLI usage - only run when this file is executed directly, not when imported
// Check if running as main module
if (import.meta.url === `file://${process.argv[1]}` && process.argv[2]) {
  inspectCRDTFile(process.argv[2]);
}
