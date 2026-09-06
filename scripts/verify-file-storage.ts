import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertUploadAllowed, commitTemporaryFile, deleteStoredFile, openStoredFile, validateStorageKey, writeRequestToTemporaryFile } from '../lib/server/file-storage';

async function main() {
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('TZZ storage verification')); controller.close(); } });
  const staged = await writeRequestToTemporaryFile(body, '材料.pdf');
  assert.match(staged.storageKey, /^[a-f0-9]{2}\/[a-f0-9]{2}\/[0-9a-f-]+\.pdf$/);
  await commitTemporaryFile(staged.temporaryPath, staged.storageKey);
  const stored = await openStoredFile(staged.storageKey);
  assert.equal((await readFile(stored.path, 'utf8')), 'TZZ storage verification');
  await deleteStoredFile(staged.storageKey);
  for (const key of ['/etc/passwd', '../escape.pdf', 'ab//x.pdf', 'ab/cd/../../x.pdf', 'ab/cd/file.pdf']) {
    assert.throws(() => validateStorageKey(key));
  }
  assert.throws(() => assertUploadAllowed('danger.exe', 'application/octet-stream', 10));
  console.log('Storage verification passed.');
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
