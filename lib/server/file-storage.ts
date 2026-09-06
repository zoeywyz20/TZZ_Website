import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const DEFAULT_MAX_FILE_SIZE = 52_428_800;
const roots = {
  blobs: process.env.FILE_STORAGE_ROOT ?? '/home/wyz/tzz-data/blobs',
  tmp: process.env.UPLOAD_TMP_ROOT ?? '/home/wyz/tzz-data/tmp',
  quarantine: process.env.QUARANTINE_ROOT ?? '/home/wyz/tzz-data/quarantine',
  exports: process.env.EXPORT_ROOT ?? '/home/wyz/tzz-data/exports',
  thumbnails: process.env.THUMBNAIL_ROOT ?? '/home/wyz/tzz-data/thumbnails',
} as const;

const configuredMax = Number.parseInt(process.env.FILE_MAX_SIZE_BYTES ?? String(DEFAULT_MAX_FILE_SIZE), 10);
export const MAX_FILE_SIZE_BYTES = Number.isSafeInteger(configuredMax) && configuredMax > 0 ? configuredMax : DEFAULT_MAX_FILE_SIZE;

const blockedExtensions = new Set([
  'apk', 'app', 'bat', 'cmd', 'com', 'cpl', 'dll', 'exe', 'gadget', 'hta', 'inf', 'ins',
  'iso', 'jar', 'js', 'jse', 'lib', 'lnk', 'mde', 'msc', 'msi', 'msp', 'mst', 'pif', 'ps1',
  'reg', 'scr', 'sct', 'sh', 'sys', 'vb', 'vbe', 'vbs', 'ws', 'wsc', 'wsf', 'wsh',
]);
const blockedMimeTypes = new Set([
  'application/x-dosexec', 'application/x-executable', 'application/x-msdownload',
  'application/x-sh', 'application/x-msi',
]);

export class StorageValidationError extends Error {}

export type StoredUpload = { storageKey: string; size: bigint; sha256: string };

export function storageRoots() {
  return { ...roots };
}

export function validateStorageKey(storageKey: string): string {
  if (typeof storageKey !== 'string' || storageKey.length === 0 || storageKey.length > 180) {
    throw new StorageValidationError('Invalid storage key.');
  }
  if (path.isAbsolute(storageKey) || storageKey.includes('\\') || storageKey.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new StorageValidationError('Invalid storage key.');
  }
  if (!/^[a-f0-9]{2}\/[a-f0-9]{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,16}$/.test(storageKey)) {
    throw new StorageValidationError('Invalid storage key.');
  }
  return storageKey;
}

export function createStorageKey(originalFilename: string): string {
  const extension = extensionOf(originalFilename);
  const id = randomUUID().toLowerCase();
  return `${id.slice(0, 2)}/${id.slice(2, 4)}/${id}.${extension}`;
}

export function assertUploadAllowed(originalFilename: string, mimeType: string, contentLength?: number): void {
  if (!originalFilename || originalFilename.length > 255 || originalFilename.includes('\0')) {
    throw new StorageValidationError('Invalid filename.');
  }
  const extension = extensionOf(originalFilename);
  if (blockedExtensions.has(extension) || blockedMimeTypes.has(mimeType.toLowerCase())) {
    throw new StorageValidationError('Executable files are not allowed.');
  }
  if (contentLength !== undefined && (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > MAX_FILE_SIZE_BYTES)) {
    throw new StorageValidationError('File exceeds the maximum permitted size.');
  }
}

export async function writeRequestToTemporaryFile(body: ReadableStream<Uint8Array> | null, originalFilename: string): Promise<StoredUpload & { temporaryPath: string }> {
  if (!body) throw new StorageValidationError('Missing upload body.');
  await mkdir(roots.tmp, { recursive: true, mode: 0o770 });
  const temporaryPath = path.join(roots.tmp, `${randomUUID().toLowerCase()}.part`);
  let size = 0;
  const digest = createHash('sha256');
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      if (size > MAX_FILE_SIZE_BYTES) {
        callback(new StorageValidationError('File exceeds the maximum permitted size.'));
        return;
      }
      digest.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(body as never), meter, createWriteStream(temporaryPath, { flags: 'wx', mode: 0o660 }));
    if (size === 0) throw new StorageValidationError('Empty files are not allowed.');
    return { temporaryPath, storageKey: createStorageKey(originalFilename), size: BigInt(size), sha256: digest.digest('hex') };
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function commitTemporaryFile(temporaryPath: string, storageKey: string): Promise<string> {
  const destination = storagePath(storageKey);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o750 });
  try {
    await rename(temporaryPath, destination);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
  return destination;
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  await rm(storagePath(storageKey), { force: true });
}

export async function openStoredFile(storageKey: string): Promise<{ path: string; size: number }> {
  const filePath = storagePath(storageKey);
  const info = await stat(filePath);
  if (!info.isFile()) throw new StorageValidationError('Stored object is not a file.');
  return { path: filePath, size: info.size };
}

function storagePath(storageKey: string): string {
  const validKey = validateStorageKey(storageKey);
  const root = path.resolve(roots.blobs);
  const candidate = path.resolve(root, validKey);
  if (!candidate.startsWith(`${root}${path.sep}`)) throw new StorageValidationError('Invalid storage key.');
  return candidate;
}

function extensionOf(filename: string): string {
  const name = path.basename(filename.trim());
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : 'bin';
  return /^[a-z0-9]{1,16}$/.test(extension) ? extension : 'bin';
}
