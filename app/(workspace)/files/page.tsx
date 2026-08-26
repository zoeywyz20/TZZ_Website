'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Grid3X3, List, FileText, FileSpreadsheet, Archive, Image, Filter, Download } from 'lucide-react';
import { cn, formatFileSize, formatRelativeTime, formatDate } from '@/lib/utils';
import { FileStatus, FileStatusLabel } from '@/types';
import { files, departments, getProfileById, getDepartmentById } from '@/data/mock';
import { Badge } from '@/components/ui/badge';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

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
  const [deptFilter, setDeptFilter] = useState('all');

  const filteredFiles = useMemo(() => {
    let result = [...files];
    if (deptFilter !== 'all') {
      result = result.filter((f) => f.departmentId === deptFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((f) => f.originalFilename.toLowerCase().includes(q));
    }
    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [searchQuery, deptFilter]);

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">材料中心</h1>
          <p className="text-sm text-muted-foreground">浏览和管理团总支全部材料文件</p>
        </motion.div>

        {/* Toolbar */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索文件、任务、活动……"
              className="h-9 w-full pl-9 pr-3 rounded-lg border border-border bg-white text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all"
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
          >
            <option value="all">全部部门</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={cn('h-9 w-9 flex items-center justify-center transition-colors', viewMode === 'list' ? 'bg-muted' : 'hover:bg-muted/50')}
              aria-label="列表视图"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn('h-9 w-9 flex items-center justify-center transition-colors', viewMode === 'grid' ? 'bg-muted' : 'hover:bg-muted/50')}
              aria-label="网格视图"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* File List / Grid */}
        <motion.div variants={fadeUp}>
          {filteredFiles.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-xl bg-muted mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">没有找到相关文件</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="bg-white rounded-xl border border-border/60 overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_80px_80px_90px_80px] gap-4 px-5 py-3 border-b border-border/50 text-xs text-muted-foreground font-medium">
                <span>文件</span>
                <span>部门</span>
                <span>大小</span>
                <span>版本</span>
                <span>更新时间</span>
                <span>状态</span>
              </div>
              {filteredFiles.map((file) => {
                const Icon = getFileTypeIcon(file.mimeType);
                const iconColor = getFileTypeColor(file.mimeType);
                const uploader = getProfileById(file.uploaderId);
                const dept = file.departmentId ? getDepartmentById(file.departmentId) : null;

                return (
                  <div
                    key={file.id}
                    className="grid grid-cols-[1fr_100px_80px_80px_90px_80px] gap-4 px-5 py-3.5 border-b border-border/30 last:border-0 hover:bg-surface-hover transition-colors items-center cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', iconColor)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm truncate block">{file.originalFilename}</span>
                        <span className="text-[11px] text-muted-foreground">{uploader?.name}</span>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">{dept?.shortName || '-'}</span>
                    <span className="text-sm text-muted-foreground font-tabular">{formatFileSize(file.size)}</span>
                    <span className="text-sm text-muted-foreground font-tabular">V{file.currentVersion}</span>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(file.updatedAt)}</span>
                    <Badge variant="outline" className="text-[10px] h-5 justify-center">
                      {FileStatusLabel[file.status]}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredFiles.map((file) => {
                const Icon = getFileTypeIcon(file.mimeType);
                const iconColor = getFileTypeColor(file.mimeType);
                const uploader = getProfileById(file.uploaderId);

                return (
                  <div
                    key={file.id}
                    className="bg-white rounded-xl border border-border/60 p-4 hover:border-border hover:shadow-sm transition-all cursor-pointer group"
                  >
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', iconColor)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-medium truncate mb-1">{file.originalFilename}</h3>
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      <p>{uploader?.name} · {formatFileSize(file.size)}</p>
                      <p>{formatRelativeTime(file.updatedAt)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] h-5">
                        {FileStatusLabel[file.status]}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-tabular">V{file.currentVersion}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
