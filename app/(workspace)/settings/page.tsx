'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { RoleLabel } from '@/types';
import { getInitials } from '@/lib/utils';
import { toast } from 'sonner';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function SettingsPage() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('请输入当前密码');
      return;
    }
    if (!newPassword) {
      toast.error('请输入新密码');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('新密码长度不能少于 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }

    toast.success('密码修改成功！下一次登录请使用新密码。');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsChangingPassword(false);
  };

  return (
    <div className="p-6 lg:p-10 max-w-[720px] mx-auto space-y-8">
      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }} className="space-y-8">
        <motion.div variants={fadeUp}>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">系统设置</h1>
          <p className="text-sm text-muted-foreground">管理你的个人信息、安全偏好与系统配置</p>
        </motion.div>

        {/* Profile */}
        <motion.section variants={fadeUp} className="bg-white rounded-xl border border-border/60 p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-5">个人信息</h2>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center text-lg font-semibold shrink-0">
              {user ? getInitials(user.name) : '?'}
            </div>
            <div>
              <div className="text-base font-semibold text-foreground">{user?.name}</div>
              <div className="text-xs text-muted-foreground/80 mt-0.5">{user ? RoleLabel[user.role] : ''}</div>
            </div>
          </div>

          <div className="grid gap-3">
            <SettingsRow label="电子邮箱" value={user?.email || ''} />
            <SettingsRow label="学号 / 工号" value={user?.studentId || ''} />
            <SettingsRow label="联系电话" value={user?.phone || '未设置'} />
          </div>
        </motion.section>

        {/* Security / Change Password */}
        <motion.section variants={fadeUp} className="bg-white rounded-xl border border-border/60 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">账号与安全</h2>
              <p className="text-xs text-muted-foreground mt-0.5">定期更新密码以保证账号安全</p>
            </div>
            {!isChangingPassword && (
              <button
                onClick={() => setIsChangingPassword(true)}
                className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                修改密码
              </button>
            )}
          </div>

          {isChangingPassword ? (
            <form onSubmit={handleChangePassword} className="space-y-4 pt-2 border-t border-border/40">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">当前密码</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="输入当前密码"
                  className="w-full h-9 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">新密码</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="至少 6 位新密码"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">确认新密码</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入新密码"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-foreground"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(false)}
                  className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 bg-foreground text-background rounded-lg text-xs font-medium hover:bg-foreground/90 transition-colors"
                >
                  保存新密码
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between py-2 border-t border-border/30 text-xs text-muted-foreground">
              <span>密码状态：<span className="text-success font-medium">已设置</span></span>
              <span>上次修改：30 天前</span>
            </div>
          )}
        </motion.section>

        {/* Preferences */}
        <motion.section variants={fadeUp} className="bg-white rounded-xl border border-border/60 p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-5">通知偏好</h2>
          <div className="space-y-4">
            <ToggleRow label="站内通知" description="接收任务分配、审核结果等站内通知" defaultOn />
            <ToggleRow label="邮件通知" description="重要事项通过邮件提醒" defaultOn={false} />
            <ToggleRow label="Deadline 提醒" description="截止日期前自动提醒" defaultOn />
          </div>
        </motion.section>

        {/* System */}
        <motion.section variants={fadeUp} className="bg-white rounded-xl border border-border/60 p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-5">系统信息</h2>
          <div className="grid gap-3">
            <SettingsRow label="版本" value="v1.0.0-beta" />
            <SettingsRow label="环境" value="开发模式 (Mock)" />
            <SettingsRow label="数据存储" value="本地 Storage Adapter" />
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

function ToggleRow({ label, description, defaultOn }: { label: string; description: string; defaultOn: boolean }) {
  const [enabled, setEnabled] = useState(defaultOn);
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <div>
        <div className="text-xs font-medium text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground/70 mt-0.5">{description}</div>
      </div>
      <button
        onClick={() => setEnabled(!enabled)}
        className={`w-9 h-5 rounded-full transition-colors relative ${enabled ? 'bg-foreground' : 'bg-muted'}`}
        aria-label={label}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${enabled ? 'left-4.5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
