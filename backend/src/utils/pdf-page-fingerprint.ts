import { createHash, type Hash } from 'crypto';
import { PDFArray, PDFDocument, PDFNumber, PDFObject, PDFRawStream, PDFRef } from 'pdf-lib';

function hashPdfObject(hash: Hash, value: PDFObject | undefined): void {
  if (!value) return;
  if (value instanceof PDFArray) {
    hash.update('[');
    for (let i = 0; i < value.size(); i += 1) {
      hashPdfObject(hash, value.get(i));
    }
    hash.update(']');
    return;
  }
  if (value instanceof PDFNumber) {
    hash.update(String(value.asNumber()));
    return;
  }
  if (
    value instanceof PDFRawStream ||
    typeof (value as { getContents?: () => Uint8Array }).getContents === 'function'
  ) {
    const bytes = (value as { getContents: () => Uint8Array }).getContents();
    hash.update(bytes);
  }
}

/**
 * Stable fingerprint for a single PDF page.
 * Hashes the page content stream, not a re-saved PDF. pdf-lib stamps ModDate
 * on every save, so a wrapper-file hash changes every second and field
 * placement falls back to page numbers.
 */
export async function computePdfPageFingerprints(buffer: Buffer): Promise<string[]> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const hashes: string[] = [];

  for (const page of doc.getPages()) {
    const hash = createHash('sha256');
    const { width, height } = page.getSize();
    hash.update(`${width}x${height}@${page.getRotation().angle}`);
    const contents = page.node.Contents();
    if (contents instanceof PDFArray) {
      for (let i = 0; i < contents.size(); i += 1) {
        const item = contents.get(i);
        const stream = item instanceof PDFRef ? doc.context.lookup(item) : item;
        hashPdfObject(hash, stream);
      }
    } else if (contents instanceof PDFRef) {
      hashPdfObject(hash, doc.context.lookup(contents));
    } else {
      hashPdfObject(hash, contents);
    }
    hashes.push(hash.digest('hex').slice(0, 16));
  }

  return hashes;
}

export function pageHashForPageNumber(
  fingerprints: string[],
  page: number,
): string | undefined {
  const index = Math.max(0, Math.floor(page) - 1);
  return fingerprints[index]?.trim() || undefined;
}
