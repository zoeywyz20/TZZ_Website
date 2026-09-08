'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Clock, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { cn, getGreeting, formatDate, formatRelativeTime, getDeadlineStatus, formatFileSize } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { TaskStatusLabel } from '@/types';
import {
  dashboardStats,
  attentionItems,
  activityLogs,
  files as allFiles,
  tasks,
  departments,
  getProfileById,
  getDepartmentById,
} from '@/data/mock';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

/* ── Helper: extract file extension as mono label ── */
function getExtLabel(filename: string): string {
  const ext = filename.split('.').pop()?.toUpperCase();
  if (!ext) return 'FILE';
  const map: Record<string, string> = {
    DOCX: 'DOCX', DOC: 'DOC', PDF: 'PDF', XLSX: 'XLSX', XLS: 'XLS',
    PPTX: 'PPTX', ZIP: 'ZIP', RAR: 'RAR', PNG: 'PNG', JPG: 'JPG',
  };
  return map[ext] || ext;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const today = formatDate(new Date(), 'yyyy年M月d日 EEEE');

  const stats = [
    { label: '进行中任务', value: dashboardStats.myTasks },
    { label: '即将截止', value: dashboardStats.approaching, accent: 'warning' as const },
    { label: '已逾期', value: dashboardStats.overdue, accent: 'danger' as const },
    { label: '待我审核', value: dashboardStats.pendingReview },
    { label: '本月完成', value: dashboardStats.completedThisMonth, accent: 'success' as const },
  ];

  const recentFiles = allFiles.slice(0, 5);

  const upcomingTasks = tasks
    .filter((t) => t.status !== 'APPROVED' && t.status !== 'ARCHIVED' && t.status !== 'DRAFT')
    .sort((a, b) => new Date(a.finalDeadline).getTime() - new Date(b.finalDeadline).getTime());

  // The most urgent non-completed task = focus task hero
  const focusTask = upcomingTasks[0];
  const focusDeadline = focusTask ? getDeadlineStatus(focusTask.finalDeadline) : null;
  const focusDept = focusTask ? getDepartmentById(focusTask.departmentId) : null;
  const focusCompletedDels = focusTask ? focusTask.deliverables.filter((d) => d.status === 'approved').length : 0;
  const focusTotalDels = focusTask ? focusTask.deliverables.length : 0;
  const focusPct = focusTotalDels > 0 ? Math.round((focusCompletedDels / focusTotalDels) * 100) : 0;

  // Remaining upcoming tasks
  const otherTasks = upcomingTasks.slice(1, 6);

  return (
    <div className="p-6 lg:px-12 lg:py-10 max-w-[1360px] mx-auto space-y-12">
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-12">

        {/* ────────────────────────────────────────────────────
            1. GREETING & HEADER
        ──────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="flex items-end justify-between gap-8 pb-2">
          <div>
            <p className="text-[13px] font-medium text-muted-foreground/70 mb-1.5 tracking-wide">
              {today} — 团总支数字工作台
            </p>
            <h1 className="text-3xl lg:text-[2.25rem] font-semibold tracking-[-0.03em] leading-tight">
              {getGreeting()}，{user?.name}
            </h1>
          </div>

          {/* Ocean Brand Accent Watermark */}
          <div className="hidden lg:flex items-center gap-2.5 text-muted-foreground/25 select-none shrink-0 pb-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 12C2 12 5 8 12 8C19 8 22 12 22 12" />
              <path d="M2 16C2 16 5 12 12 12C19 12 22 16 22 16" />
              <path d="M2 20C2 20 5 16 12 16C19 16 22 20 22 20" />
            </svg>
            <span className="text-[12px] font-medium tracking-[0.15em] uppercase">OCEAN WORKSPACE</span>
          </div>
        </motion.div>

        {/* ────────────────────────────────────────────────────
            2. CORE STATS — Typography-driven & Divider Separated
        ──────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="flex flex-wrap items-start gap-y-6">
          {stats.map((stat, i) => (
            <div key={stat.label} className="flex items-start">
              {i > 0 && (
                <div className="w-px h-8 bg-border/60 mx-6 lg:mx-10 mt-2" />
              )}
              <div className="group">
                <span className={cn(
                  'stat-number text-4xl lg:text-5xl font-semibold leading-none tracking-tight block',
                  stat.accent === 'danger' && stat.value > 0 && 'text-destructive',
                  stat.accent === 'warning' && stat.value > 0 && 'text-warning',
                  stat.accent === 'success' && 'text-success/80',
                  !stat.accent && 'text-foreground',
                )}>
                  {String(stat.value).padStart(2, '0')}
                </span>
                <span className="text-[13px] text-muted-foreground font-medium block mt-2">
                  {stat.label}
                </span>
              </div>
            </div>
          ))}
        </motion.div>

        {/* ────────────────────────────────────────────────────
            3. "今日重点任务" — PRIMARY VISUAL HERO ANCHOR
        ──────────────────────────────────────────────────── */}
        {focusTask && (
          <motion.div variants={fadeUp} className="relative">
            <div className="flex items-center gap-2 mb-3.5">
              <span className="w-2.5 h-2.5 rounded-full bg-foreground" />
              <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-foreground">
                今日重点任务
              </span>
            </div>

            <div className="p-6 lg:p-8 rounded-xl bg-white border border-border/80 shadow-sm relative overflow-hidden group">
              {/* Subtle background flow accent */}
              <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-surface/60 to-transparent pointer-events-none" />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                {/* Task Details */}
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-3 text-[13px]">
                    <span className="px-2.5 py-0.5 rounded-md bg-foreground/5 font-medium text-foreground">
                      {focusDept?.name}
                    </span>
                    <span className="text-border">·</span>
                    <span className="text-muted-foreground">{TaskStatusLabel[focusTask.status]}</span>
                    <span className="text-border">·</span>
                    <span className="font-tabular font-medium text-foreground">
                      {focusCompletedDels} / {focusTotalDels} 交付项已完成
                    </span>
                  </div>

                  <h2 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground leading-snug">
                    <Link href={`/tasks/${focusTask.id}`} className="hover:underline">
                      {focusTask.title}
                    </Link>
                  </h2>

                  {/* Progress Line */}
                  <div className="flex items-center gap-4 pt-1 max-w-md">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={cn(
                          'h-full rounded-full',
                          focusPct === 100 ? 'bg-success' : 'bg-foreground'
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${focusPct}%` }}
                        transition={{ duration: 0.9, delay: 0.2, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="stat-number text-[14px] font-medium text-muted-foreground font-tabular">
                      {focusPct}%
                    </span>
                  </div>
                </div>

                {/* Deadline & CTA */}
                <div className="flex items-center lg:flex-col lg:items-end justify-between gap-6 shrink-0 pt-4 lg:pt-0 border-t border-border/40 lg:border-t-0">
                  <div className="lg:text-right">
                    <span className="text-[12px] text-muted-foreground block font-medium mb-1">
                      截止时间
                    </span>
                    <div className={cn(
                      'stat-number text-3xl lg:text-4xl font-semibold leading-none',
                      focusDeadline?.variant === 'danger' && 'text-destructive',
                      focusDeadline?.variant === 'warning' && 'text-warning',
                    )}>
                      {formatDate(focusTask.finalDeadline, 'MM/dd')}
                    </div>
                    <span className={cn(
                      'text-[13px] font-medium block mt-1.5',
                      focusDeadline?.variant === 'danger' && 'text-destructive',
                      focusDeadline?.variant === 'warning' && 'text-warning',
                      focusDeadline?.variant === 'normal' && 'text-muted-foreground',
                    )}>
                      {focusDeadline?.label}
                    </span>
                  </div>

                  <Link
                    href={`/tasks/${focusTask.id}`}
                    className="h-10 px-5 bg-foreground text-background rounded-lg text-[14px] font-medium hover:bg-foreground/90 transition-colors inline-flex items-center gap-2 shrink-0"
                  >
                    继续处理
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ────────────────────────────────────────────────────
            4. BAND 1: 需要关注 (Needs Attention) + 最近文件 (Recent Files)
        ──────────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-10 lg:gap-12">

          {/* 需要关注 */}
          <motion.section variants={fadeUp}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[17px] font-semibold text-foreground tracking-tight">
                需要关注
              </h2>
              <Link href="/tasks/my" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                查看全部 <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-1">
              {attentionItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.linkTo}
                  className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white transition-all border border-transparent hover:border-border/60"
                >
                  <div className={cn(
                    'w-2 h-2 rounded-full shrink-0 mt-2',
                    item.urgency === 'critical' && 'bg-destructive',
                    item.urgency === 'high' && 'bg-warning',
                    item.urgency === 'medium' && 'bg-ocean',
                    item.urgency === 'low' && 'bg-muted-foreground/40',
                  )} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-medium text-foreground group-hover:text-foreground transition-colors leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-[14px] text-muted-foreground mt-1 leading-normal">
                      {item.description}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-foreground opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-1" />
                </Link>
              ))}
            </div>
          </motion.section>

          {/* 最近文件 */}
          <motion.section variants={fadeUp}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[17px] font-semibold text-foreground tracking-tight">
                最近文件
              </h2>
              <Link href="/files" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                全部 <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-1">
              {recentFiles.map((file) => {
                const uploader = getProfileById(file.uploaderId);
                const ext = getExtLabel(file.originalFilename);

                return (
                  <div
                    key={file.id}
                    className="flex items-start gap-3.5 p-3 rounded-lg hover:bg-white transition-colors cursor-pointer group"
                  >
                    {/* Mono Tag */}
                    <span className="shrink-0 text-[11px] font-mono font-semibold tracking-wider text-muted-foreground/70 bg-muted px-2 py-1 rounded text-center min-w-[44px] mt-0.5">
                      {ext}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[14px] font-medium text-foreground truncate group-hover:text-foreground transition-colors leading-snug">
                        {file.originalFilename}
                      </h4>
                      <p className="text-[13px] text-muted-foreground mt-1">
                        {uploader?.name} · {formatFileSize(file.size)} · {formatRelativeTime(file.updatedAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>

        </div>

        {/* ────────────────────────────────────────────────────
            5. BAND 2: 近期截止 (Upcoming Deadlines) — WIDE SECTION
        ──────────────────────────────────────────────────── */}
        <motion.section variants={fadeUp}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[17px] font-semibold text-foreground tracking-tight">
              近期截止任务
            </h2>
            <Link href="/calendar" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              日历视图 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {otherTasks.map((task) => {
              const deadline = getDeadlineStatus(task.finalDeadline);
              const dept = getDepartmentById(task.departmentId);
              const completedDels = task.deliverables.filter((d) => d.status === 'approved').length;
              const totalDels = task.deliverables.length;

              return (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="group flex items-center gap-4 p-4 rounded-xl bg-white border border-border/60 hover:border-border transition-all hover:shadow-sm"
                >
                  {/* Date Badge */}
                  <div className={cn(
                    'w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 text-center',
                    deadline.variant === 'danger' && 'bg-destructive/8 text-destructive',
                    deadline.variant === 'warning' && 'bg-warning/8 text-warning',
                    deadline.variant === 'normal' && 'bg-muted text-muted-foreground',
                  )}>
                    <span className="text-[11px] font-medium uppercase leading-none">
                      {formatDate(task.finalDeadline, 'MMM')}
                    </span>
                    <span className="stat-number text-base font-bold leading-tight mt-0.5">
                      {formatDate(task.finalDeadline, 'dd')}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-medium text-foreground truncate group-hover:text-foreground transition-colors">
                      {task.title}
                    </h3>
                    <div className="text-[13px] text-muted-foreground mt-1 flex items-center gap-2">
                      <span>{dept?.shortName}</span>
                      <span className="text-border">·</span>
                      <span className="font-tabular">{completedDels}/{totalDels} 交付项</span>
                      <span className="text-border">·</span>
                      <span className={cn(
                        deadline.variant === 'danger' && 'text-destructive font-medium',
                        deadline.variant === 'warning' && 'text-warning font-medium',
                      )}>
                        {deadline.label}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="hidden sm:flex items-center gap-2.5 shrink-0">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-foreground/40 rounded-full transition-all"
                        style={{ width: `${totalDels > 0 ? (completedDels / totalDels) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-[13px] text-muted-foreground font-tabular font-medium">
                      {totalDels > 0 ? Math.round((completedDels / totalDels) * 100) : 0}%
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.section>

        {/* ────────────────────────────────────────────────────
            6. BAND 3: 部门状态 (Department Status) + 最新动态 (Recent Activity)
        ──────────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12">

          {/* 部门状态 */}
          <motion.section variants={fadeUp}>
            <h2 className="text-[17px] font-semibold text-foreground tracking-tight mb-5">
              部门进度状态
            </h2>
            <div className="space-y-5 bg-white p-6 rounded-xl border border-border/60">
              {departments.map((dept) => {
                const deptTasks = tasks.filter((t) => t.departmentId === dept.id);
                const completed = deptTasks.filter((t) => t.status === 'APPROVED' || t.status === 'ARCHIVED').length;
                const total = deptTasks.length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <Link
                    key={dept.id}
                    href={`/departments/${dept.id}`}
                    className="block group"
                  >
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-[15px] font-medium text-foreground group-hover:text-foreground transition-colors">
                        {dept.name}
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="stat-number text-lg font-semibold text-foreground font-tabular">
                          {completed}
                        </span>
                        <span className="text-[13px] text-muted-foreground font-tabular">
                          / {total} 项完成
                        </span>
                      </div>
                    </div>

                    {/* Thin clean indicator */}
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-foreground/60 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.section>

          {/* 最新动态 */}
          <motion.section variants={fadeUp}>
            <h2 className="text-[17px] font-semibold text-foreground tracking-tight mb-5">
              最新动态
            </h2>
            <div className="space-y-4 bg-white p-6 rounded-xl border border-border/60">
              {activityLogs.slice(0, 5).map((log) => {
                const actor = getProfileById(log.actorId);
                return (
                  <div key={log.id} className="pb-3.5 border-b border-border/40 last:border-0 last:pb-0">
                    <p className="text-[14px] leading-relaxed text-foreground/90">
                      <span className="font-medium text-foreground">{actor?.name}</span>
                      <span className="text-muted-foreground"> {log.action} </span>
                      <span className="font-medium text-foreground">《{log.targetName}》</span>
                    </p>
                    <p className="text-[13px] text-muted-foreground/70 mt-1 font-tabular">
                      {formatRelativeTime(log.createdAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.section>

        </div>

        {/* ────────────────────────────────────────────────────
            7. FOOTER BRAND MARK
        ──────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="pt-8 border-t border-border/40 flex items-center justify-between text-[13px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 12C2 12 5 8 12 8C19 8 22 12 22 12" />
              <path d="M2 16C2 16 5 12 12 12C19 12 22 16 22 16" />
            </svg>
            <span>海洋科学与工程学院团总支 · 数字化工作平台</span>
          </div>
          <span className="font-mono text-[12px]">v1.0.0</span>
        </motion.div>

      </motion.div>
    </div>
  );
}
