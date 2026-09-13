import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, copyFile, mkdir, readFile, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';
import { FileStatus, ImportStatus, PrismaClient, Visibility, type Folder } from '../generated/prisma/client';

// Production service variables remain authoritative; this only makes the CLI
// usable from the project directory during an administrator-run import.
loadEnv({ path: '.env.local', override: false, quiet: true });

type Row = Record<string, string>;
type Options = { apply: boolean; packageRoot?: string; objectRoot?: string; blobRoot?: string; uploaderId?: string; limit?: number };
const SOURCE_ID = 'legacy-stage2-202609';
const ROOT_FOLDER = '历史材料（暂未开放）';
const departmentMap: Record<string, { currentId?: string; label: string }> = {
  organization: { currentId: 'dept-org', label: '组织建设部' },
  theory: { currentId: 'dept-theory', label: '理论学习部' },
  practice: { currentId: 'dept-practice', label: '社会实践部' },
  shared: { label: '团总支公共材料' },
  unknown: { label: '待归类（管理员核验）' },
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.packageRoot || !options.objectRoot || !options.blobRoot || !options.uploaderId) throw new Error('Usage: tsx scripts/import-legacy-materials.ts --package-root <stage2_import> --object-root <objects> --blob-root <blobs-under-home> --uploader-id <profile-id> [--limit <n>] [--apply]');
  const blobRoot = requiredBlobRoot(options.blobRoot);
  const [documents, blobs, contexts, sources, tags, documentTags, workItems] = await Promise.all([
    readCsv(path.join(options.packageRoot, 'documents.csv')), readCsv(path.join(options.packageRoot, 'file_blobs.csv')),
    readCsv(path.join(options.packageRoot, 'document_contexts.csv')), readCsv(path.join(options.packageRoot, 'document_sources.csv')),
    readCsv(path.join(options.packageRoot, 'tags.csv')), readCsv(path.join(options.packageRoot, 'document_tags.csv')), readCsv(path.join(options.packageRoot, 'work_items.csv')),
  ]);
  const plan = buildPlan(documents, indexBy(blobs, 'id'), groupBy(contexts, 'documentId'), groupBy(sources, 'documentId'), indexBy(tags, 'id'), groupBy(documentTags, 'documentId'), indexBy(workItems, 'id'), options.objectRoot);
  const limited = options.limit === undefined ? plan : plan.slice(0, options.limit);
  console.log(`PLAN documents=${limited.length}/${plan.length} mode=${options.apply ? 'APPLY' : 'DRY-RUN'} visibility=SPECIFIED status=ARCHIVED`);
  console.log(`PLAN source=${SOURCE_ID} destination=${blobRoot}`);
  if (!options.apply) {
    for (const item of limited.slice(0, 12)) console.log(`DRY-RUN ${item.documentId} ${item.folderPath.join(' / ')} ${JSON.stringify(item.originalName)}`);
    console.log('DRY-RUN complete: no files or database records were changed.');
    return;
  }

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const uploader = await db.profile.findUnique({ where: { id: options.uploaderId }, select: { id: true } });
    if (!uploader) throw new Error('Uploader profile was not found.');
    let completed = 0; let skipped = 0;
    for (const item of limited) {
      const prior = await db.importRecord.findUnique({ where: { source_relativePath: { source: SOURCE_ID, relativePath: item.documentId } } });
      if (prior?.status === ImportStatus.COMPLETED) {
        const existingBlob = path.join(blobRoot, prior.storageKey);
        if (!await exists(existingBlob) || await sha256(existingBlob) !== prior.hash) throw new Error(`COMPLETED_IMPORT_BLOB_MISSING_OR_CORRUPT ${item.documentId}`);
        skipped++;
        continue;
      }
      const record = prior ?? await db.importRecord.create({ data: { source: SOURCE_ID, relativePath: item.documentId, storageKey: storageKey(item.extension), hash: item.hash } });
      const destination = path.join(blobRoot, record.storageKey);
      await ensureBlob(item, destination, record.hash);
      const folderId = await ensureFolderTree(db, item.folderPath, item.departmentId);
      const file = await db.fileRecord.findUnique({ where: { storageKey: record.storageKey } }) ?? await db.$transaction(async (tx) => {
        // Department placement is preserved by the Folder tree.  Keeping the
        // file-level department empty prevents pre-deployment code from
        // granting department members access before archival review opens it.
        const created = await tx.fileRecord.create({ data: { originalFilename: item.originalName, storageKey: record.storageKey, mimeType: item.mimeType, size: BigInt(item.size), hash: item.hash, uploaderId: uploader.id, departmentId: null, folderId, tags: item.tags, visibility: Visibility.SPECIFIED, status: FileStatus.ARCHIVED } });
        await tx.fileVersion.create({ data: { fileId: created.id, versionNumber: 1, storageKey: record.storageKey, size: BigInt(item.size), uploaderId: uploader.id, changeNote: `Legacy archive import ${SOURCE_ID}:${item.documentId}` } });
        return created;
      });
      await db.importRecord.update({ where: { id: record.id }, data: { fileId: file.id, status: ImportStatus.COMPLETED, completedAt: new Date() } });
      completed++;
      if (completed % 25 === 0 || completed === limited.length) console.log(`PROGRESS completed=${completed} skipped=${skipped} total=${limited.length}`);
    }
    console.log(`IMPORT_COMPLETE completed=${completed} skipped=${skipped} total=${limited.length}`);
  } finally { await db.$disconnect(); }
}

