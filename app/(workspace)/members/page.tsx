'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { RoleLabel, Role } from '@/types';
import type { MemberDto } from '@/lib/api/contracts';
import { workspaceApi } from '@/lib/api/workspace';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { canManageMembers } from '@/lib/permissions';
import type { DepartmentDto } from '@/lib/api/contracts';

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
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [creating, setCreating] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', role: Role.MEMBER, departmentId: '' });
  const { user } = useAuth();
  const canManage = canManageMembers(user);

  useEffect(() => {
    let active = true;
    workspaceApi.members().then((members) => { if (active) setProfiles(members); }).catch(() => { if (active) setError('成员加载失败，请稍后重试。'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (canManage) workspaceApi.departments().then(setDepartments).catch(() => undefined); }, [canManage]);

  async function createMember(event: React.FormEvent) {
    event.preventDefault(); setError('');
    try { await workspaceApi.createMember({ ...newMember, departmentId: newMember.departmentId || null }); setNewMember({ name: '', email: '', role: Role.MEMBER, departmentId: '' }); setCreating(false); setProfiles(await workspaceApi.members()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '开户失败。'); }
  }
  async function accountAction(id: string, action: 'enable' | 'disable' | 'reset-password') {
    try { await workspaceApi.updateMemberAccount(id, action); setProfiles(await workspaceApi.members()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '操作失败。'); }
  }

  const filteredMembers = useMemo(() => {
    let result = [...profiles];
    if (roleFilter !== 'all') {
      result = result.filter((p) => p.role === roleFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }
    return result.sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
  }, [profiles, searchQuery, roleFilter]);

  return (
    <div className="p-6 lg:p-10 max-w-[1000px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">成员</h1>
          <div className="flex items-center justify-between gap-4"><p className="text-sm text-muted-foreground">团总支全体成员 ({profiles.length}人)</p>{canManage && <div className="flex gap-2"><Link href="/members/registrations" className="h-9 rounded-lg border px-3 py-2 text-sm">注册申请</Link><button onClick={() => setCreating((value) => !value)} className="h-9 rounded-lg bg-foreground px-3 text-sm text-background">创建账号</button></div>}</div>
        </motion.div>

        {creating && <motion.form variants={fadeUp} onSubmit={createMember} className="mb-6 grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2"><input required value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} placeholder="姓名" className="h-10 rounded-lg border px-3 text-sm" /><input required type="email" value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} placeholder="name@stu.njnu.edu.cn" className="h-10 rounded-lg border px-3 text-sm" /><select value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value as Role })} className="h-10 rounded-lg border px-3 text-sm">{Object.values(Role).map((role) => <option key={role} value={role}>{RoleLabel[role]}</option>)}</select><select value={newMember.departmentId} onChange={(e) => setNewMember({ ...newMember, departmentId: e.target.value })} className="h-10 rounded-lg border px-3 text-sm"><option value="">不分配部门</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><div className="sm:col-span-2 flex items-center justify-between"><span className="text-xs text-muted-foreground">新账号将使用管理员配置的初始密码，并在首次登录时强制修改。</span><button className="h-9 rounded-lg bg-foreground px-4 text-sm text-background">开通账号</button></div></motion.form>}

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
                    <span>{dept?.name ?? '未分配部门'}</span>
                    {canManage && <span>{member.email}</span>}
                  </div>
                </div>
                {canManage && <div className="flex shrink-0 gap-2"><button onClick={() => accountAction(member.id, member.accountEnabled === false ? 'enable' : 'disable')} className="text-xs text-muted-foreground hover:text-foreground">{member.accountEnabled === false ? '启用' : '禁用'}</button><button onClick={() => accountAction(member.id, 'reset-password')} className="text-xs text-muted-foreground hover:text-foreground">重置密码</button></div>}
              </div>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}
