"use client";

import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function NotificationsPage() {
  return (
    <div className="p-6 lg:p-10 max-w-[800px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        <motion.div variants={fadeUp} className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">通知</h1>
            <p className="text-sm text-muted-foreground">暂无未读通知</p>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="space-y-1">
          <div className="text-center py-20">
            <div className="w-12 h-12 rounded-xl bg-muted mx-auto mb-4 flex items-center justify-center">
              <Bell className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">暂无通知</p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
