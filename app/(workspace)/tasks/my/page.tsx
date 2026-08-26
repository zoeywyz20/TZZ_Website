'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search, Filter, ArrowUpDown, Clock, CheckCircle2, AlertTriangle, Circle } from 'lucide-react';
import { cn, getDeadlineStatus, formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { TaskStatus, TaskStatusLabel, TaskPriority, TaskPriorityLabel } from '@/types';
import { tasks, getProfileById, getDepartmentById, getTasksForUser } from '@/data/mock';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

type TabFilter = 'all' | 'pending' | 'in_progress' | 'under_review' | 'completed';

const tabMap: Record<TabFilter, TaskStatus[]> = {
  all: [],
  pending: [TaskStatus.ASSIGNED],
  in_progress: [TaskStatus.IN_PROGRESS, TaskStatus.REVISION_REQUIRED],
  under_review: [TaskStatus.SUBMITTED, TaskStatus.UNDER_REVIEW],
  completed: [TaskStatus.APPROVED, TaskStatus.ARCHIVED],
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function MyTasksPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const myTasks = useMemo(() => {
    if (!user) return [];
    return getTasksForUser(user.id);
  }, [user]);

  const filteredTasks = useMemo(() => {
    let result = myTasks;

    // Tab filter
    if (activeTab !== 'all') {
      const statuses = tabMap[activeTab];
      result = result.filter((t) => statuses.includes(t.status));
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }

    return result;
  }, [myTasks, activeTab, searchQuery]);

  const tabCounts = useMemo(() => ({
    all: myTasks.length,
    pending: myTasks.filter((t) => tabMap.pending.includes(t.status)).length,
    in_progress: myTasks.filter((t) => tabMap.in_progress.includes(t.status)).length,
    under_review: myTasks.filter((t) => tabMap.under_review.includes(t.status)).length,
    completed: myTasks.filter((t) => tabMap.completed.includes(t.status)).length,
  }), [myTasks]);

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        {/* Header */}
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">我的任务</h1>
          <p className="text-sm text-muted-foreground">查看和管理分配给你的全部工作任务</p>
        </motion.div>

        {/* Tabs + Search */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabFilter)}>
            <TabsList className="bg-muted/50 h-9">
              <TabsTrigger value="all" className="text-xs h-7">全部 {tabCounts.all}</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs h-7">待处理 {tabCounts.pending}</TabsTrigger>
              <TabsTrigger value="in_progress" className="text-xs h-7">进行中 {tabCounts.in_progress}</TabsTrigger>
              <TabsTrigger value="under_review" className="text-xs h-7">待审核 {tabCounts.under_review}</TabsTrigger>
              <TabsTrigger value="completed" className="text-xs h-7">已完成 {tabCounts.completed}</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索任务…"
              className="h-9 w-full sm:w-56 pl-9 pr-3 rounded-lg border border-border bg-white text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all"
            />
          </div>
        </motion.div>

        {/* Task List */}
        <motion.div variants={fadeUp} className="space-y-2">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-xl bg-muted mx-auto mb-4 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {activeTab === 'all' ? '当前没有需要处理的工作。' : '没有符合筛选条件的任务。'}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const deadline = getDeadlineStatus(task.finalDeadline);
              const dept = getDepartmentById(task.departmentId);
              const leader = getProfileById(task.leaderId);
              const completedDels = task.deliverables.filter((d) => d.status === 'approved').length;
              const totalDels = task.deliverables.length;

              return (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="group block p-5 rounded-xl bg-white border border-border/60 hover:border-border hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-4">
                    {/* Status indicator */}
                    <div className={cn(
                      'mt-1 shrink-0',
                      task.status === TaskStatus.IN_PROGRESS && 'text-ocean',
                      task.status === TaskStatus.UNDER_REVIEW && 'text-warning',
                      task.status === TaskStatus.REVISION_REQUIRED && 'text-destructive',
                      task.status === TaskStatus.APPROVED && 'text-success',
                      task.status === TaskStatus.ASSIGNED && 'text-muted-foreground',
                    )}>
                      {task.status === TaskStatus.APPROVED || task.status === TaskStatus.ARCHIVED
                        ? <CheckCircle2 className="w-4 h-4" />
                        : <Circle className="w-4 h-4" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-medium truncate">{task.title}</h3>
                            {task.priority === TaskPriority.URGENT && (
                              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">紧急</Badge>
                            )}
                            {task.priority === TaskPriority.IMPORTANT && (
                              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 border border-warning/30 text-warning bg-warning/5">重要</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{dept?.shortName}</span>
                            <span className="text-border">·</span>
                            <span>负责人 {leader?.name}</span>
                            <span className="text-border">·</span>
                            <span>{TaskStatusLabel[task.status]}</span>
                            <span className="text-border">·</span>
                            <span>{completedDels}/{totalDels} 交付项</span>
                          </div>
                        </div>

                        {/* Deadline */}
                        <div className={cn(
                          'text-right shrink-0',
                          deadline.variant === 'danger' && 'text-destructive',
                          deadline.variant === 'warning' && 'text-warning',
                        )}>
                          <div className="stat-number text-sm font-semibold">
                            {formatDate(task.finalDeadline, 'MM/dd')}
                          </div>
                          <div className="text-[11px] mt-0.5 font-medium">
                            {deadline.label}
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              completedDels === totalDels ? 'bg-success' : 'bg-foreground/20'
                            )}
                            style={{ width: `${totalDels > 0 ? (completedDels / totalDels) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground font-tabular">
                          {totalDels > 0 ? Math.round((completedDels / totalDels) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
