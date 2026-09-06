import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, readdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { ImportStatus, PrismaClient, Visibility, type Folder } from '../generated/prisma/client';
import { createStorageKey, storageRoots } from '../lib/storage-core';

type Options = { dryRun: boolean; uploaderId?: string; departmentId?: string; source?: string; visibility?: Visibility };

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.uploaderId || !options.source || !options.visibility) throw new Error('Usage: tsx scripts/import-existing-files.ts --source <stable-source-id> --uploader-id <profile-uuid> --visibility ALL|DEPARTMENT [--department-id <uuid>] [--dry-run]');
  const importRoot = path.resolve(process.env.IMPORT_ROOT ?? '/home/wyz/tzz-data/import');
  if (!await isDirectory(importRoot)) throw new Error(`Import directory does not exist: ${importRoot}`);
  const connectionString = process.env.DATABASE_URL?.trim(); if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const uploader = await db.profile.findUnique({ where: { id: options.uploaderId }, select: { id: true, departmentId: true } });
    if (!uploader) throw new Error('Uploader profile was not found.');
    const departmentId = options.departmentId ?? uploader.departmentId ?? undefined;
    if (options.visibility === Visibility.DEPARTMENT && !departmentId) throw new Error('DEPARTMENT visibility requires --department-id or an uploader department.');
    if (!options.dryRun) await recoverPendingImports(db, options, importRoot, uploader.id, departmentId);
    for (const source of await filesUnder(importRoot)) {
      const relativePath = relative(importRoot, source); const info = await stat(source); const hash = await sha256(source);
      const prior = await db.importRecord.findUnique({ where: { source_relativePath: { source: options.source, relativePath } } });
      if (prior?.status === ImportStatus.COMPLETED) { console.log(`SKIP completed ${relativePath}`); continue; }
      if (options.dryRun) { console.log(`DRY-RUN relativePath=${relativePath} folderPath=${folderPath(relativePath).join('/') || '(root)'} departmentId=${departmentId ?? 'null'} visibility=${options.visibility} storageKey=preview-only`); continue; }
      const folderId = await ensureFolderTree(db, folderPath(relativePath), departmentId);
      const pending = prior ?? await db.importRecord.create({ data: { source: options.source, relativePath, storageKey: createStorageKey(path.basename(source)), hash } });
      const destination = path.join(storageRoots().blobs, pending.storageKey);
      if (await exists(source) && !await exists(destination)) { await mkdir(path.dirname(destination), { recursive: true, mode: 0o750 }); await rename(source, destination); }
      if (!await exists(destination)) throw new Error(`Pending import has neither source nor blob: ${relativePath}`);
      const existingFile = await db.fileRecord.findUnique({ where: { storageKey: pending.storageKey } });
      const file = existingFile ?? await db.$transaction(async (tx) => {
        const created = await tx.fileRecord.create({ data: { originalFilename: path.basename(source), storageKey: pending.storageKey, mimeType: mimeType(source), size: BigInt(info.size), hash, uploaderId: uploader.id, departmentId, folderId, visibility: options.visibility } });
        await tx.fileVersion.create({ data: { fileId: created.id, versionNumber: 1, storageKey: pending.storageKey, size: BigInt(info.size), uploaderId: uploader.id, changeNote: `Imported from ${options.source}:${relativePath}` } });
        return created;
      });
      await db.importRecord.update({ where: { id: pending.id }, data: { fileId: file.id, hash, status: ImportStatus.COMPLETED, completedAt: new Date() } });
      console.log(`IMPORTED ${relativePath}`);
    }
  } finally { await db.$disconnect(); }
}

