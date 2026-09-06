import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { createStorageKey, storageRoots } from '../lib/server/file-storage';

type Options = { dryRun: boolean; uploaderId?: string; departmentId?: string; folderId?: string };

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.uploaderId) throw new Error('Usage: tsx scripts/import-existing-files.ts --uploader-id <profile-uuid> [--department-id <uuid>] [--folder-id <uuid>] [--dry-run]');
  const importRoot = path.resolve(process.env.IMPORT_ROOT ?? '/home/wyz/tzz-data/import');
  const sourceInfo = await stat(importRoot).catch(() => null);
  if (!sourceInfo?.isDirectory()) throw new Error(`Import directory does not exist: ${importRoot}`);
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const uploader = await db.profile.findUnique({ where: { id: options.uploaderId }, select: { id: true, departmentId: true } });
  if (!uploader) throw new Error('Uploader profile was not found.');
  const departmentId = options.departmentId ?? uploader.departmentId ?? undefined;
  if (options.folderId && !await db.folder.findUnique({ where: { id: options.folderId }, select: { id: true } })) throw new Error('Folder was not found.');
  const candidates = await filesUnder(importRoot);
  let imported = 0; let skipped = 0;
  for (const source of candidates) {
    const info = await stat(source);
    if (!info.isFile()) continue;
    const hash = await sha256(source);
    const existing = await db.fileRecord.findFirst({ where: { hash, deletedAt: null }, select: { id: true } });
    if (existing) { console.log(`SKIP duplicate ${relative(importRoot, source)}`); skipped++; continue; }
    const filename = path.basename(source);
    const storageKey = createStorageKey(filename);
    console.log(`${options.dryRun ? 'DRY-RUN' : 'IMPORT'} ${relative(importRoot, source)} -> ${storageKey}`);
    if (options.dryRun) { imported++; continue; }
    const destination = path.join(storageRoots().blobs, storageKey);
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o750 });
    await rename(source, destination);
    try {
      await db.$transaction(async (tx) => {
        const file = await tx.fileRecord.create({ data: { originalFilename: filename, storageKey, mimeType: mimeType(filename), size: BigInt(info.size), hash, uploaderId: uploader.id, departmentId, folderId: options.folderId } });
        await tx.fileVersion.create({ data: { fileId: file.id, versionNumber: 1, storageKey, size: BigInt(info.size), uploaderId: uploader.id, changeNote: 'Imported from existing local storage' } });
      });
      imported++;
    } catch (error) {
      await mkdir(path.dirname(source), { recursive: true });
      await rename(destination, source).catch(() => undefined);
      throw error;
    }
  }
  console.log(`Completed: ${imported} ${options.dryRun ? 'would import' : 'imported'}, ${skipped} skipped.`);
  await db.$disconnect();
}

async function filesUnder(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const candidate = path.join(root, entry.name);
    if (entry.isFile()) paths.push(candidate);
    else if (entry.isDirectory()) paths.push(...await filesUnder(candidate));
  }
  return paths.sort();
}

async function sha256(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function parseArgs(args: string[]): Options {
  const options: Options = { dryRun: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--uploader-id') options.uploaderId = args[++index];
    else if (arg === '--department-id') options.departmentId = args[++index];
    else if (arg === '--folder-id') options.folderId = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function relative(root: string, file: string) { return path.relative(root, file).replaceAll(path.sep, '/'); }
function mimeType(filename: string) {
  const extension = path.extname(filename).slice(1).toLowerCase();
  return ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', zip: 'application/zip' } as Record<string, string>)[extension] ?? 'application/octet-stream';
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Import failed.'); process.exitCode = 1; });
