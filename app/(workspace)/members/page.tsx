'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { RoleLabel, Role } from '@/types';
import type { MemberDto } from '@/lib/api/contracts';
import { workspaceApi } from '@/lib/api/workspace';
import { Badge } from '@/components/ui/badge';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const roleOrder: Role[] = [Role.SECRETARY, Role.DEPUTY_SECRETARY, Role.MINISTER, Role.VICE_MINISTER, Role.MEMBER];

export default function MembersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [profiles, setProfiles] = useState<MemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    workspaceApi.members().then((members) => { if (active) setProfiles(members); }).catch(() => { if (active) setError('成员加载失败，请稍后重试。'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredMembers = useMemo(() => {
    let result = [...profiles];
    if (roleFilter !== 'all') {
      result = result.filter((p) => p.role === roleFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
    }
    return result.sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
  }, [profiles, searchQuery, roleFilter]);

  return (
    <div className="p-6 lg:p-10 max-w-[1000px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">成员</h1>
          <p className="text-sm text-muted-foreground">团总支全体成员 ({profiles.length}人)</p>
        </motion.div>

        {/* Filters */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索成员……"
              className="h-9 w-full pl-9 pr-3 rounded-lg border border-border bg-white text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
          >
            <option value="all">全部角色</option>
            {roleOrder.map((role) => (
              <option key={role} value={role}>{RoleLabel[role]}</option>
            ))}
          </select>
        </motion.div>

        {/* Member List */}
        <motion.div variants={fadeUp} className="bg-white rounded-xl border border-border/60 overflow-hidden">
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">正在加载成员…</p>
          ) : error ? (
            <p className="py-12 text-center text-sm text-destructive">{error}</p>
          ) : filteredMembers.map((member) => {
            const dept = member.department;

            return (
              <div
                key={member.id}
                className="flex items-center gap-4 px-5 py-4 border-b border-border/30 last:border-0 hover:bg-surface-hover transition-colors"
              >
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium shrink-0',
                  member.role === Role.SECRETARY ? 'bg-foreground text-background' :
                  member.role === Role.DEPUTY_SECRETARY ? 'bg-foreground/80 text-background' :
                  member.role === Role.MINISTER ? 'bg-foreground/20' :
                  'bg-foreground/10'
                )}>
                  {getInitials(member.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{member.name}</span>
                    <Badge variant="secondary" className="text-[10px] h-5">{RoleLabel[member.role]}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>{member.email}</span>
                    {dept && (
                      <>
                        <span className="text-border">·</span>
                        <span>{dept.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-tabular shrink-0">
                  {member.studentId}
                </span>
              </div>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}
