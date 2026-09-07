'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { authApi } from '@/lib/api/auth';

export default function ChangePasswordPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!isLoading && !user) router.replace('/login'); }, [isLoading, user, router]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setSaving(true);
    try { await authApi.changePassword(currentPassword, newPassword, confirmPassword); await refreshUser(); router.replace('/dashboard'); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '密码修改失败。'); }
    finally { setSaving(false); }
  }
  if (isLoading || !user) return null;
  return <main className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6"><form onSubmit={submit} className="w-full max-w-md rounded-xl border border-border bg-white p-8 shadow-sm space-y-5"><div><h1 className="text-2xl font-semibold">首次登录，请设置新密码</h1><p className="mt-2 text-sm text-muted-foreground">新密码须为 8–128 位，且不能使用初始密码。</p></div><label className="block text-sm font-medium">当前密码<input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-2 h-11 w-full rounded-lg border px-3" /></label><label className="block text-sm font-medium">新密码<input required minLength={8} maxLength={128} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-2 h-11 w-full rounded-lg border px-3" /></label><label className="block text-sm font-medium">确认新密码<input required minLength={8} maxLength={128} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 h-11 w-full rounded-lg border px-3" /></label>{error && <p className="text-sm text-destructive">{error}</p>}<button disabled={saving} className="h-11 w-full rounded-lg bg-foreground text-background disabled:opacity-50">{saving ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />保存中…</span> : '保存新密码'}</button></form></main>;
}
