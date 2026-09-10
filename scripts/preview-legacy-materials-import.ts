import { stat } from 'node:fs/promises';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

type Row = Record<string, string>;
type Mode = 'templates' | 'references' | 'templates-and-references';

type Options = {
  packageRoot?: string;
  objectRoot?: string;
  mode?: Mode;
  dryRun: boolean;
  sampleSize: number;
};

type PlanRow = {
  documentId: string;
  title: string;
  originalName: string;
  legacyStorageKey: string;
  folderPath: string[];
  departmentId?: string;
  visibility: 'ALL' | 'DEPARTMENT';
  tags: string[];
};

const departmentMap: Record<string, { currentId?: string; label: string }> = {
  organization: { currentId: 'dept-org', label: '组织建设部' },
  theory: { currentId: 'dept-theory', label: '理论学习部' },
  practice: { currentId: 'dept-practice', label: '社会实践部' },
  shared: { label: '团总支公共材料' },
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.dryRun || !options.packageRoot || !options.objectRoot || !options.mode) {
    throw new Error('Usage: tsx scripts/preview-legacy-materials-import.ts --dry-run --package-root <stage2_import> --object-root <objects> --mode templates|references|templates-and-references [--sample-size <n>]');
  }

  const [documents, blobs, contexts, sources, tags, documentTags, workItems] = await Promise.all([
    readCsv(path.join(options.packageRoot, 'documents.csv')),
    readCsv(path.join(options.packageRoot, 'file_blobs.csv')),
    readCsv(path.join(options.packageRoot, 'document_contexts.csv')),
    readCsv(path.join(options.packageRoot, 'document_sources.csv')),
    readCsv(path.join(options.packageRoot, 'tags.csv')),
    readCsv(path.join(options.packageRoot, 'document_tags.csv')),
    readCsv(path.join(options.packageRoot, 'work_items.csv')),
  ]);

  const blobById = indexBy(blobs, 'id');
  const sourceByDocument = groupBy(sources, 'documentId');
  const contextsByDocument = groupBy(contexts, 'documentId');
  const tagById = indexBy(tags, 'id');
  const tagsByDocument = groupBy(documentTags, 'documentId');
  const workItemById = indexBy(workItems, 'id');
  const planned: PlanRow[] = [];
  const excluded = new Map<string, number>();

  for (const document of documents) {
    const reason = exclusionReason(document, options.mode);
    if (reason) {
      increment(excluded, reason);
      continue;
    }

    const blob = blobById.get(document.blobId);
    const context = primaryContext(contextsByDocument.get(document.id) ?? []);
    const source = (sourceByDocument.get(document.id) ?? []).find((item) => item.sha256 === blob?.sha256);
    const department = context?.departmentId ? departmentMap[context.departmentId] : undefined;
    const visibility = document.accessScope === 'all-members' ? 'ALL' : 'DEPARTMENT';

    if (!blob || !source) {
      increment(excluded, '缺少 Blob 或原始文件名映射');
      continue;
    }
    if (visibility === 'DEPARTMENT' && !department?.currentId) {
      increment(excluded, '部门无法映射到当前组织');
      continue;
    }

    const object = resolveLegacyObject(options.objectRoot, blob.storageKey);
    if (!object) {
      increment(excluded, '旧对象 storageKey 格式无效');
      continue;
    }
    if (!await existsWithExpectedSize(object, Number(blob.sizeBytes))) {
      increment(excluded, '旧对象不存在或大小不匹配');
      continue;
    }

    const workItem = context?.workItemId ? workItemById.get(context.workItemId) : undefined;
    const root = document.isTemplate === 'True' ? '模板' : '参考资料';
    const area = department?.label ?? '团总支公共材料';
    const folderPath = [root, area, ...(workItem ? [workItem.name] : [])];
    const documentTagNames = (tagsByDocument.get(document.id) ?? [])
      .map((item) => tagById.get(item.tagId)?.name)
      .filter((value): value is string => Boolean(value));

    planned.push({
      documentId: document.id,
      title: document.title,
      originalName: source.originalName,
      legacyStorageKey: blob.storageKey,
      folderPath,
      departmentId: department?.currentId,
      visibility,
      tags: documentTagNames,
    });
  }

  const byRoot = countBy(planned, (item) => item.folderPath[0]);
  const byVisibility = countBy(planned, (item) => item.visibility);
  const byFolder = countBy(planned, (item) => item.folderPath.join(' / '));
  console.log(`DRY-RUN legacy package=${options.packageRoot}`);
  console.log(`DRY-RUN object root=${options.objectRoot}`);
  console.log(`DRY-RUN mode=${options.mode}`);
  console.log(`PLAN eligible=${planned.length} templates=${byRoot.get('模板') ?? 0} references=${byRoot.get('参考资料') ?? 0}`);
  console.log(`PLAN visibility ALL=${byVisibility.get('ALL') ?? 0} DEPARTMENT=${byVisibility.get('DEPARTMENT') ?? 0}`);
  console.log(`PLAN folders=${byFolder.size}`);
  for (const [reason, count] of [...excluded.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))) {
    console.log(`EXCLUDED ${reason}=${count}`);
  }
  for (const item of planned.slice(0, options.sampleSize)) {
    console.log(`SAMPLE document=${item.documentId} folder=${item.folderPath.join(' / ')} visibility=${item.visibility} name=${JSON.stringify(item.originalName)}`);
  }
  console.log('DRY-RUN complete: no files were copied and no database records were created.');
}

