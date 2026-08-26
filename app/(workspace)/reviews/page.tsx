'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { CheckCircle, XCircle, FileText, Clock, Eye, Download } from 'lucide-react';
import { cn, formatRelativeTime, formatFileSize, getInitials } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { ReviewAction } from '@/types';
import { tasks, files as allFiles, getProfileById, getDepartmentById } from '@/data/mock';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function ReviewsPage() {
  const { user } = useAuth();

  // Get deliverables pending review
  const pendingReviews = useMemo(() => {
    const items: Array<{
      taskId: string;
      taskTitle: string;
      deliverableName: string;
      departmentName: string;
      submitterName: string;
      fileName: string;
      fileSize: number;
      submittedAt: string;
      fileId: string;
    }> = [];

    tasks.forEach((task) => {
      task.deliverables.forEach((del) => {
        if (del.status === 'submitted') {
          const dept = getDepartmentById(task.departmentId);
          const assignee = del.assigneeId ? getProfileById(del.assigneeId) : null;
          const relatedFile = allFiles.find((f) => f.deliverableId === del.id);

          items.push({
            taskId: task.id,
            taskTitle: task.title,
            deliverableName: del.name,
            departmentName: dept?.shortName || '',
            submitterName: assignee?.name || '未知',
            fileName: relatedFile?.originalFilename || del.name,
            fileSize: relatedFile?.size || 0,
            submittedAt: relatedFile?.createdAt || task.updatedAt,
            fileId: relatedFile?.id || '',
          });
        }
      });
    });

    return items.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, []);

  const handleApprove = (taskTitle: string) => {
    toast.success(`已通过「${taskTitle}」`);
  };

  const handleReject = (taskTitle: string) => {
    toast.info('请填写审核意见后退回');
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1000px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        <motion.div variants={fadeUp} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold tracking-tight">审核中心</h1>
            <span className="stat-number text-sm font-medium bg-foreground text-background rounded-full w-7 h-7 flex items-center justify-center">
              {pendingReviews.length}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">待你审核的材料和任务提交</p>
        </motion.div>

        <motion.div variants={fadeUp} className="space-y-3">
          {pendingReviews.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-xl bg-muted mx-auto mb-4 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <p className="text-sm font-medium mb-1">全部审核完成</p>
              <p className="text-sm text-muted-foreground">当前没有等待审核的材料。</p>
            </div>
          ) : (
            pendingReviews.map((item, i) => (
              <div
                key={`${item.taskId}-${item.deliverableName}-${i}`}
                className="bg-white rounded-xl border border-border/60 p-5 hover:border-border transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-ocean/10 text-ocean flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <Link href={`/tasks/${item.taskId}`} className="text-sm font-medium hover:underline">
                          {item.deliverableName}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.taskTitle} · {item.departmentName}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(item.submittedAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                      <span>提交人：{item.submitterName}</span>
                      <span className="text-border">·</span>
                      <span>{item.fileName}</span>
                      {item.fileSize > 0 && (
                        <>
                          <span className="text-border">·</span>
                          <span className="font-tabular">{formatFileSize(item.fileSize)}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="h-8 px-3 rounded-lg border border-border text-xs hover:bg-muted transition-colors inline-flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> 预览
                      </button>
                      <button className="h-8 px-3 rounded-lg border border-border text-xs hover:bg-muted transition-colors inline-flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5" /> 下载
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={() => handleReject(item.deliverableName)}
                        className="h-8 px-4 rounded-lg border border-destructive/30 text-xs text-destructive hover:bg-destructive/5 transition-colors inline-flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" /> 退回修改
                      </button>
                      <button
                        onClick={() => handleApprove(item.deliverableName)}
                        className="h-8 px-4 rounded-lg bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors inline-flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> 通过
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
