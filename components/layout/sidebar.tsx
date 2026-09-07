'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  CheckSquare,
  ListTodo,
  FolderOpen,
  ClipboardCheck,
  Calendar,
  FileStack,
  Building2,
  Users,
  Bell,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { RoleLabel } from '@/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavLink {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavSection {
  label: string;
  items: NavLink[];
}

const navSections: NavSection[] = [
  {
    label: '工作',
    items: [
      { href: '/dashboard', label: '工作台', icon: LayoutDashboard },
      { href: '/tasks/my', label: '我的任务', icon: CheckSquare },
      { href: '/tasks', label: '任务管理', icon: ListTodo },
      { href: '/reviews', label: '审核', icon: ClipboardCheck },
      { href: '/calendar', label: '日历', icon: Calendar },
    ],
  },
  {
    label: '资料',
    items: [
      { href: '/files', label: '材料中心', icon: FolderOpen },
      { href: '/templates', label: '模板', icon: FileStack },
    ],
  },
  {
    label: '组织',
    items: [
      { href: '/departments', label: '部门', icon: Building2 },
      { href: '/members', label: '成员', icon: Users },
    ],
  },
];

const utilLinks: NavLink[] = [
  { href: '/notifications', label: '通知', icon: Bell },
  { href: '/settings', label: '设置', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, unreadCount } = useAuth();

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const renderLink = (item: NavLink) => {
    const active = isActive(item.href);
    const Icon = item.icon;

    const linkEl = (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'group flex items-center gap-3 transition-colors duration-150 relative',
          collapsed ? 'justify-center h-10 w-10 mx-auto rounded-md' : 'h-10 px-2.5 rounded-md',
          active
            ? 'text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Icon
          className={cn(
            'shrink-0 transition-colors',
            collapsed ? 'w-[17px] h-[17px]' : 'w-[16px] h-[16px]',
            active ? 'text-foreground' : 'text-muted-foreground/50'
          )}
          strokeWidth={active ? 1.8 : 1.5}
        />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="truncate text-[14px]"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>

        {item.href === '/notifications' && unreadCount > 0 && (
          <span className={cn(
            'font-tabular',
            collapsed
              ? 'absolute -top-0.5 -right-0.5 w-4 h-4 bg-foreground text-background text-[10px] font-medium rounded-full flex items-center justify-center'
              : 'ml-auto text-[12px] text-muted-foreground/50'
          )}>
            {unreadCount}
          </span>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger>{linkEl}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkEl;
  };

  return (
    <motion.aside
      className="fixed left-0 top-0 h-screen bg-white/80 backdrop-blur-sm border-r border-border/40 flex flex-col z-40"
      animate={{ width: collapsed ? 56 : 208 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      {/* Brand */}
      <div className="h-14 flex items-center px-4 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-[6px] bg-foreground flex items-center justify-center shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6">
              <path d="M2 12C2 12 5 8 12 8C19 8 22 12 22 12" />
              <path d="M2 16C2 16 5 12 12 12C19 12 22 16 22 16" />
            </svg>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap text-[14px] font-semibold tracking-tight"
              >
                海洋院团总支
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 pb-2">
        {navSections.map((section) => (
          <div key={section.label} className="mb-0.5">
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-2.5 pt-5 pb-2"
                >
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/40">
                    {section.label}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            {collapsed && <div className="h-4" />}

            <div className="space-y-[2px]">
              {section.items.map(renderLink)}
            </div>
          </div>
        ))}

        <div className="mt-1.5">
          {!collapsed && <div className="mx-2.5 my-3 border-t border-border/30" />}
          {collapsed && <div className="h-3" />}
          <div className="space-y-[2px]">
            {utilLinks.map(renderLink)}
          </div>
        </div>
      </nav>

      {/* Collapse toggle */}
      <div className="px-2.5 py-2">
        <button
          onClick={onToggle}
          className="w-full h-8 flex items-center justify-center rounded-md text-muted-foreground/30 hover:text-muted-foreground transition-colors"
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* User */}
      <div className="px-2.5 pb-3.5 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <button
              className={cn(
                'w-full flex items-center gap-2.5 rounded-md hover:bg-foreground/[0.03] transition-colors',
                collapsed ? 'justify-center p-1.5' : 'px-2.5 py-2'
              )}
            >
              <div className="w-7 h-7 rounded-full bg-foreground/8 flex items-center justify-center shrink-0 text-[12px] font-medium text-muted-foreground">
                {user ? getInitials(user.name) : '?'}
              </div>
              <AnimatePresence>
                {!collapsed && user && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-left min-w-0"
                  >
                    <div className="text-[13px] font-medium truncate leading-tight">{user.name}</div>
                    <div className="text-[11px] text-muted-foreground/40 truncate leading-tight">
                      {RoleLabel[user.role]}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-44">
            <DropdownMenuItem onClick={() => router.push('/change-password')}>修改密码</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.aside>
  );
}
