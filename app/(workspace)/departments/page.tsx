'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { DepartmentDto } from '@/lib/api/contracts';
import { workspaceApi } from '@/lib/api/workspace';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    workspaceApi.departments().then((items) => { if (active) setDepartments(items); }).catch(() => { if (active) setError('部门加载失败，请稍后重试。'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">部门</h1>
          <p className="text-sm text-muted-foreground">团总支各部门概览</p>
        </motion.div>

        <motion.div variants={fadeUp} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? <p className="text-sm text-muted-foreground">正在加载部门…</p> : error ? <p className="text-sm text-destructive">{error}</p> : departments.map((dept) => {
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
                    <div className="stat-number text-lg font-semibold">{dept.memberCount}</div>
                    <div className="text-[10px] text-muted-foreground">成员</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-surface">
                    <div className="stat-number text-lg font-semibold">—</div>
                    <div className="text-[10px] text-muted-foreground">任务待接入</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-surface">
                    <div className="stat-number text-lg font-semibold">—</div>
                    <div className="text-[10px] text-muted-foreground">任务待接入</div>
                  </div>
                </div>

                {/* Leader + Members */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{dept.memberCount} 名成员</span>
                </div>
              </Link>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}
