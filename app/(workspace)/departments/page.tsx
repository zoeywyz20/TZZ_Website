'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Users, ArrowRight, CheckCircle2, Clock, ListTodo } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { departments, tasks, profiles, getMembersByDepartment, getTasksByDepartment, getProfileById } from '@/data/mock';
import { TaskStatus, RoleLabel } from '@/types';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function DepartmentsPage() {
  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">部门</h1>
          <p className="text-sm text-muted-foreground">团总支各部门概览</p>
        </motion.div>

        <motion.div variants={fadeUp} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept) => {
            const members = getMembersByDepartment(dept.id);
            const deptTasks = getTasksByDepartment(dept.id);
            const completedTasks = deptTasks.filter((t) => t.status === TaskStatus.APPROVED || t.status === TaskStatus.ARCHIVED).length;
            const activeTasks = deptTasks.filter((t) => t.status !== TaskStatus.DRAFT && t.status !== TaskStatus.APPROVED && t.status !== TaskStatus.ARCHIVED).length;
            const leader = dept.leaderId ? getProfileById(dept.leaderId) : null;

            return (
              <Link
                key={dept.id}
                href={`/departments/${dept.id}`}
                className="group bg-white rounded-xl border border-border/60 p-6 hover:border-border hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold mb-0.5">{dept.name}</h3>
                    <p className="text-xs text-muted-foreground">{dept.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="text-center p-2 rounded-lg bg-surface">
                    <div className="stat-number text-lg font-semibold">{members.length + 1}</div>
                    <div className="text-[10px] text-muted-foreground">成员</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-surface">
                    <div className="stat-number text-lg font-semibold">{activeTasks}</div>
                    <div className="text-[10px] text-muted-foreground">进行中</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-surface">
                    <div className="stat-number text-lg font-semibold">{completedTasks}</div>
                    <div className="text-[10px] text-muted-foreground">已完成</div>
                  </div>
                </div>

                {/* Leader + Members */}
                <div className="flex items-center gap-2">
                  {leader && (
                    <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-medium" title={`部长：${leader.name}`}>
                      {getInitials(leader.name)}
                    </div>
                  )}
                  {members.slice(0, 3).map((m) => (
                    <div key={m.id} className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-medium" title={m.name}>
                      {getInitials(m.name)}
                    </div>
                  ))}
                  {members.length > 3 && (
                    <span className="text-xs text-muted-foreground ml-1">+{members.length - 3}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}
