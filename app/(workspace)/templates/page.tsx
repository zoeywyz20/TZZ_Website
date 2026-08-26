'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Download, FileText, Eye } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { templates } from '@/data/mock';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const categories = ['全部', '活动', '宣传', '行政', '实践', '组织'];

export default function TemplatesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('全部');

  const filteredTemplates = useMemo(() => {
    let result = [...templates];
    if (categoryFilter !== '全部') {
      result = result.filter((t) => t.category === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    return result.sort((a, b) => b.downloadCount - a.downloadCount);
  }, [searchQuery, categoryFilter]);

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">模板中心</h1>
          <p className="text-sm text-muted-foreground">常用材料模板，快速开始你的工作</p>
        </motion.div>

        {/* Search + Category */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索模板……"
              className="h-9 w-full pl-9 pr-3 rounded-lg border border-border bg-white text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                  categoryFilter === cat
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Template Grid */}
        <motion.div variants={fadeUp}>
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm text-muted-foreground">没有找到相关模板</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="bg-white rounded-xl border border-border/60 p-5 hover:border-border hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{tmpl.category}</Badge>
                  </div>
                  <h3 className="text-sm font-medium mb-1">{tmpl.name}</h3>
                  {tmpl.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{tmpl.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-border/40">
                    <span className="text-[11px] text-muted-foreground font-tabular">
                      {tmpl.downloadCount} 次下载
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="h-7 px-2.5 rounded-md border border-border text-[11px] hover:bg-muted transition-colors inline-flex items-center gap-1">
                        <Eye className="w-3 h-3" /> 预览
                      </button>
                      <button
                        onClick={() => toast.success(`已下载「${tmpl.name}」`)}
                        className="h-7 px-2.5 rounded-md bg-foreground text-background text-[11px] hover:bg-foreground/90 transition-colors inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> 下载
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