type Item = { documentId: string; originalName: string; source: string; hash: string; size: number; extension: string; mimeType: string; folderPath: string[]; departmentId?: string; tags: string[] };
function buildPlan(documents: Row[], blobs: Map<string, Row>, contexts: Map<string, Row[]>, sources: Map<string, Row[]>, tags: Map<string, Row>, documentTags: Map<string, Row[]>, workItems: Map<string, Row>, objectRoot: string): Item[] {
  const plan: Item[] = [];
  for (const document of documents) {
    const blob = blobs.get(document.blobId); const context = primaryContext(contexts.get(document.id) ?? []); const source = (sources.get(document.id) ?? []).find((row) => row.sha256 === blob?.sha256);
    if (!blob || !source) throw new Error(`Missing blob/source mapping for ${document.id}`);
    const resolved = resolveLegacyObject(objectRoot, blob.storageKey); if (!resolved) throw new Error(`Invalid legacy storageKey for ${document.id}`);
    const department = context?.departmentId ? departmentMap[context.departmentId] : undefined;
    if (context?.departmentId && !department) throw new Error(`Unmapped department ${context.departmentId} for ${document.id}`);
    const workItem = context?.workItemId ? workItems.get(context.workItemId) : undefined;
    const extension = path.extname(source.originalName).slice(1).toLowerCase() || blob.extension.toLowerCase();
    plan.push({ documentId: document.id, originalName: source.originalName, source: resolved, hash: blob.sha256, size: Number(blob.sizeBytes), extension, mimeType: mimeType(extension), departmentId: department?.currentId, folderPath: [ROOT_FOLDER, document.isTemplate === 'True' ? '模板' : '参考资料', department?.label ?? '团总支公共材料', ...(workItem ? [workItem.name] : [])], tags: (documentTags.get(document.id) ?? []).map((row) => tags.get(row.tagId)?.name).filter((name): name is string => Boolean(name)) });
  }
  return plan.sort((a, b) => a.documentId.localeCompare(b.documentId));
}

