'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Check, Clock, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { NotificationType } from '@/types';
import { getNotificationsForUser } from '@/data/mock';
import Link from 'next/link';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const typeIcons: Record<NotificationType, React.ElementType> = {
  [NotificationType.TASK_ASSIGNED]: FileText,
  [NotificationType.DEADLINE_APPROACHING]: Clock,
  [NotificationType.TASK_OVERDUE]: AlertTriangle,
  [NotificationType.SUBMISSION_RECEIVED]: FileText,
  [NotificationType.REVIEW_APPROVED]: CheckCircle2,
  [NotificationType.REVIEW_REJECTED]: AlertTriangle,
  [NotificationType.MENTION]: Bell,
  [NotificationType.SYSTEM]: Bell,
};

const typeColors: Record<NotificationType, string> = {
  [NotificationType.TASK_ASSIGNED]: 'bg-ocean/10 text-ocean',
  [NotificationType.DEADLINE_APPROACHING]: 'bg-warning/10 text-warning',
  [NotificationType.TASK_OVERDUE]: 'bg-destructive/10 text-destructive',
  [NotificationType.SUBMISSION_RECEIVED]: 'bg-blue-50 text-blue-600',
  [NotificationType.REVIEW_APPROVED]: 'bg-green-50 text-green-600',
  [NotificationType.REVIEW_REJECTED]: 'bg-red-50 text-red-600',
  [NotificationType.MENTION]: 'bg-muted text-muted-foreground',
  [NotificationType.SYSTEM]: 'bg-muted text-muted-foreground',
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const notifications = user ? getNotificationsForUser(user.id) : [];
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filtered = showUnreadOnly ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="p-6 lg:p-10 max-w-[800px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        <motion.div variants={fadeUp} className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">通知</h1>
            <p className="text-sm text-muted-foreground">
              {notifications.filter((n) => !n.isRead).length} 条未读通知
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={cn(
                'h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                showUnreadOnly ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              仅未读
            </button>
            <button className="h-8 px-3 rounded-lg border border-border text-xs hover:bg-muted transition-colors inline-flex items-center gap-1.5">
              <Check className="w-3 h-3" /> 全部已读
            </button>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-xl bg-muted mx-auto mb-4 flex items-center justify-center">
                <Bell className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">暂无通知</p>
            </div>
          ) : (
            filtered.map((notif) => {
              const Icon = typeIcons[notif.type] || Bell;
              const color = typeColors[notif.type] || 'bg-muted text-muted-foreground';

              const content = (
                <div
                  className={cn(
                    'flex items-start gap-4 p-4 rounded-xl transition-colors',
                    notif.isRead ? 'hover:bg-white' : 'bg-white border border-border/60 hover:border-border',
                  )}
                >
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn('text-sm', !notif.isRead && 'font-medium')}>{notif.title}</span>
                      {!notif.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-ocean shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{notif.message}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                      {formatRelativeTime(notif.createdAt)}
                    </p>
                  </div>
                </div>
              );

              return notif.linkTo ? (
                <Link key={notif.id} href={notif.linkTo}>{content}</Link>
              ) : (
                <div key={notif.id}>{content}</div>
              );
            })
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
