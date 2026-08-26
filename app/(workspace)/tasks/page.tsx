'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Plus, Search, CheckCircle2, Circle } from 'lucide-react';
import { cn, getDeadlineStatus, formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { TaskStatus, TaskStatusLabel, TaskPriority } from '@/types';
import { canCreateTask } from '@/lib/permissions';
import { tasks, getDepartmentById, getProfileById } from '@/data/mock';
import { Badge } from '@/components/ui/badge';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function TaskManagementPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [searchQuery, statusFilter]);

  const statusOptions = [
    { value: 'all', label: '全部' },
    ...Object.entries(TaskStatusLabel).map(([value, label]) => ({ value, label })),
  ];

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">任务管理</h1>
            <p className="text-sm text-muted-foreground">管理团总支全部工作任务</p>
          </div>
          {canCreateTask(user) && (
            <Link
              href="/tasks/new"
              className="h-9 px-4 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              创建任务
            </Link>
          )}
        </motion.div>

        {/* Filters */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索任务…"
              className="h-9 w-full pl-9 pr-3 rounded-lg border border-border bg-white text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </motion.div>

        {/* Task Table */}
        <motion.div variants={fadeUp} className="bg-white rounded-xl border border-border/60 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_100px_100px_120px_80px] gap-4 px-5 py-3 border-b border-border/50 text-xs text-muted-foreground font-medium">
            <span>任务</span>
            <span>部门</span>
            <span>负责人</span>
            <span>截止日期</span>
            <span>状态</span>
          </div>

          {/* Rows */}
          {filteredTasks.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-muted-foreground">没有找到相关任务</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const deadline = getDeadlineStatus(task.finalDeadline);
              const dept = getDepartmentById(task.departmentId);
              const leader = getProfileById(task.leaderId);

              return (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="grid grid-cols-[1fr_100px_100px_120px_80px] gap-4 px-5 py-4 border-b border-border/30 last:border-0 hover:bg-surface-hover transition-colors items-center group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'shrink-0',
                      (task.status === TaskStatus.APPROVED || task.status === TaskStatus.ARCHIVED) ? 'text-success' : 'text-muted-foreground/40'
                    )}>
                      {(task.status === TaskStatus.APPROVED || task.status === TaskStatus.ARCHIVED)
                        ? <CheckCircle2 className="w-4 h-4" />
                        : <Circle className="w-4 h-4" />
                      }
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium truncate block">{task.title}</span>
                      {task.priority !== TaskPriority.NORMAL && (
                        <Badge variant={task.priority === TaskPriority.URGENT ? 'destructive' : 'secondary'} className="text-[10px] h-4 px-1 mt-1">
                          {task.priority === TaskPriority.URGENT ? '紧急' : '重要'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">{dept?.shortName}</span>
                  <span className="text-sm">{leader?.name}</span>
                  <span className={cn(
                    'text-sm font-tabular',
                    deadline.variant === 'danger' && 'text-destructive font-medium',
                    deadline.variant === 'warning' && 'text-warning font-medium',
                  )}>
                    {formatDate(task.finalDeadline, 'MM/dd')}
                  </span>
                  <Badge variant="outline" className="text-[11px] h-6 justify-center">
                    {TaskStatusLabel[task.status]}
                  </Badge>
                </Link>
              );
            })
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
