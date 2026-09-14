'use client';

import { ChangeEvent, FormEvent, use, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CheckCircle2, Circle, Upload, AlertTriangle, MoreHorizontal, Pencil, Trash2, Archive,
} from 'lucide-react';
import { cn, formatDate, formatRelativeTime, getDeadlineStatus } from '@/lib/utils';
import { TaskStatusLabel, TaskPriorityLabel, TaskPriority, TaskStatus, Visibility, VisibilityLabel, RoleLabel } from '@/types';
import { workspaceApi } from '@/lib/api/workspace';
import type { DepartmentDto, MemberDto, TaskDto } from '@/lib/api/contracts';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { can } from '@/lib/permissions';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [task, setTask] = useState<TaskDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [edit, setEdit] = useState({ title: '', description: '', source: '', departmentId: '', leaderId: '', priority: TaskPriority.NORMAL, visibility: Visibility.DEPARTMENT, internalDeadline: '', finalDeadline: '', tags: '' });
  const fileInput = useRef<HTMLInputElement>(null);

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
  const chooseUpload = (deliverableId: string | null = null) => { setUploadTarget(deliverableId); fileInput.current?.click(); };
  const beginEdit = () => {
    if (!task) return;
    setEdit({ title: task.title, description: task.description ?? '', source: task.source ?? '', departmentId: task.departmentId, leaderId: task.leaderId, priority: task.priority as TaskPriority, visibility: task.visibility as Visibility, internalDeadline: task.internalDeadline ? toDateTimeInput(task.internalDeadline) : '', finalDeadline: toDateTimeInput(task.finalDeadline), tags: task.tags.join(', ') });
    setEditOpen(true);
    void Promise.all([workspaceApi.departments(), workspaceApi.members()]).then(([nextDepartments, nextMembers]) => { setDepartments(nextDepartments); setMembers(nextMembers); }).catch(() => toast.error('无法加载部门或成员列表。'));
  };
  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!task) return;
    setSaving(true);
    try {
      const updated = await workspaceApi.updateTask(task.id, {
        title: edit.title, description: edit.description || null, source: edit.source || null, departmentId: edit.departmentId, leaderId: edit.leaderId,
        priority: edit.priority, visibility: edit.visibility,
        internalDeadline: edit.internalDeadline ? new Date(edit.internalDeadline).toISOString() : null,
        finalDeadline: new Date(edit.finalDeadline).toISOString(), tags: edit.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      setTask(updated); setEditOpen(false); toast.success('任务已更新。');
    } catch (error) { toast.error(error instanceof Error ? error.message : '任务更新失败。'); }
    finally { setSaving(false); }
  };
  const removeOrCancel = async () => {
    if (!task) return;
    setRemoving(true);
    try {
      const result = await workspaceApi.deleteOrCancelTask(task.id);
      toast.success(result.action === 'cancelled' ? '任务已取消，历史记录已保留。' : '任务已移入回收站。');
      setRemoveOpen(false); router.push('/tasks');
    } catch (error) { toast.error(error instanceof Error ? error.message : '操作失败。'); }
    finally { setRemoving(false); }
  };
  const archiveTask = async () => { if (!task) return; setArchiving(true); try { const response = await fetch(`/api/tasks/${task.id}/archive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }); const payload = await response.json() as { success?: boolean; error?: { message?: string } }; if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? '归档失败。'); setTask({ ...task, status: TaskStatus.ARCHIVED }); setArchiveOpen(false); toast.success('任务已完成并归档。'); } catch (error) { toast.error(error instanceof Error ? error.message : '归档失败。'); } finally { setArchiving(false); } };
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setUploading(true);
    const request = new XMLHttpRequest(); request.open('POST', '/api/files/upload');
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream'); request.setRequestHeader('X-File-Name', encodeURIComponent(file.name)); request.setRequestHeader('X-Task-Id', task.id);
    if (uploadTarget) request.setRequestHeader('X-Deliverable-Id', uploadTarget);
    request.onload = () => { setUploading(false); try { const payload = JSON.parse(request.responseText) as { success?: boolean; error?: { message?: string } }; if (request.status >= 200 && request.status < 300 && payload.success) toast.success(uploadTarget ? '材料已提交，等待审核。' : '任务材料已上传。'); else toast.error(payload.error?.message ?? '文件上传失败。'); } catch { toast.error('文件上传失败。'); } };
    request.onerror = () => { setUploading(false); toast.error('网络错误，文件未上传。'); }; request.send(file);
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto">
      <input ref={fileInput} type="file" className="hidden" onChange={upload} />
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
              {user && can(user, 'task:edit') && task.status !== TaskStatus.ARCHIVED && task.status !== TaskStatus.CANCELLED && (
                <button onClick={beginEdit} className="h-9 px-3 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors inline-flex items-center gap-2">
                  <Pencil className="w-4 h-4" /> 编辑任务
                </button>
              )}
              {task.status === TaskStatus.IN_PROGRESS && (
                <button onClick={() => chooseUpload()} disabled={uploading} className="h-9 px-4 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors inline-flex items-center gap-2 disabled:opacity-50">
                  <Upload className="w-4 h-4" />
                  上传材料
                </button>
              )}
              {(task.status === TaskStatus.SUBMITTED || task.status === TaskStatus.UNDER_REVIEW) && (
                <button className="h-9 px-4 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors">
                  审核
                </button>
              )}
              {user && can(user, 'task:delete') && task.status !== TaskStatus.ARCHIVED && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="h-9 w-9 rounded-lg border border-border hover:bg-muted inline-flex items-center justify-center" aria-label="更多任务操作"><MoreHorizontal className="w-4 h-4" /></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem variant="destructive" disabled={removing || task.status === TaskStatus.CANCELLED} onClick={() => setRemoveOpen(true)}><Trash2 /> {task.status === TaskStatus.CANCELLED ? '已取消' : '取消或删除任务'}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {user && ['SUPER_ADMIN', 'SECRETARY'].includes(user.role) && task.status === TaskStatus.APPROVED && (
                <button onClick={() => setArchiveOpen(true)} className="h-9 px-3 rounded-lg bg-foreground text-background text-sm font-medium inline-flex items-center gap-2"><Archive className="w-4 h-4" />完成并归档</button>
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
                        <button onClick={() => chooseUpload(del.id)} disabled={uploading} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 h-8 px-3 rounded-lg border border-border text-xs hover:bg-muted disabled:opacity-50">
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
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl" showCloseButton={!saving}>
          <DialogHeader><DialogTitle>编辑任务</DialogTitle><DialogDescription>保存后会保留已有提交、文件和审核记录；交付清单如有历史记录不可在此删除。</DialogDescription></DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <label className="block text-sm font-medium">任务名称<input required value={edit.title} onChange={(event) => setEdit({ ...edit, title: event.target.value })} className="input-field mt-1" /></label>
            <label className="block text-sm font-medium">任务说明<textarea value={edit.description} onChange={(event) => setEdit({ ...edit, description: event.target.value })} className="input-field mt-1 min-h-24 resize-y" /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">任务来源<input value={edit.source} onChange={(event) => setEdit({ ...edit, source: event.target.value })} className="input-field mt-1" /></label><label className="text-sm font-medium">优先级<select value={edit.priority} onChange={(event) => setEdit({ ...edit, priority: event.target.value as TaskPriority })} className="input-field mt-1">{Object.entries(TaskPriorityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">承办部门<select required value={edit.departmentId} onChange={(event) => setEdit({ ...edit, departmentId: event.target.value })} className="input-field mt-1"><option value="">选择部门</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label className="text-sm font-medium">负责人<select required value={edit.leaderId} onChange={(event) => setEdit({ ...edit, leaderId: event.target.value })} className="input-field mt-1"><option value="">选择负责人</option>{members.filter((member) => member.departmentId === edit.departmentId).map((member) => <option key={member.id} value={member.id}>{member.name}（{RoleLabel[member.role]}）</option>)}</select></label></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">内部截止<input type="datetime-local" value={edit.internalDeadline} onChange={(event) => setEdit({ ...edit, internalDeadline: event.target.value })} className="input-field mt-1" /></label><label className="text-sm font-medium">最终截止<input required type="datetime-local" value={edit.finalDeadline} onChange={(event) => setEdit({ ...edit, finalDeadline: event.target.value })} className="input-field mt-1" /></label></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">可见范围<select value={edit.visibility} onChange={(event) => setEdit({ ...edit, visibility: event.target.value as Visibility })} className="input-field mt-1">{Object.entries(VisibilityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-medium">标签（逗号分隔）<input value={edit.tags} onChange={(event) => setEdit({ ...edit, tags: event.target.value })} className="input-field mt-1" /></label></div>
            <DialogFooter><button type="button" disabled={saving} onClick={() => setEditOpen(false)} className="h-9 px-4 rounded-lg border border-border text-sm">取消</button><button type="submit" disabled={saving} className="h-9 px-4 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50">{saving ? '保存中…' : '保存修改'}</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent showCloseButton={!removing}>
          <DialogHeader><DialogTitle>取消或删除任务</DialogTitle><DialogDescription>没有提交、文件或审核记录的任务会移入回收站；已有工作记录的任务只会取消，全部历史将保留。</DialogDescription></DialogHeader>
          <DialogFooter><button type="button" disabled={removing} onClick={() => setRemoveOpen(false)} className="h-9 px-4 rounded-lg border border-border text-sm">返回</button><button type="button" disabled={removing} onClick={() => void removeOrCancel()} className="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-50">{removing ? '处理中…' : '确认继续'}</button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}><DialogContent showCloseButton={!archiving}><DialogHeader><DialogTitle>完成并归档</DialogTitle><DialogDescription>系统将固定保存当前已通过文件的版本号，并将任务与这些文件设为只读。不会移动任何磁盘文件。</DialogDescription></DialogHeader><DialogFooter><button type="button" disabled={archiving} onClick={() => setArchiveOpen(false)} className="h-9 px-4 rounded-lg border border-border text-sm">取消</button><button type="button" disabled={archiving} onClick={() => void archiveTask()} className="h-9 px-4 rounded-lg bg-foreground text-background text-sm">{archiving ? '归档中…' : '确认归档'}</button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function toDateTimeInput(value: string) { return new Date(value).toISOString().slice(0, 16); }

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
