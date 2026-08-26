'use client';

import { use, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, Clock, User, Users, CheckCircle2, Circle,
  Upload, FileText, AlertTriangle, MessageSquare, History,
} from 'lucide-react';
import { cn, formatDate, formatRelativeTime, getDeadlineStatus, formatFileSize, getInitials } from '@/lib/utils';
import { TaskStatusLabel, TaskPriorityLabel, TaskPriority, TaskStatus } from '@/types';
import { workspaceApi } from '@/lib/api/workspace';
import type { TaskDto } from '@/lib/api/contracts';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [task, setTask] = useState<TaskDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    workspaceApi.task(id).then((result) => { if (active) setTask(result); }).catch(() => { if (active) setTask(null); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="p-6 lg:p-10 text-center py-20"><p className="text-muted-foreground">正在加载任务…</p></div>;

  if (!task) {
    return (
      <div className="p-6 lg:p-10 text-center py-20">
        <p className="text-muted-foreground">任务不存在或已被删除。</p>
        <Link href="/tasks" className="text-sm text-ocean mt-2 inline-block">返回任务列表</Link>
      </div>
    );
  }

  const deadline = getDeadlineStatus(task.finalDeadline);
  const internalDeadline = task.internalDeadline ? getDeadlineStatus(task.internalDeadline) : { variant: 'default', label: '' };
  const completedDels = task.deliverables.filter((d) => d.status === 'approved').length;
  const totalDels = task.deliverables.length;
  const executors = task.assignees.filter((a) => a.role === 'executor').map((a) => a.profile);
  const collaborators = task.assignees.filter((a) => a.role === 'collaborator').map((a) => a.profile);
  const reviewers = task.assignees.filter((a) => a.role === 'reviewer').map((a) => a.profile);

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        {/* Back */}
        <motion.div variants={fadeUp}>
          <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> 返回任务列表
          </Link>
        </motion.div>

        {/* Title Section */}
        <motion.div variants={fadeUp} className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className="h-6">
                  {TaskStatusLabel[task.status]}
                </Badge>
                {task.priority !== TaskPriority.NORMAL && (
                  <Badge variant={task.priority === TaskPriority.URGENT ? 'destructive' : 'secondary'} className="h-6">
                    {TaskPriorityLabel[task.priority]}
                  </Badge>
                )}
                {deadline.variant === 'danger' && (
                  <Badge variant="destructive" className="h-6 gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {deadline.label}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 shrink-0">
              {task.status === TaskStatus.IN_PROGRESS && (
                <button className="h-9 px-4 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  上传材料
                </button>
              )}
              {(task.status === TaskStatus.SUBMITTED || task.status === TaskStatus.UNDER_REVIEW) && (
                <button className="h-9 px-4 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors">
                  审核
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          {/* Left — Main content */}
          <div className="space-y-8">
            {/* Description */}
            {task.description && (
              <motion.section variants={fadeUp}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">任务说明</h2>
                <div className="text-sm leading-relaxed text-foreground/80 bg-white rounded-xl border border-border/60 p-5">
                  {task.description}
                </div>
              </motion.section>
            )}

            {/* Source */}
            {task.source && (
              <motion.section variants={fadeUp}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">任务来源</h2>
                <p className="text-sm text-foreground/80">{task.source}</p>
              </motion.section>
            )}

            {/* Deliverables */}
            <motion.section variants={fadeUp}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">交付清单</h2>
                <span className="text-sm text-muted-foreground font-tabular">
                  {completedDels} / {totalDels} 已完成
                  <span className="ml-2 text-xs">
                    {totalDels > 0 ? Math.round((completedDels / totalDels) * 100) : 0}%
                  </span>
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-5">
                <motion.div
                  className={cn('h-full rounded-full', completedDels === totalDels ? 'bg-success' : 'bg-foreground/25')}
                  initial={{ width: 0 }}
                  animate={{ width: `${totalDels > 0 ? (completedDels / totalDels) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>

              <div className="space-y-2">
                {task.deliverables.map((del) => {
                  const assignee = del.assignee;
                  const reviewer = del.reviewer;

                  return (
                    <div
                      key={del.id}
                      className="flex items-start gap-3 p-4 rounded-xl bg-white border border-border/60 group hover:border-border transition-all"
                    >
                      <div className={cn(
                        'mt-0.5 shrink-0',
                        del.status === 'approved' && 'text-success',
                        del.status === 'submitted' && 'text-ocean',
                        del.status === 'revision_required' && 'text-destructive',
                        del.status === 'pending' && 'text-muted-foreground/40',
                      )}>
                        {del.status === 'approved'
                          ? <CheckCircle2 className="w-5 h-5" />
                          : <Circle className="w-5 h-5" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{del.name}</span>
                          {del.required && (
                            <span className="text-[10px] text-destructive font-medium">必交</span>
                          )}
                        </div>
                        {del.description && (
                          <p className="text-xs text-muted-foreground mb-2">{del.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {assignee && <span>负责：{assignee.name}</span>}
                          {reviewer && (
                            <>
                              <span className="text-border">·</span>
                              <span>审核：{reviewer.name}</span>
                            </>
                          )}
                          {del.allowedFormats && (
                            <>
                              <span className="text-border">·</span>
                              <span>{del.allowedFormats.join(' ')}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Upload button for pending items */}
                      {del.status === 'pending' && (
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 h-8 px-3 rounded-lg border border-border text-xs hover:bg-muted">
                          上传
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.section>

          </div>

          {/* Right — Info sidebar */}
          <div className="space-y-6">
            <motion.div variants={fadeUp} className="bg-white rounded-xl border border-border/60 p-5 space-y-5">
              <h2 className="text-sm font-semibold">任务信息</h2>

              <div className="space-y-4">
                <InfoRow label="部门" value={task.department.name} />
                <InfoRow label="创建人" value={task.creator.name} />
                <InfoRow label="负责人" value={task.leader.name} />

                <Separator className="bg-border/50" />

                <div>
                  <span className="text-xs text-muted-foreground block mb-2">执行人</span>
                  <div className="flex flex-wrap gap-1.5">
                    {executors.map((p) => (
                      <span key={p.id} className="text-xs px-2 py-1 rounded-md bg-muted">{p.name}</span>
                    ))}
                    {executors.length === 0 && <span className="text-xs text-muted-foreground">未指定</span>}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block mb-2">协办人</span>
                  <div className="flex flex-wrap gap-1.5">
                    {collaborators.map((p) => (
                      <span key={p.id} className="text-xs px-2 py-1 rounded-md bg-muted">{p.name}</span>
                    ))}
                    {collaborators.length === 0 && <span className="text-xs text-muted-foreground">无</span>}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block mb-2">审核人</span>
                  <div className="flex flex-wrap gap-1.5">
                    {reviewers.map((p) => (
                      <span key={p.id} className="text-xs px-2 py-1 rounded-md bg-muted">{p.name}</span>
                    ))}
                  </div>
                </div>

                <Separator className="bg-border/50" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">内部截止</span>
                    <span className={cn(
                      'text-sm font-tabular font-medium',
                      internalDeadline.variant === 'danger' && 'text-destructive',
                      internalDeadline.variant === 'warning' && 'text-warning',
                    )}>
                      {task.internalDeadline ? formatDate(task.internalDeadline, 'MM/dd HH:mm') : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">最终截止</span>
                    <span className={cn(
                      'text-sm font-tabular font-medium',
                      deadline.variant === 'danger' && 'text-destructive',
                      deadline.variant === 'warning' && 'text-warning',
                    )}>
                      {formatDate(task.finalDeadline, 'MM/dd HH:mm')}
                    </span>
                  </div>
                </div>

                <Separator className="bg-border/50" />

                <div className="space-y-2">
                  <InfoRow label="可见范围" value={task.visibility === 'ALL' ? '所有成员' : task.visibility === 'DEPARTMENT' ? '所在部门' : '指定人员'} />
                  <InfoRow label="创建时间" value={formatDate(task.createdAt, 'yyyy-MM-dd HH:mm')} />
                  <InfoRow label="更新时间" value={formatRelativeTime(task.updatedAt)} />
                </div>
              </div>

              {/* Tags */}
              {task.tags.length > 0 && (
                <div className="pt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {task.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