async function ensureBlob(item: Item, destination: string, expectedHash: string) {
  if (await exists(destination)) { if (await sha256(destination) !== expectedHash) throw new Error(`IMPORT_CONFLICT ${item.documentId}`); return; }
  const sourceInfo = await stat(item.source); if (!sourceInfo.isFile() || sourceInfo.size !== item.size) throw new Error(`SOURCE_MISMATCH ${item.documentId}`);
  const sourceHash = await sha256(item.source); if (sourceHash !== expectedHash) throw new Error(`SOURCE_HASH_MISMATCH ${item.documentId}`);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o750 });
  const temporary = `${destination}.${randomUUID()}.partial`;
  try { await copyFile(item.source, temporary); const copied = await stat(temporary); if (copied.size !== item.size || await sha256(temporary) !== expectedHash) throw new Error(`COPY_VERIFY_FAILED ${item.documentId}`); await rename(temporary, destination); }
  finally { await unlink(temporary).catch(() => undefined); }
}
async function ensureFolderTree(db: PrismaClient, names: string[], departmentId?: string) { let parentId: string | null = null; for (let index = 0; index < names.length; index++) { const name = names[index]; const scopedDepartmentId = index < 2 ? null : departmentId ?? null; let folder: Folder | null = await db.folder.findFirst({ where: { parentId, departmentId: scopedDepartmentId, name } }); if (!folder) { try { folder = await db.folder.create({ data: { name, parentId, departmentId: scopedDepartmentId } }); } catch { folder = await db.folder.findFirst({ where: { parentId, departmentId: scopedDepartmentId, name } }); if (!folder) throw new Error(`Cannot create folder ${name}`); } } parentId = folder.id; } return parentId ?? undefined; }
function storageKey(extension: string) { const id = randomUUID(); return `${id.slice(0, 2)}/${id.slice(2, 4)}/${id}.${extension.replace(/[^a-z0-9]/gi, '').slice(0, 16) || 'bin'}`; }
function requiredBlobRoot(value: string) { const root = path.resolve(value); if (!root.startsWith('/home/wyz/')) throw new Error('--blob-root must be under /home/wyz.'); return root; }
function resolveLegacyObject(root: string, storageKey: string) { const match = /^objects\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{64})\.([a-z0-9]{1,16})$/i.exec(storageKey); if (!match) return undefined; const resolvedRoot = path.resolve(root); const file = path.resolve(resolvedRoot, match[1], match[2], `${match[3]}.${match[4]}`); return file.startsWith(`${resolvedRoot}${path.sep}`) ? file : undefined; }
async function readCsv(file: string): Promise<Row[]> { const rows = parseCsv(await readFile(file, 'utf8')); const [header = [], ...body] = rows; return body.filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(header.map((key, index) => [key.replace(/^\uFEFF/, ''), row[index] ?? '']))); }
function parseCsv(input: string) { const rows: string[][] = []; let row: string[] = []; let value = ''; let quoted = false; for (let index = 0; index < input.length; index++) { const char = input[index]; if (quoted) { if (char === '"' && input[index + 1] === '"') { value += '"'; index++; } else if (char === '"') quoted = false; else value += char; } else if (char === '"') quoted = true; else if (char === ',') { row.push(value); value = ''; } else if (char === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; } else value += char; } if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); } return rows; }
function indexBy(rows: Row[], key: string) { return new Map(rows.map((row) => [row[key], row])); }
function groupBy(rows: Row[], key: string) { const result = new Map<string, Row[]>(); for (const row of rows) result.set(row[key], [...(result.get(row[key]) ?? []), row]); return result; }
function primaryContext(rows: Row[]) { return rows.find((row) => row.isPrimary === 'True') ?? rows[0]; }
async function exists(file: string) { return access(file).then(() => true).catch(() => false); }
async function sha256(file: string) { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }
function mimeType(extension: string) { return ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', zip: 'application/zip', txt: 'text/plain', csv: 'text/csv' } as Record<string, string>)[extension] ?? 'application/octet-stream'; }
function parseArgs(args: string[]): Options { const options: Options = { apply: false }; for (let index = 0; index < args.length; index++) { const key = args[index]; if (key === '--apply') options.apply = true; else if (key === '--package-root') options.packageRoot = args[++index]; else if (key === '--object-root') options.objectRoot = args[++index]; else if (key === '--blob-root') options.blobRoot = args[++index]; else if (key === '--uploader-id') options.uploaderId = args[++index]; else if (key === '--limit') { const value = Number.parseInt(args[++index] ?? '', 10); if (!Number.isInteger(value) || value < 1) throw new Error('--limit must be a positive integer'); options.limit = value; } else throw new Error(`Unknown argument: ${key}`); } return options; }
void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Legacy import failed.'); process.exitCode = 1; });
