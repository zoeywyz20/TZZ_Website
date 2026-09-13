'use client';

import { motion } from 'framer-motion';
import { FolderLock } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function TemplatesPage() {
  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">模板中心</h1>
          <p className="text-sm text-muted-foreground">常用材料模板，快速开始你的工作</p>
        </motion.div>

        <motion.div variants={fadeUp} className="rounded-xl border border-border/60 bg-white px-6 py-16 text-center">
          <FolderLock className="mx-auto mb-4 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">历史模板正在由管理员核验整理</p>
          <p className="mt-2 text-sm text-muted-foreground">演示模板已移除；开放后将在这里展示经过授权的真实资料。</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
