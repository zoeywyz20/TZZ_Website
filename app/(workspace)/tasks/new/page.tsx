'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { TaskPriority, TaskPriorityLabel, Visibility, VisibilityLabel } from '@/types';
import type { DepartmentDto, MemberDto } from '@/lib/api/contracts';
import { workspaceApi } from '@/lib/api/workspace';
import { Separator } from '@/components/ui/separator';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

interface DeliverableForm {
  id: string;
  name: string;
  description: string;
  required: boolean;
  formats: string;
}

export default function CreateTaskPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.NORMAL);
  const [visibility, setVisibility] = useState<Visibility>(Visibility.ALL);
  const [internalDeadline, setInternalDeadline] = useState('');
  const [finalDeadline, setFinalDeadline] = useState('');
  const [deliverables, setDeliverables] = useState<DeliverableForm[]>([
    { id: '1', name: '', description: '', required: true, formats: '.docx,.pdf' },
  ]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [profiles, setProfiles] = useState<MemberDto[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([workspaceApi.departments(), workspaceApi.members()])
      .then(([departmentData, memberData]) => {
        if (!active) return;
        setDepartments(departmentData);
        setProfiles(memberData);
      })
      .catch(() => { if (active) toast.error('部门或成员加载失败，请刷新后重试。'); })
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, []);

  const addDeliverable = () => {
    setDeliverables([...deliverables, {
      id: String(Date.now()),
      name: '',
      description: '',
      required: true,
      formats: '.docx,.pdf',
    }]);
  };

  const removeDeliverable = (id: string) => {
    if (deliverables.length <= 1) return;
    setDeliverables(deliverables.filter((d) => d.id !== id));
  };

  const updateDeliverable = (id: string, field: keyof DeliverableForm, value: string | boolean) => {
    setDeliverables(deliverables.map((d) => d.id === id ? { ...d, [field]: value } : d));
  };

  const submitTask = async (status: 'DRAFT' | 'ASSIGNED') => {
    if (!title.trim()) {
      toast.error('请输入任务名称');
      return;
    }
    if (!departmentId) {
      toast.error('请选择承办部门');
      return;
    }
    if (!leaderId) {
      toast.error('请选择负责人');
      return;
    }
    if (!finalDeadline) {
      toast.error('请设置最终截止日期');
      return;
    }
    if (internalDeadline && finalDeadline && new Date(internalDeadline) >= new Date(finalDeadline)) {
      toast.error('内部截止时间必须早于最终截止时间');
      return;
    }
    setSubmitting(true);
    try {
      const task = await workspaceApi.createTask({
        title, description, source, departmentId, leaderId, priority, visibility, status,
        internalDeadline: internalDeadline ? new Date(internalDeadline).toISOString() : undefined,
        finalDeadline: new Date(finalDeadline).toISOString(),
        tags: [],
        deliverables: deliverables.filter((item) => item.name.trim()).map((item) => ({
          name: item.name, description: item.description || undefined, required: item.required,
          allowedFormats: item.formats.split(',').map((format) => format.trim()).filter(Boolean),
        })),
      });
      toast.success(status === 'DRAFT' ? '任务已保存为草稿' : '任务创建成功');
      router.push(`/tasks/${task.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '任务创建失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); void submitTask('ASSIGNED'); };

  return (
    <div className="p-6 lg:p-10 max-w-[800px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        <motion.div variants={fadeUp}>
          <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> 返回
          </Link>
        </motion.div>

        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">创建任务</h1>
        </motion.div>

        <form onSubmit={handleSubmit}>
          <motion.div variants={fadeUp} className="space-y-8">
            {/* Basic Info */}
            <section className="space-y-5">
              <FormField label="任务名称" required>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例：9月主题团日活动材料"
                  className="input-field"
                />
              </FormField>

              <FormField label="任务说明">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="描述任务的具体要求和注意事项"
                  rows={4}
                  className="input-field resize-none"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="任务来源">
                  <input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="例：校团委通知"
                    className="input-field"
                  />
                </FormField>
                <FormField label="承办部门" required>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="input-field"
                    disabled={loadingOptions}
                  >
                    <option value="">选择部门</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="负责人" required>
                  <select
                    value={leaderId}
                    onChange={(e) => setLeaderId(e.target.value)}
                    className="input-field"
                    disabled={loadingOptions}
                  >
                    <option value="">选择负责人</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="优先级">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="input-field"
                  >
                    {Object.entries(TaskPriorityLabel).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="内部截止时间">
                  <input
                    type="datetime-local"
                    value={internalDeadline}
                    onChange={(e) => setInternalDeadline(e.target.value)}
                    className="input-field"
                  />
                </FormField>
                <FormField label="最终截止时间" required>
                  <input
                    type="datetime-local"
                    value={finalDeadline}
                    onChange={(e) => setFinalDeadline(e.target.value)}
                    className="input-field"
                  />
                </FormField>
              </div>

              <FormField label="可见范围">
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Visibility)}
                  className="input-field"
                >
                  {Object.entries(VisibilityLabel).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </FormField>
            </section>

            <Separator />

            {/* Deliverables */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold">交付清单</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">定义任务需要交付的材料</p>
                </div>
                <button
                  type="button"
                  onClick={addDeliverable}
                  className="h-8 px-3 rounded-lg border border-border text-sm hover:bg-muted transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  添加
                </button>
              </div>

              <div className="space-y-3">
                {deliverables.map((del, index) => (
                  <div key={del.id} className="bg-white rounded-xl border border-border/60 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">交付项 {index + 1}</span>
                      {deliverables.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDeliverable(del.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <input
                          value={del.name}
                          onChange={(e) => updateDeliverable(del.id, 'name', e.target.value)}
                          placeholder="交付项名称，如：活动方案"
                          className="input-field"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          value={del.description}
                          onChange={(e) => updateDeliverable(del.id, 'description', e.target.value)}
                          placeholder="说明（可选）"
                          className="input-field"
                        />
                      </div>
                      <input
                        value={del.formats}
                        onChange={(e) => updateDeliverable(del.id, 'formats', e.target.value)}
                        placeholder="允许格式: .docx,.pdf"
                        className="input-field"
                      />
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={del.required}
                          onChange={(e) => updateDeliverable(del.id, 'required', e.target.checked)}
                          className="rounded border-border"
                        />
                        必须提交
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <Separator />

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="h-10 px-5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => { void submitTask('DRAFT'); }}
                disabled={submitting}
                className="h-10 px-5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                存为草稿
              </button>
              <button
                type="submit"
                disabled={submitting || loadingOptions}
                className="h-10 px-6 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors"
              >
                {submitting ? '正在提交…' : '创建并下发'}
              </button>
            </div>
          </motion.div>
        </form>
      </motion.div>

      <style jsx>{`
        .input-field {
          width: 100%;
          height: 2.5rem;
          padding: 0 0.875rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          background: white;
          font-size: 0.875rem;
          color: var(--foreground);
          transition: all 0.2s;
        }
        .input-field:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(17, 17, 17, 0.08);
          border-color: rgba(17, 17, 17, 0.15);
        }
        .input-field::placeholder {
          color: var(--muted-foreground);
          opacity: 0.5;
        }
        textarea.input-field {
          height: auto;
          padding: 0.625rem 0.875rem;
        }
      `}</style>
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
