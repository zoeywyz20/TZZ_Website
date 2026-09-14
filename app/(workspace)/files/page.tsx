'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Archive, Download, FileSpreadsheet, FileText, Folder, FolderPlus, Grid3X3, History, Image, List, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MAX_FILE_SIZE_BYTES, isAllowedUploadSize } from '@/lib/storage';
import { cn, formatFileSize, formatRelativeTime } from '@/lib/utils';
import { FileStatus, FileStatusLabel } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Department = { id: string; name: string; shortName: string };
type ApiFile = {
  id: string; originalFilename: string; mimeType: string; size: string; status: FileStatus; currentVersion: number;
  updatedAt: string; uploader: { name: string }; department?: Department; folder?: { id: string; name: string; parentId: string | null }; canDelete: boolean;
};
type ApiResponse<T> = { success: boolean; data?: T; error?: { message: string } };
type ApiFolder = { id: string; name: string; parentId: string | null; department?: Department; childrenCount: number; fileCount: number; canManage: boolean };

const blockedExtensions = new Set(['apk', 'app', 'bat', 'cmd', 'com', 'cpl', 'dll', 'exe', 'gadget', 'hta', 'inf', 'ins', 'iso', 'jar', 'js', 'jse', 'lib', 'lnk', 'mde', 'msc', 'msi', 'msp', 'mst', 'pif', 'ps1', 'reg', 'scr', 'sct', 'sh', 'sys', 'vb', 'vbe', 'vbs', 'ws', 'wsc', 'wsf', 'wsh']);

function getFileTypeIcon(mimeType: string) {
  if (mimeType.includes('word') || mimeType.includes('document')) return FileText;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
  if (mimeType.includes('zip') || mimeType.includes('archive')) return Archive;
  if (mimeType.includes('image')) return Image;
  return FileText;
}

function getFileTypeColor(mimeType: string) {
  if (mimeType.includes('word') || mimeType.includes('document')) return 'bg-blue-50 text-blue-600';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'bg-green-50 text-green-600';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'bg-amber-50 text-amber-600';
  if (mimeType.includes('image')) return 'bg-purple-50 text-purple-600';
  return 'bg-muted text-muted-foreground';
}

