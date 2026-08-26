'use client';

import { usePathname } from 'next/navigation';
import { Search, Command } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getInitials } from '@/lib/utils';

const pathLabels: Record<string, string[]> = {
  '/dashboard': ['工作台'],
  '/tasks/my': ['任务', '我的任务'],
  '/tasks/new': ['任务', '创建任务'],
  '/tasks': ['任务管理'],
  '/files': ['材料中心'],
  '/reviews': ['审核中心'],
  '/calendar': ['工作日历'],
  '/templates': ['模板中心'],
  '/departments': ['部门'],
  '/members': ['成员'],
  '/notifications': ['通知'],
  '/settings': ['系统设置'],
};

interface HeaderProps {
  onOpenSearch: () => void;
}

export function Header({ onOpenSearch }: HeaderProps) {
  const pathname = usePathname();
  const { user, unreadCount } = useAuth();

  // Build breadcrumb
  const getBreadcrumb = () => {
    if (pathLabels[pathname]) return pathLabels[pathname];
    if (pathname.startsWith('/tasks/') && pathname !== '/tasks/my' && pathname !== '/tasks/new') {
      return ['任务', '任务详情'];
    }
    if (pathname.startsWith('/departments/')) return ['部门', '部门详情'];
    if (pathname.startsWith('/files/')) return ['材料中心', '文件详情'];
    return ['工作台'];
  };

  const breadcrumb = getBreadcrumb();

  return (
    <header className="h-12 flex items-center justify-between px-6 shrink-0 sticky top-0 z-30 bg-background/80 backdrop-blur-sm">
      {/* Breadcrumb — minimal */}
      <nav className="flex items-center gap-1.5" aria-label="面包屑导航">
        {breadcrumb.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground/20 text-xs">/</span>}
            <span className={
              i === breadcrumb.length - 1
                ? 'text-[12px] text-foreground/80 font-medium'
                : 'text-[12px] text-muted-foreground/40'
            }>
              {item}
            </span>
          </span>
        ))}
      </nav>

      {/* Right — search only, minimal */}
      <button
        onClick={onOpenSearch}
        className="h-7 flex items-center gap-1.5 px-2.5 rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        aria-label="搜索"
      >
        <Search className="w-3.5 h-3.5" />
        <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/30 font-mono">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </button>
    </header>
  );
}
