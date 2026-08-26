'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
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
  FileText,
  User,
} from 'lucide-react';
import { tasks, profiles, departments, files } from '@/data/mock';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();

  // ⌘K keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const navigate = useCallback((path: string) => {
    onOpenChange(false);
    router.push(path);
  }, [router, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="搜索任务、文件、成员、页面…" />
      <CommandList>
        <CommandEmpty>没有找到相关结果</CommandEmpty>

        {/* Pages */}
        <CommandGroup heading="页面">
          <CommandItem onSelect={() => navigate('/dashboard')}>
            <LayoutDashboard className="mr-2 h-4 w-4 text-muted-foreground" />
            工作台
          </CommandItem>
          <CommandItem onSelect={() => navigate('/tasks/my')}>
            <CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />
            我的任务
          </CommandItem>
          <CommandItem onSelect={() => navigate('/tasks')}>
            <ListTodo className="mr-2 h-4 w-4 text-muted-foreground" />
            任务管理
          </CommandItem>
          <CommandItem onSelect={() => navigate('/files')}>
            <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
            材料中心
          </CommandItem>
          <CommandItem onSelect={() => navigate('/reviews')}>
            <ClipboardCheck className="mr-2 h-4 w-4 text-muted-foreground" />
            审核中心
          </CommandItem>
          <CommandItem onSelect={() => navigate('/calendar')}>
            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
            工作日历
          </CommandItem>
          <CommandItem onSelect={() => navigate('/templates')}>
            <FileStack className="mr-2 h-4 w-4 text-muted-foreground" />
            模板中心
          </CommandItem>
          <CommandItem onSelect={() => navigate('/departments')}>
            <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
            部门
          </CommandItem>
          <CommandItem onSelect={() => navigate('/members')}>
            <Users className="mr-2 h-4 w-4 text-muted-foreground" />
            成员
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Tasks */}
        <CommandGroup heading="任务">
          {tasks.slice(0, 5).map((task) => (
            <CommandItem key={task.id} onSelect={() => navigate(`/tasks/${task.id}`)}>
              <ListTodo className="mr-2 h-4 w-4 text-muted-foreground" />
              {task.title}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Files */}
        <CommandGroup heading="文件">
          {files.slice(0, 4).map((file) => (
            <CommandItem key={file.id} onSelect={() => navigate(`/files`)}>
              <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
              {file.originalFilename}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Members */}
        <CommandGroup heading="成员">
          {profiles.slice(0, 4).map((profile) => (
            <CommandItem key={profile.id} onSelect={() => navigate(`/members`)}>
              <User className="mr-2 h-4 w-4 text-muted-foreground" />
              {profile.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