async function recoverPendingImports(db: PrismaClient, options: Options, importRoot: string, uploaderId: string, departmentId?: string) {
  const pending = await db.importRecord.findMany({ where: { source: options.source, status: ImportStatus.PENDING } });
  for (const record of pending) {
    const source = path.join(importRoot, ...record.relativePath.split('/')); const blob = path.join(storageRoots().blobs, record.storageKey);
    const sourceExists = await exists(source); const blobExists = await exists(blob);
    if (!sourceExists && !blobExists) throw new Error(`BROKEN_PENDING_IMPORT ${record.relativePath}`);
    if (sourceExists && blobExists && await sha256(source) !== await sha256(blob)) throw new Error(`IMPORT_CONFLICT ${record.relativePath}`);
    if (sourceExists && !blobExists) { await mkdir(path.dirname(blob), { recursive: true, mode: 0o750 }); await rename(source, blob); }
    if (await sha256(blob) !== record.hash) throw new Error(`IMPORT_CONFLICT ${record.relativePath}`);
    const info = await stat(blob); const folderId = await ensureFolderTree(db, folderPath(record.relativePath), departmentId);
    const file = await db.fileRecord.findUnique({ where: { storageKey: record.storageKey } }) ?? await db.$transaction(async (tx) => { const created = await tx.fileRecord.create({ data: { originalFilename: path.basename(record.relativePath), storageKey: record.storageKey, mimeType: mimeType(record.relativePath), size: BigInt(info.size), hash: record.hash, uploaderId, departmentId, folderId, visibility: options.visibility! } }); await tx.fileVersion.create({ data: { fileId: created.id, versionNumber: 1, storageKey: record.storageKey, size: BigInt(info.size), uploaderId, changeNote: `Recovered import ${options.source}:${record.relativePath}` } }); return created; });
    await db.importRecord.update({ where: { id: record.id }, data: { fileId: file.id, status: ImportStatus.COMPLETED, completedAt: new Date() } });
    console.log(`RECOVERED ${record.relativePath}`);
  }
}

async function ensureFolderTree(db: PrismaClient, names: string[], departmentId?: string) {
  let parentId: string | null = null;
  for (const name of names) {
    let folder: Folder | null = await db.folder.findFirst({ where: { parentId, departmentId: departmentId ?? null, name } });
    if (!folder) {
      try { folder = await db.folder.create({ data: { name, parentId, departmentId } }); }
      catch { folder = await db.folder.findFirst({ where: { parentId, departmentId: departmentId ?? null, name } }); if (!folder) throw new Error(`Cannot create folder ${name}`); }
    }
    parentId = folder.id;
  }
  return parentId ?? undefined;
}
async function filesUnder(root: string): Promise<string[]> { const entries = await readdir(root, { withFileTypes: true }); const result: string[] = []; for (const entry of entries) { const candidate = path.join(root, entry.name); if (entry.isFile()) result.push(candidate); else if (entry.isDirectory()) result.push(...await filesUnder(candidate)); } return result.sort(); }
async function sha256(file: string) { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }
async function exists(file: string) { return access(file).then(() => true).catch(() => false); }
async function isDirectory(file: string) { return stat(file).then((value) => value.isDirectory()).catch(() => false); }
function relative(root: string, file: string) { return path.relative(root, file).replaceAll(path.sep, '/'); }
function folderPath(relativePath: string) { return relativePath.split('/').slice(0, -1); }
function mimeType(filename: string) { const extension = path.extname(filename).slice(1).toLowerCase(); return ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as Record<string, string>)[extension] ?? 'application/octet-stream'; }
function parseArgs(args: string[]): Options { const output: Options = { dryRun: false }; for (let index = 0; index < args.length; index++) { const key = args[index]; if (key === '--dry-run') output.dryRun = true; else if (key === '--source') output.source = args[++index]; else if (key === '--uploader-id') output.uploaderId = args[++index]; else if (key === '--department-id') output.departmentId = args[++index]; else if (key === '--visibility') { const value = args[++index]; if (value !== 'ALL' && value !== 'DEPARTMENT') throw new Error('--visibility must be ALL or DEPARTMENT'); output.visibility = value; } else throw new Error(`Unknown argument: ${key}`); } return output; }
void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Import failed.'); process.exitCode = 1; });
