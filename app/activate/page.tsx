import Link from 'next/link';

export default function ActivatePage() {
  return <main className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-5"><section className="w-full max-w-md rounded-2xl border bg-white p-7 shadow-sm"><h1 className="text-2xl font-semibold">账号开通方式已更新</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">邮箱激活已停用。请在总书记审核通过后，使用管理员提供的账号和初始密码直接登录；首次登录时必须修改密码。</p><Link href="/login" className="mt-6 inline-flex h-11 items-center rounded-lg bg-foreground px-4 text-sm text-background">前往登录</Link></section></main>;
}
