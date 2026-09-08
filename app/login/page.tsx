'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { OceanCurrentBackground } from '@/components/ui/ocean-current-background';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(user?.mustChangePassword ? '/change-password' : '/dashboard');
    }
  }, [isAuthenticated, isLoading, router, user?.mustChangePassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      router.replace(result.requiresPasswordChange ? '/change-password' : '/dashboard');
    } catch (error) {
      setError(error instanceof Error ? error.message : '登录失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex overflow-hidden">
      {/* ────────────────────────────────────────────────────
          LEFT PANEL — BRAND & OCEAN CURRENT CONTOUR LANGUAGE
      ──────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[52%] relative overflow-hidden bg-[#111111] items-center justify-between flex-col p-16">
        {/* Organic Bathymetric Ocean Current Background */}
        <OceanCurrentBackground intensity="normal" />

        {/* Top Brand Logo */}
        <div className="w-full relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border border-white/20 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <path d="M2 12C2 12 5 8 12 8C19 8 22 12 22 12" />
                <path d="M2 16C2 16 5 12 12 12C19 12 22 16 22 16" />
                <path d="M2 20C2 20 5 16 12 16C19 16 22 20 22 20" />
              </svg>
            </div>
            <span className="text-white/60 text-[13px] font-mono tracking-widest uppercase">
              OCEAN WORKSPACE
            </span>
          </div>
        </div>

        {/* Center Editorial Vision */}
        <motion.div
          className="relative z-10 w-full max-w-lg my-auto py-12"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <h1 className="text-white text-4xl lg:text-[42px] font-semibold tracking-tight mb-6 leading-tight">
            海洋院团总支
          </h1>

          {/* Vision Copy */}
          <div className="border-l-2 border-white/25 pl-6 mb-12 space-y-1">
            <p className="text-white/90 text-[19px] lg:text-[21px] font-normal leading-relaxed">
              资料跟着任务走，
            </p>
            <p className="text-white/70 text-[18px] lg:text-[20px] font-normal leading-relaxed">
              工作沉淀为组织资产。
            </p>
          </div>

          {/* Minimal Editorial Typography Accents (No cards) */}
          <div className="flex items-center gap-6 text-white/35 text-[12px] font-mono tracking-[0.18em] uppercase">
            <span>TASK</span>
            <span className="text-white/20">/</span>
            <span>FILE</span>
            <span className="text-white/20">/</span>
            <span>REVIEW</span>
            <span className="text-white/20">/</span>
            <span>ARCHIVE</span>
          </div>
        </motion.div>

        {/* Bottom Copyright */}
        <div className="w-full relative z-10 text-[11px] font-mono tracking-widest text-white/25 uppercase">
          © 2026 Ocean Youth League Workspace
        </div>
      </div>

      {/* ────────────────────────────────────────────────────
          RIGHT PANEL — FORM AREA
      ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-between px-8 sm:px-16 lg:px-20 py-12">
        <div className="w-full flex justify-end">
          {/* Subtle Mobile Brand header */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-foreground flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <path d="M2 12C2 12 5 8 12 8C19 8 22 12 22 12" />
                <path d="M2 16C2 16 5 12 12 12C19 12 22 16 22 16" />
              </svg>
            </div>
            <span className="text-xs font-semibold">海洋院团总支</span>
          </div>
        </div>

        {/* Login Form Container - Slightly elevated */}
        <motion.div
          className="w-full max-w-[480px] mx-auto -mt-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="mb-10">
            <h2 className="text-3xl lg:text-[34px] font-semibold tracking-tight text-foreground mb-3">
              欢迎回来
            </h2>
            <p className="text-[15px] text-muted-foreground leading-normal">
              登录你的团总支工作台账号
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-[15px] font-medium text-foreground block">
                学校邮箱
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="学号@njnu.edu.cn"
                className="w-full h-[50px] px-4 rounded-lg border border-border bg-white text-[15px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground focus:ring-0 transition-colors duration-200"
                required
                autoFocus
                aria-label="邮箱账号"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-[15px] font-medium text-foreground">
                  密码
                </label>
                <button
                  type="button"
                  className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  忘记密码？
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入密码"
                  className="w-full h-[50px] pl-4 pr-12 rounded-lg border border-border bg-white text-[15px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground focus:ring-0 transition-colors duration-200"
                  required
                  aria-label="登录密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[14px] text-destructive font-medium"
              >
                {error}
              </motion.p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[50px] bg-foreground text-background rounded-lg text-[15px] font-medium hover:bg-foreground/90 focus:outline-none transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  登录中…
                </>
              ) : (
                '登录'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[13px] text-muted-foreground/60">
            没有账号？<Link href="/register" className="underline hover:text-foreground">申请加入</Link>
          </p>
        </motion.div>

        {/* Empty bottom spacer for balance */}
        <div />
      </div>
    </div>
  );
}
