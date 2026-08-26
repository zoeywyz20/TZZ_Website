'use client';

import { use } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react';
import { cn, getInitials, getDeadlineStatus, formatDate } from '@/lib/utils';
import { getDepartmentById, getMembersByDepartment, getTasksByDepartment, getProfileById } from '@/data/mock';
import { RoleLabel, TaskStatus, TaskStatusLabel } from '@/types';
import { Badge } from '@/components/ui/badge';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const dept = getDepartmentById(id);

  if (!dept) {
    return (
      <div className="p-6 lg:p-10 text-center py-20">
        <p className="text-muted-foreground">部门不存在。</p>
        <Link href="/departments" className="text-sm text-ocean mt-2 inline-block">返回部门列表</Link>
      </div>
    );
  }

  const members = getMembersByDepartment(dept.id);
  const leader = dept.leaderId ? getProfileById(dept.leaderId) : null;
  const allMembers = leader ? [leader, ...members.filter((m) => m.id !== leader.id)] : members;
  const deptTasks = getTasksByDepartment(dept.id);

  return (
    <div className="p-6 lg:p-10 max-w-[1000px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        <motion.div variants={fadeUp}>
          <Link href="/departments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> 返回
          </Link>
        </motion.div>

        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">{dept.name}</h1>
          <p className="text-sm text-muted-foreground">{dept.description}</p>
        </motion.div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-8">
          {/* Tasks */}
          <motion.section variants={fadeUp}>
            <h2 className="text-lg font-semibold mb-4">部门任务</h2>
            <div className="space-y-2">
              {deptTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">暂无任务</p>
              ) : (
                deptTasks.map((task) => {
                  const deadline = getDeadlineStatus(task.finalDeadline);
                  const taskLeader = getProfileById(task.leaderId);
                  return (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className="flex items-center gap-3 p-4 rounded-xl bg-white border border-border/60 hover:border-border transition-all group"
                    >
                      <div className={cn(
                        'shrink-0',
                        (task.status === TaskStatus.APPROVED || task.status === TaskStatus.ARCHIVED) ? 'text-success' : 'text-muted-foreground/40',
                      )}>
                        {(task.status === TaskStatus.APPROVED || task.status === TaskStatus.ARCHIVED)
                          ? <CheckCircle2 className="w-4 h-4" />
                          : <Circle className="w-4 h-4" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{task.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {taskLeader?.name} · {TaskStatusLabel[task.status]}
                        </div>
                      </div>
                      <span className={cn(
                        'text-xs font-tabular shrink-0',
                        deadline.variant === 'danger' && 'text-destructive font-medium',
                        deadline.variant === 'warning' && 'text-warning font-medium',
                      )}>
                        {formatDate(task.finalDeadline, 'MM/dd')}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </motion.section>

          {/* Members */}
          <motion.section variants={fadeUp}>
            <h2 className="text-lg font-semibold mb-4">成员 ({allMembers.length})</h2>
            <div className="space-y-2">
              {allMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white border border-border/60"
                >
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0',
                    member.id === dept.leaderId ? 'bg-foreground text-background' : 'bg-foreground/10',
                  )}>
                    {getInitials(member.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{member.name}</div>
                    <div className="text-[11px] text-muted-foreground">{RoleLabel[member.role]}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        </div>
      </motion.div>
    </div>
  );
}
