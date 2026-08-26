import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, differenceInDays, isPast } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, fmt: string = 'yyyy-MM-dd') {
  return format(new Date(date), fmt, { locale: zhCN });
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), 'yyyy-MM-dd HH:mm', { locale: zhCN });
}

export function formatRelativeTime(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhCN });
}

export function getDaysRemaining(deadline: string | Date): number {
  return differenceInDays(new Date(deadline), new Date());
}

export function isOverdue(deadline: string | Date): boolean {
  return isPast(new Date(deadline));
}

export function getDeadlineStatus(deadline: string | Date): {
  label: string;
  variant: 'normal' | 'warning' | 'danger';
} {
  const days = getDaysRemaining(deadline);
  if (days < 0) {
    return { label: `已逾期 ${Math.abs(days)} 天`, variant: 'danger' };
  }
  if (days === 0) {
    return { label: '今天截止', variant: 'danger' };
  }
  if (days <= 3) {
    return { label: `剩余 ${days} 天`, variant: 'warning' };
  }
  return { label: `剩余 ${days} 天`, variant: 'normal' };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.includes('word') || mimeType.includes('document')) return 'file-text';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'file-spreadsheet';
  if (mimeType.includes('pdf')) return 'file-text';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('video')) return 'video';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  return 'file';
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function getInitials(name: string): string {
  return name.slice(0, 1);
}