export default function FilesPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 30, total: 0, hasMore: false });
  const [files, setFiles] = useState<ApiFile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [folders, setFolders] = useState<ApiFolder[]>([]);
  const [uploadDepartment, setUploadDepartment] = useState('');
  const [uploadVisibility, setUploadVisibility] = useState('DEPARTMENT');
  const [selectedUpload, setSelectedUpload] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const versionInput = useRef<HTMLInputElement>(null);
  const [versionTarget, setVersionTarget] = useState<ApiFile | null>(null);
  const [historyTarget, setHistoryTarget] = useState<ApiFile | null>(null);
  const [versions, setVersions] = useState<Array<{ id: string; versionNumber: number; uploader: { name: string }; changeNote?: string; createdAt: string; isCurrent: boolean }>>([]);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '30' });
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (!searchQuery.trim()) params.set('folderId', currentFolder ?? 'root');
    if (statusFilter) params.set('status', statusFilter);
    try {
      const response = await fetch(`/api/files?${params}`, { cache: 'no-store' });
      const payload = await response.json() as ApiResponse<{ items: ApiFile[]; pagination: typeof pagination }>;
      if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? '读取材料失败。');
      setFiles(payload.data?.items ?? []);
      if (payload.data?.pagination) setPagination(payload.data.pagination);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取材料失败。');
    } finally {
      setLoading(false);
    }
  }, [currentFolder, page, searchQuery, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadFiles(); }, 150);
    return () => window.clearTimeout(timer);
  }, [loadFiles]);
  useEffect(() => {
    void fetch('/api/departments', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: ApiResponse<Department[]>) => { if (payload.success) setDepartments(payload.data ?? []); })
      .catch(() => undefined);
  }, []);
  useEffect(() => { void fetch('/api/folders', { cache: 'no-store' }).then((response) => response.json()).then((payload: ApiResponse<ApiFolder[]>) => { if (payload.success) setFolders(payload.data ?? []); }).catch(() => undefined); }, []);

  const upload = (file: File) => {
    const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : '';
    if (!isAllowedUploadSize(file.size)) { toast.error(`文件需小于 ${formatFileSize(MAX_FILE_SIZE_BYTES)}。`); return; }
    if (extension && blockedExtensions.has(extension)) { toast.error('不允许上传可执行文件。'); return; }
    setUploading(true); setProgress(0);
    const request = new XMLHttpRequest();
    request.open('POST', '/api/files/upload');
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    request.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    if (uploadDepartment) request.setRequestHeader('X-Department-Id', uploadDepartment);
    if (currentFolder) request.setRequestHeader('X-Folder-Id', currentFolder);
    request.setRequestHeader('X-File-Visibility', uploadVisibility);
    request.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
    request.onload = () => {
      setUploading(false);
      try {
        const payload = JSON.parse(request.responseText) as ApiResponse<{ id: string }>;
        if (request.status >= 200 && request.status < 300 && payload.success) { toast.success('材料已上传。'); void loadFiles(); }
        else toast.error(payload.error?.message ?? '文件上传失败。');
      } catch { toast.error('文件上传失败。'); }
    };
    request.onerror = () => { setUploading(false); toast.error('网络错误，文件未上传。'); };
    request.send(file);
  };

  const onSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (file) setSelectedUpload(file);
  };

  const createFolder = async () => { const name = window.prompt('新建文件夹名称'); if (!name) return; const response = await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parentId: currentFolder, departmentId: uploadDepartment || null }) }); const payload = await response.json() as ApiResponse<unknown>; if (!response.ok || !payload.success) toast.error(payload.error?.message ?? '创建目录失败。'); else { toast.success('文件夹已创建。'); window.location.reload(); } };
  const renameFolder = async (folder: ApiFolder) => { const name = window.prompt('重命名文件夹', folder.name); if (!name || name === folder.name) return; const response = await fetch(`/api/folders/${folder.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); const payload = await response.json() as ApiResponse<unknown>; if (!response.ok || !payload.success) toast.error(payload.error?.message ?? '重命名失败。'); else { toast.success('文件夹已重命名。'); window.location.reload(); } };
  const moveFolder = async (folder: ApiFolder) => { const target = window.prompt(`移动“${folder.name}”到哪个 folder UUID？留空表示根目录。`); if (target === null) return; const response = await fetch(`/api/folders/${folder.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parentId: target.trim() || null }) }); const payload = await response.json() as ApiResponse<unknown>; if (!response.ok || !payload.success) toast.error(payload.error?.message ?? '移动失败。'); else { toast.success('文件夹已移动。'); window.location.reload(); } };
  const folderTrail = useMemo(() => { const result: ApiFolder[] = []; let id = currentFolder; while (id) { const folder = folders.find((item) => item.id === id); if (!folder) break; result.unshift(folder); id = folder.parentId; } return result; }, [currentFolder, folders]);

  const remove = async (file: ApiFile) => {
    if (!window.confirm(`确定删除“${file.originalFilename}”吗？`)) return;
    const response = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
    const payload = await response.json() as ApiResponse<unknown>;
    if (!response.ok || !payload.success) { toast.error(payload.error?.message ?? '删除失败。'); return; }
    toast.success('材料已删除。'); void loadFiles();
  };
  const uploadVersion = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file || !versionTarget) return; const req = new XMLHttpRequest(); req.open('POST', `/api/files/${versionTarget.id}/versions`); req.setRequestHeader('Content-Type', file.type || 'application/octet-stream'); req.setRequestHeader('X-File-Name', encodeURIComponent(file.name)); req.onload = () => { try { const p = JSON.parse(req.responseText) as ApiResponse<{ unchanged?: boolean }>; if (!req.status || !p.success) throw new Error(p.error?.message); toast.success(p.data?.unchanged ? '内容未变化，未创建新版本。' : '已创建新版本。'); void loadFiles(); } catch { toast.error('新版本上传失败。'); } finally { setVersionTarget(null); } }; req.onerror=()=>{toast.error('新版本上传失败。');setVersionTarget(null);}; req.send(file); };
  const showHistory = async (file: ApiFile) => { try { const r=await fetch(`/api/files/${file.id}/versions`); const p=await r.json() as ApiResponse<typeof versions>; if(!r.ok||!p.success) throw new Error(p.error?.message); setVersions(p.data??[]); setHistoryTarget(file); } catch(e){toast.error(e instanceof Error?e.message:'无法读取版本历史。');} };

  const content = useMemo(() => files.map((file) => {
    const Icon = getFileTypeIcon(file.mimeType); const iconColor = getFileTypeColor(file.mimeType);
    return { file, Icon, iconColor };
  }), [files]);

  return <div className="p-6 lg:p-10 max-w-[1200px] mx-auto">
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-tight mb-1">材料中心</h1><p className="text-sm text-muted-foreground">浏览和管理团总支材料文件</p></div>
        <div className="flex gap-2"><Link href="/files/trash" className="h-9 px-3 rounded-lg border border-border text-sm inline-flex items-center gap-2"><Trash2 className="w-4 h-4" />回收站</Link><Button variant="outline" onClick={createFolder}><FolderPlus />新建文件夹</Button><Button onClick={() => fileInput.current?.click()} disabled={uploading}><Upload />{uploading ? `上传中 ${progress}%` : '选择文件'}</Button></div>
        <input ref={fileInput} type="file" className="hidden" onChange={onSelectFile} /><input ref={versionInput} type="file" className="hidden" onChange={uploadVersion} />
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }} placeholder="跨目录搜索文件名称" className="h-9 w-full pl-9 pr-3 rounded-lg border border-border bg-white text-sm" /></div>
        <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-9 px-3 rounded-lg border border-border bg-white text-sm"><option value="">全部状态</option>{Object.entries(FileStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <div className="flex border border-border rounded-lg overflow-hidden"><button onClick={() => setViewMode('list')} className={cn('h-9 w-9 flex items-center justify-center', viewMode === 'list' && 'bg-muted')} aria-label="列表视图"><List className="w-4 h-4" /></button><button onClick={() => setViewMode('grid')} className={cn('h-9 w-9 flex items-center justify-center', viewMode === 'grid' && 'bg-muted')} aria-label="网格视图"><Grid3X3 className="w-4 h-4" /></button></div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm"><button className="text-primary" onClick={() => setCurrentFolder(null)}>材料中心</button>{folderTrail.map((folder) => <span key={folder.id}>/ <button className="text-primary" onClick={() => setCurrentFolder(folder.id)}>{folder.name}</button></span>)}</div>
      {!searchQuery && <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">{folders.filter((folder) => folder.parentId === currentFolder).map((folder) => <div key={folder.id} className="rounded-lg border bg-white p-3 text-sm"><button className="text-left hover:text-primary" onClick={() => { setCurrentFolder(folder.id); setPage(1); }}><Folder className="mb-1 size-4 text-amber-500" />{folder.name}<span className="ml-2 text-xs text-muted-foreground">{folder.fileCount}</span></button>{folder.canManage && <div className="mt-2 flex gap-2 text-xs"><button className="text-primary" onClick={() => renameFolder(folder)}>Rename</button><button className="text-primary" onClick={() => moveFolder(folder)}>Move</button></div>}</div>)}</div>}
      {selectedUpload && <div className="mb-4 rounded-xl border bg-white p-4 text-sm"><div className="mb-3 font-medium">上传材料：{selectedUpload.name}</div><div className="flex flex-wrap gap-2"><select value={uploadDepartment} onChange={(event) => setUploadDepartment(event.target.value)} className="h-9 rounded border px-2"><option value="">默认所属部门</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><select value={uploadVisibility} onChange={(event) => setUploadVisibility(event.target.value)} className="h-9 rounded border px-2"><option value="DEPARTMENT">部门可见</option><option value="ALL">公开可见</option></select><Button onClick={() => { upload(selectedUpload); setSelectedUpload(null); }}>确认上传</Button><Button variant="outline" onClick={() => setSelectedUpload(null)}>取消</Button></div></div>}
      {loading ? <div className="text-center py-20 text-sm text-muted-foreground">正在加载材料…</div> : content.length === 0 ? <div className="text-center py-20 text-sm text-muted-foreground">没有找到相关文件</div> : viewMode === 'list' ? <div className="bg-white rounded-xl border border-border/60 overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_80px_70px_90px_110px] gap-4 px-5 py-3 border-b text-xs text-muted-foreground font-medium"><span>文件</span><span>部门</span><span>大小</span><span>版本</span><span>更新时间</span><span>操作</span></div>
        {content.map(({ file, Icon, iconColor }) => <div key={file.id} className="grid grid-cols-[1fr_100px_80px_70px_90px_110px] gap-4 px-5 py-3.5 border-b last:border-0 items-center"><div className="flex items-center gap-3 min-w-0"><div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', iconColor)}><Icon className="w-4 h-4" /></div><div className="min-w-0"><span className="text-sm truncate block">{file.originalFilename}</span><span className="text-[11px] text-muted-foreground">{file.uploader.name}{searchQuery && file.folder ? ` · ${file.folder.name}` : ''}</span></div></div><span className="text-sm text-muted-foreground">{file.department?.shortName ?? '-'}</span><span className="text-sm text-muted-foreground">{formatFileSize(Number(file.size))}</span><span className="text-sm text-muted-foreground">V{file.currentVersion}</span><span className="text-xs text-muted-foreground">{formatRelativeTime(file.updatedAt)}</span><FileActions file={file} onDelete={remove} onVersion={()=>{setVersionTarget(file);versionInput.current?.click();}} onHistory={()=>void showHistory(file)} /></div>)}
      </div> : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{content.map(({ file, Icon, iconColor }) => <div key={file.id} className="bg-white rounded-xl border border-border/60 p-4"><div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', iconColor)}><Icon className="w-5 h-5" /></div><h3 className="text-sm font-medium truncate mb-1">{file.originalFilename}</h3><p className="text-[11px] text-muted-foreground">{file.uploader.name} · {formatFileSize(Number(file.size))}</p><div className="mt-3 flex items-center justify-between"><Badge variant="outline" className="text-[10px] h-5">{FileStatusLabel[file.status]}</Badge><FileActions file={file} onDelete={remove} onVersion={()=>{setVersionTarget(file);versionInput.current?.click();}} onHistory={()=>void showHistory(file)} /></div></div>)}</div>}
      {pagination.total > pagination.pageSize && <div className="mt-5 flex items-center justify-end gap-3 text-sm"><span className="text-muted-foreground">共 {pagination.total} 个文件</span><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>上一页</Button><span>{page}</span><Button variant="outline" size="sm" disabled={!pagination.hasMore} onClick={() => setPage((current) => current + 1)}>下一页</Button></div>}<Dialog open={Boolean(historyTarget)} onOpenChange={(o)=>!o&&setHistoryTarget(null)}><DialogContent><DialogHeader><DialogTitle>{historyTarget?.originalFilename} 的版本历史</DialogTitle><DialogDescription>归档版本和历史版本均可下载。</DialogDescription></DialogHeader><div className="space-y-2">{versions.map(v=><div key={v.id} className="flex justify-between text-sm border rounded p-2"><span>V{v.versionNumber}{v.isCurrent?'（当前）':''} · {v.uploader.name}</span><button className="text-primary" onClick={()=>window.open(`/api/files/${historyTarget?.id}/versions/${v.versionNumber}/content`,'_blank','noopener')}>下载</button></div>)}</div></DialogContent></Dialog>
    </motion.div>
  </div>;
}

function FileActions({ file, onDelete, onVersion, onHistory }: { file: ApiFile; onDelete: (file: ApiFile) => void; onVersion: () => void; onHistory: () => void }) {
  return <div className="flex items-center gap-1"><Button variant="ghost" size="icon-xs" title="下载或查看文件" onClick={() => window.open(`/api/files/${file.id}/content`, '_blank', 'noopener,noreferrer')}><Download /></Button><Button variant="ghost" size="icon-xs" title="版本历史" onClick={onHistory}><History /></Button>{file.canDelete && <Button variant="ghost" size="icon-xs" title="上传新版本" onClick={onVersion}><Upload /></Button>}{file.canDelete && <Button variant="ghost" size="icon-xs" title="删除文件" onClick={() => onDelete(file)}><Trash2 className="text-destructive" /></Button>}</div>;
}