function exclusionReason(document: Row, mode: Mode): string | undefined {
  if (document.needsReview !== 'False') return '待人工审核';
  if (document.sensitivity === 'restricted' || document.accessScope === 'restricted') return '受限材料';
  if (document.accessScope === 'leadership') return '仅领导层材料';
  if (document.accessScope !== 'all-members' && document.accessScope !== 'department') return '不支持的访问范围';
  if (mode === 'templates' && document.isTemplate !== 'True') return '非模板材料';
  if (mode === 'references' && document.isTemplate === 'True') return '模板材料不属于参考资料批次';
  return undefined;
}

function primaryContext(contexts: Row[]): Row | undefined {
  return contexts.find((item) => item.isPrimary === 'True') ?? contexts[0];
}

async function readCsv(file: string): Promise<Row[]> {
  const rows = parseCsv(await readFile(file, 'utf8'));
  const [header = [], ...body] = rows;
  return body.filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(header.map((key, index) => [key.replace(/^\uFEFF/, ''), row[index] ?? ''])));
}

function parseCsv(input: string): string[][] {
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

function indexBy(rows: Row[], key: string) { return new Map(rows.map((row) => [row[key], row])); }
function groupBy(rows: Row[], key: string) { const result = new Map<string, Row[]>(); for (const row of rows) result.set(row[key], [...(result.get(row[key]) ?? []), row]); return result; }
function countBy<T>(items: T[], key: (item: T) => string) { const result = new Map<string, number>(); for (const item of items) increment(result, key(item)); return result; }
function increment(map: Map<string, number>, key: string) { map.set(key, (map.get(key) ?? 0) + 1); }
async function existsWithExpectedSize(file: string, size: number) {
  try {
    const fileStat = await stat(file);
    return fileStat.isFile() && fileStat.size === size;
  } catch {
    return false;
  }
}

function resolveLegacyObject(objectRoot: string, storageKey: string): string | undefined {
  const match = /^objects\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{64})\.([a-z0-9]{1,16})$/i.exec(storageKey);
  if (!match) return undefined;
  const object = path.resolve(objectRoot, match[1], match[2], `${match[3]}.${match[4]}`);
  const root = path.resolve(objectRoot);
  return object.startsWith(`${root}${path.sep}`) ? object : undefined;
}

function parseArgs(args: string[]): Options {
  const options: Options = { dryRun: false, sampleSize: 12 };
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--dry-run') options.dryRun = true;
    else if (key === '--package-root') options.packageRoot = args[++index];
    else if (key === '--object-root') options.objectRoot = args[++index];
    else if (key === '--mode') {
      const mode = args[++index];
      if (mode !== 'templates' && mode !== 'references' && mode !== 'templates-and-references') throw new Error('--mode must be templates, references, or templates-and-references');
      options.mode = mode;
    } else if (key === '--sample-size') {
      const sampleSize = Number.parseInt(args[++index] ?? '', 10);
      if (!Number.isInteger(sampleSize) || sampleSize < 0 || sampleSize > 100) throw new Error('--sample-size must be between 0 and 100');
      options.sampleSize = sampleSize;
    } else throw new Error(`Unknown argument: ${key}`);
  }
  return options;
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Legacy preview failed.'); process.exitCode = 1; });
