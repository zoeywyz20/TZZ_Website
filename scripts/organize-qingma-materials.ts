import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

loadEnv({ path: '.env.local', override: false, quiet: true });

const SOURCE_ID = 'legacy-stage2-202609';
const TARGET_DEPARTMENT = '理论学习部';
const ROOT_FOLDER = '青马工程材料汇总';
const ADVISORY_LOCK_KEY = 7_772_026_091_801;
const DEFAULT_PACKAGE_ROOT = '/home/wyz/tzz/00_网站数据/stage2_import';
const DEFAULT_BLOB_ROOT = '/home/wyz/tzz-data/blobs';
const DEFAULT_REPORT_ROOT = '/home/wyz/tzz-data/operations/qingma-materials';

type Options = {
  apply: boolean;
  packageRoot: string;
  blobRoot: string;
  reportRoot: string;
  actorId: string;
  confirmCount?: number;
};
type CsvRow = Record<string, string>;
type Candidate = { documentId: string; originalName: string; sourcePath: string; category: string; subcategory?: string };
type DatabaseFile = {
  id: string;
  document_id: string;
  original_filename: string;
  storage_key: string;
  size: string;
  hash: string | null;
  visibility: string;
  status: string;
  department_id: string | null;
  folder_id: string | null;
  deleted_at: Date | null;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  requireSafeRoot(options.blobRoot, '--blob-root');
  requireSafeRoot(options.reportRoot, '--report-root');

  const candidates = await buildCandidatePlan(options.packageRoot);
  if (candidates.length === 0) throw new Error('No Qingma candidates were found in the import package.');
  const planByDocumentId = new Map(candidates.map((candidate) => [candidate.documentId, candidate]));
  const db = new Client({ connectionString });
  await db.connect();
  try {
    const departmentRows = await db.query<{ id: string; name: string }>(
      'SELECT id, name FROM departments WHERE name = $1',
      [TARGET_DEPARTMENT],
    );
    if (departmentRows.rowCount !== 1) throw new Error(`Expected exactly one ${TARGET_DEPARTMENT} department, found ${departmentRows.rowCount ?? 0}.`);
    const department = departmentRows.rows[0];
    const actorRows = await db.query<{ id: string; role: string; account_enabled: boolean }>(
      'SELECT id, role::text, account_enabled FROM profiles WHERE id = $1',
      [options.actorId],
    );
    if (actorRows.rowCount !== 1 || !actorRows.rows[0].account_enabled || !['SUPER_ADMIN', 'SECRETARY'].includes(actorRows.rows[0].role)) {
      throw new Error('The actor must be an enabled SUPER_ADMIN or SECRETARY profile.');
    }
    const recipients = await db.query<{ name: string; role: string }>(
      `SELECT name, role::text
         FROM profiles
        WHERE account_enabled = true
          AND ((department_id = $1 AND role IN ('DEPUTY_SECRETARY', 'MINISTER', 'VICE_MINISTER')) OR role = 'SECRETARY')
        ORDER BY role::text, name`,
      [department.id],
    );
    const files = await loadDatabaseFiles(db, candidates.map((candidate) => candidate.documentId), options.apply);
    const missing = candidates.filter((candidate) => !files.some((file) => file.document_id === candidate.documentId));
    const unexpected = files.filter((file) => !planByDocumentId.has(file.document_id));
    const deleted = files.filter((file) => file.deleted_at !== null);
    const unexpectedLifecycle = files.filter((file) => file.status !== 'ARCHIVED' || file.visibility !== 'SPECIFIED');
    if (missing.length || unexpected.length || deleted.length || unexpectedLifecycle.length) {
      throw new Error(`Candidate integrity check failed: missing=${missing.length} unexpected=${unexpected.length} deleted=${deleted.length} lifecycle=${unexpectedLifecycle.length}.`);
    }
    const blobProblems = await verifyBlobs(files, options.blobRoot);
    if (blobProblems.length) throw new Error(`Blob verification failed for ${blobProblems.length} file(s): ${blobProblems.slice(0, 5).join(', ')}`);
    const grouped = summarize(candidates);

    console.log(`PLAN mode=${options.apply ? 'APPLY' : 'DRY-RUN'} candidates=${candidates.length} department=${department.name} root=${ROOT_FOLDER}`);
    console.log(`ACCESS enabled_recipients=${recipients.rowCount ?? 0} roles=SECRETARY,DEPUTY_SECRETARY,MINISTER,VICE_MINISTER ordinary_members=false`);
    for (const [category, count] of grouped) console.log(`CATEGORY ${category}=${count}`);

    if (!options.apply) {
      for (const candidate of candidates.slice(0, 12)) console.log(`SAMPLE ${candidate.documentId} ${candidate.category}${candidate.subcategory ? ` / ${candidate.subcategory}` : ''} ${JSON.stringify(candidate.originalName)}`);
      console.log('DRY_RUN_COMPLETE no database rows or blobs were changed.');
      return;
    }
    if (options.confirmCount !== candidates.length) {
      throw new Error(`Apply refused: pass --confirm-count ${candidates.length} after reviewing the dry-run.`);
    }
    if (!await hasAuditTargetColumns(db)) throw new Error('Apply refused: audit_logs target columns are not deployed. Run the additive production migrations first.');

    const snapshot = {
      operation: 'OPEN_QINGMA_MATERIALS_TO_THEORY_LEADERS',
      createdAt: new Date().toISOString(),
      source: SOURCE_ID,
      targetDepartment: department,
      targetRootFolder: ROOT_FOLDER,
      actorId: options.actorId,
      accessRoles: ['SECRETARY', 'DEPUTY_SECRETARY', 'MINISTER', 'VICE_MINISTER'],
      files: files.map((file) => ({
        id: file.id,
        documentId: file.document_id,
        originalFilename: file.original_filename,
        storageKey: file.storage_key,
        prior: { departmentId: file.department_id, folderId: file.folder_id, visibility: file.visibility },
        target: planByDocumentId.get(file.document_id),
      })),
    };
    const reportPath = await writeSnapshot(options.reportRoot, snapshot);

    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    try {
      await db.query('SELECT pg_advisory_xact_lock($1::bigint)', [ADVISORY_LOCK_KEY]);
      const lockedFiles = await loadDatabaseFiles(db, candidates.map((candidate) => candidate.documentId), true);
      if (stateDigest(files) !== stateDigest(lockedFiles)) throw new Error('Candidate state changed after the snapshot; retry from a new dry-run.');
      const rootId = await ensureFolder(db, ROOT_FOLDER, null, department.id);
      const folderCache = new Map<string, string>();
      for (const candidate of candidates) {
        const categoryKey = candidate.category;
        let categoryId = folderCache.get(categoryKey);
        if (!categoryId) {
          categoryId = await ensureFolder(db, candidate.category, rootId, department.id);
          folderCache.set(categoryKey, categoryId);
        }
        let destinationId = categoryId;
        if (candidate.subcategory) {
          const subcategoryKey = `${categoryKey}/${candidate.subcategory}`;
          destinationId = folderCache.get(subcategoryKey) ?? await ensureFolder(db, candidate.subcategory, categoryId, department.id);
          folderCache.set(subcategoryKey, destinationId);
        }
        const file = lockedFiles.find((item) => item.document_id === candidate.documentId)!;
        await db.query(
          `UPDATE files
              SET department_id = $1, folder_id = $2, visibility = 'DEPARTMENT', updated_at = CURRENT_TIMESTAMP
            WHERE id = $3`,
          [department.id, destinationId, file.id],
        );
        await db.query(
          `INSERT INTO audit_logs (id, action, actor_id, target_type, target_id, metadata, created_at)
           VALUES ($1, 'QINGMA_MATERIAL_OPENED', $2, 'FileRecord', $3, $4::jsonb, CURRENT_TIMESTAMP)`,
          [randomUUID(), options.actorId, file.id, JSON.stringify({
            documentId: candidate.documentId,
            category: candidate.category,
            subcategory: candidate.subcategory ?? null,
            priorDepartmentId: file.department_id,
            priorFolderId: file.folder_id,
            priorVisibility: file.visibility,
            targetDepartmentId: department.id,
            targetFolderId: destinationId,
            targetVisibility: 'DEPARTMENT',
            snapshot: reportPath,
          })],
        );
      }
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

    const verified = await loadDatabaseFiles(db, candidates.map((candidate) => candidate.documentId), false);
    const invalid = verified.filter((file) => file.department_id !== department.id || file.visibility !== 'DEPARTMENT');
    if (invalid.length) throw new Error(`Post-apply verification failed for ${invalid.length} file(s). Snapshot: ${reportPath}`);
    console.log(`APPLY_COMPLETE files=${verified.length} folders=${new Set(candidates.map((candidate) => `${candidate.category}/${candidate.subcategory ?? ''}`)).size + 1} snapshot=${reportPath}`);
  } finally {
    await db.end();
  }
}

async function buildCandidatePlan(packageRoot: string): Promise<Candidate[]> {
  const [documents, blobs, sources] = await Promise.all([
    readCsv(path.join(packageRoot, 'documents.csv')),
    readCsv(path.join(packageRoot, 'file_blobs.csv')),
    readCsv(path.join(packageRoot, 'document_sources.csv')),
  ]);
  const blobById = new Map(blobs.map((row) => [row.id, row]));
  const sourcesByDocument = groupBy(sources, 'documentId');
  const planned: Candidate[] = [];
  for (const document of documents) {
    const blob = blobById.get(document.blobId);
    const matchingSources = (sourcesByDocument.get(document.id) ?? []).filter((row) => row.sha256 === blob?.sha256);
    if (matchingSources.length === 0) throw new Error(`Missing primary source for ${document.id}.`);
    // One deduplicated document can have several historical source paths.  If
    // any occurrence belonged to a Qingma tree, the single imported record is
    // part of the collection even when its first source path was unrelated.
    const source = matchingSources.find((row) => /\u9752\u9a6c|\u9752\u5e74\u9a6c\u514b\u601d/i.test(`${row.originalName}\n${row.originalRelativePath}`)) ?? matchingSources[0];
    const searchable = `${document.title}\n${matchingSources.map((row) => `${row.originalName}\n${row.originalRelativePath}`).join('\n')}`;
    if (!/\u9752\u9a6c|\u9752\u5e74\u9a6c\u514b\u601d/i.test(searchable)) continue;
    const classification = classify(source.originalRelativePath, source.originalName, document.title);
    planned.push({ documentId: document.id, originalName: source.originalName, sourcePath: source.originalRelativePath, ...classification });
  }
  return planned.sort((a, b) => a.documentId.localeCompare(b.documentId));
}

function classify(sourcePath: string, originalName: string, title: string): { category: string; subcategory?: string } {
  const text = `${sourcePath}\n${originalName}\n${title}`;
  if (/\u9752\u9a6c\u5f00\u73ed\u4eea\u5f0f/.test(text)) return { category: '活动影像', subcategory: '开班仪式' };
  if (/\u9752\u9a6c\u5b9e\u8df5\u6d3b\u52a8/.test(text)) return { category: '活动影像', subcategory: '实践活动' };
  if (/\u9898\u5e93|\u8003\u8bd5|\u7b14\u8bd5/.test(text)) return { category: '培训与考核', subcategory: '考试题库' };
  if (/\u624b\u518c|\u5236\u5ea6|\u5b66\u4e60\u8d44\u6599/.test(text)) return { category: '培训与考核', subcategory: '手册与学习资料' };
  if (/\u7b56\u5212|\u65b9\u6848|\u901a\u77e5/.test(text)) return { category: '策划与通知' };
  if (/\u5206\u7ec4|\u540d\u5355|\u8d21\u732e/.test(text)) return { category: '学员管理', subcategory: '分组与名单' };
  if (/\u62a5\u540d|\u5b66\u5458\u4fe1\u606f|\u4fe1\u606f\u8868|\u767b\u8bb0\u8868|\u6536\u96c6\u4fe1\u606f/.test(text) || /\u9752\u9a6c\u5de5\u7a0b\u5b66\u5458/.test(sourcePath)) {
    if (/\u7814\u7a76\u751f\u4e00\u5e74\u7ea7/.test(sourcePath)) return { category: '学员报名与信息', subcategory: '研究生一年级' };
    if (/\u672c\u79d1\u751f\u4e00\u5e74\u7ea7/.test(sourcePath)) return { category: '学员报名与信息', subcategory: '本\u79d1生一年级' };
    if (/\u672c\u79d1\u751f\u4e8c\u5e74\u7ea7\u3001\u4e09\u5e74\u7ea7/.test(sourcePath)) return { category: '学员报名与信息', subcategory: '本科生二、三年级' };
    if (/\u6c47\u603b|\u6536\u96c6\u4fe1\u606f/.test(text)) return { category: '学员报名与信息', subcategory: '汇总表' };
    return { category: '学员报名与信息', subcategory: '其他报名材料' };
  }
  if (/\u6821\u9752\u9a6c|\u652f\u6491\u6750\u6599|\u4e94\u56db\u8868\u5f70/.test(text)) return { category: '支撑与成果材料' };
  return { category: '其他相关材料' };
}

async function loadDatabaseFiles(db: Client, documentIds: string[], lock: boolean): Promise<DatabaseFile[]> {
  const result = await db.query<DatabaseFile>(
    `SELECT f.id, ir.relative_path AS document_id, f.original_filename, f.storage_key,
            f.size::text, f.hash, f.visibility::text, f.status::text,
            f.department_id, f.folder_id, f.deleted_at
       FROM import_records ir
       JOIN files f ON f.id = ir.file_id
      WHERE ir.source = $1 AND ir.status::text = 'COMPLETED' AND ir.relative_path = ANY($2::text[])
      ORDER BY ir.relative_path${lock ? ' FOR UPDATE OF f' : ''}`,
    [SOURCE_ID, documentIds],
  );
  return result.rows;
}

async function verifyBlobs(files: DatabaseFile[], blobRoot: string) {
  const problems: string[] = [];
  for (const file of files) {
    const resolved = path.resolve(blobRoot, file.storage_key);
    if (!resolved.startsWith(`${path.resolve(blobRoot)}${path.sep}`)) { problems.push(file.document_id); continue; }
    try {
      const info = await stat(resolved);
      if (!info.isFile() || info.size !== Number(file.size)) { problems.push(file.document_id); continue; }
      if (file.hash && await sha256(resolved) !== file.hash) problems.push(file.document_id);
    } catch { problems.push(file.document_id); }
  }
  return problems;
}

async function ensureFolder(db: Client, name: string, parentId: string | null, departmentId: string) {
  const existing = await db.query<{ id: string }>(
    'SELECT id FROM folders WHERE name = $1 AND parent_id IS NOT DISTINCT FROM $2 AND department_id = $3 ORDER BY created_at LIMIT 2',
    [name, parentId, departmentId],
  );
  if ((existing.rowCount ?? 0) > 1) throw new Error(`Duplicate destination folder detected: ${name}`);
  if (existing.rows[0]) return existing.rows[0].id;
  const id = randomUUID();
  await db.query(
    'INSERT INTO folders (id, name, parent_id, department_id, created_at, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    [id, name, parentId, departmentId],
  );
  return id;
}

async function hasAuditTargetColumns(db: Client) {
  const result = await db.query<{ present: boolean }>(
    `SELECT COUNT(*) = 3 AS present
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'audit_logs'
        AND column_name IN ('target_type', 'target_id', 'metadata')`,
  );
  return result.rows[0]?.present === true;
}

async function writeSnapshot(reportRoot: string, payload: unknown) {
  await mkdir(reportRoot, { recursive: true, mode: 0o750 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(reportRoot, `${stamp}-before.json`);
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  return file;
}

function summarize(candidates: Candidate[]) {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = `${candidate.category}${candidate.subcategory ? ` / ${candidate.subcategory}` : ''}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b, 'zh-CN'));
}

function stateDigest(files: DatabaseFile[]) {
  const normalized = files.map((file) => [file.id, file.document_id, file.department_id, file.folder_id, file.visibility, file.deleted_at?.toISOString() ?? null]);
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

async function readCsv(file: string): Promise<CsvRow[]> {
  await access(file);
  const rows = parseCsv(await readFile(file, 'utf8'));
  const [header = [], ...body] = rows;
  return body.filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(header.map((key, index) => [key.replace(/^\uFEFF/, ''), row[index] ?? ''])));
}

function parseCsv(input: string) {
  const rows: string[][] = []; let row: string[] = []; let value = ''; let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { value += '"'; index++; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += char;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

function groupBy(rows: CsvRow[], key: string) {
  const grouped = new Map<string, CsvRow[]>();
  for (const row of rows) grouped.set(row[key], [...(grouped.get(row[key]) ?? []), row]);
  return grouped;
}

function requireSafeRoot(value: string, option: string) {
  const resolved = path.resolve(value);
  if (!resolved.startsWith('/home/wyz/')) throw new Error(`${option} must be under /home/wyz/.`);
}

function sha256(file: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function parseArgs(args: string[]): Options {
  const options: Options = { apply: false, packageRoot: DEFAULT_PACKAGE_ROOT, blobRoot: DEFAULT_BLOB_ROOT, reportRoot: DEFAULT_REPORT_ROOT, actorId: 'user-wyz' };
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--apply') options.apply = true;
    else if (key === '--package-root') options.packageRoot = args[++index] ?? '';
    else if (key === '--blob-root') options.blobRoot = args[++index] ?? '';
    else if (key === '--report-root') options.reportRoot = args[++index] ?? '';
    else if (key === '--actor-id') options.actorId = args[++index] ?? '';
    else if (key === '--confirm-count') {
      const value = Number.parseInt(args[++index] ?? '', 10);
      if (!Number.isInteger(value) || value < 1) throw new Error('--confirm-count must be a positive integer.');
      options.confirmCount = value;
    } else throw new Error(`Unknown argument: ${key}`);
  }
  return options;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Qingma material organization failed.');
  process.exitCode = 1;
});
