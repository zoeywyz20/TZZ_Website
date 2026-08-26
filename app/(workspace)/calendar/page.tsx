'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { tasks, getDepartmentById } from '@/data/mock';
import { TaskPriority } from '@/types';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1));
  const goToday = () => setCurrentDate(new Date());

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean }> = [];

    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Current month
    const today = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
      });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        date: new Date(year, month + 1, d),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [year, month]);

  // Map deadlines to dates
  const deadlineMap = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    tasks.forEach((task) => {
      const key = new Date(task.finalDeadline).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);

      const iKey = new Date(task.internalDeadline).toDateString();
      if (iKey !== key) {
        if (!map.has(iKey)) map.set(iKey, []);
        // Don't duplicate
      }
    });
    return map;
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-[1000px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">工作日历</h1>
          <p className="text-sm text-muted-foreground">查看任务截止日期和重要时间节点</p>
        </motion.div>

        {/* Month navigator */}
        <motion.div variants={fadeUp} className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold font-tabular">
              {year}年{month + 1}月
            </h2>
            <button
              onClick={goToday}
              className="h-7 px-3 rounded-md border border-border text-xs hover:bg-muted transition-colors"
            >
              今天
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
              aria-label="上个月"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextMonth}
              className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
              aria-label="下个月"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Calendar Grid */}
        <motion.div variants={fadeUp} className="bg-white rounded-xl border border-border/60 overflow-hidden">
          {/* Week headers */}
          <div className="grid grid-cols-7 border-b border-border/50">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-3 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, isCurrentMonth, isToday }, i) => {
              const dayTasks = deadlineMap.get(date.toDateString()) || [];

              return (
                <div
                  key={i}
                  className={cn(
                    'min-h-[100px] p-2 border-b border-r border-border/30 last:border-r-0',
                    !isCurrentMonth && 'bg-surface/50',
                    isToday && 'bg-ocean/[0.03]',
                  )}
                >
                  <span className={cn(
                    'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-tabular',
                    isToday && 'bg-foreground text-background font-medium',
                    !isCurrentMonth && 'text-muted-foreground/40',
                  )}>
                    {date.getDate()}
                  </span>

                  {/* Task deadlines */}
                  <div className="mt-1 space-y-0.5">
                    {dayTasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          'text-[10px] leading-tight px-1.5 py-1 rounded truncate cursor-pointer transition-colors',
                          task.priority === TaskPriority.URGENT && 'bg-destructive/10 text-destructive',
                          task.priority === TaskPriority.IMPORTANT && 'bg-warning/10 text-warning',
                          task.priority === TaskPriority.NORMAL && 'bg-muted text-muted-foreground hover:bg-foreground/10',
                        )}
                        title={task.title}
                      >
                        {task.title}
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-[10px] text-muted-foreground px-1.5">
                        +{dayTasks.length - 3} 更多
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
