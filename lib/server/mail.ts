import 'server-only';
import nodemailer from 'nodemailer';

export class MailDeliveryError extends Error {}
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!);
function config() {
  const port = Number(process.env.SMTP_PORT);
  const host = process.env.SMTP_HOST?.trim(); const user = process.env.SMTP_USER?.trim(); const password = process.env.SMTP_PASSWORD; const from = process.env.SMTP_FROM?.trim();
  if (!host || !Number.isInteger(port) || port <= 0 || !user || !password || !from) throw new MailDeliveryError('邮件服务暂不可用，请稍后重试。');
  return { host, port, secure: process.env.SMTP_SECURE === 'true', auth: { user, pass: password }, from };
}
async function send(to: string, subject: string, text: string, html: string) {
  const options = config();
  try { await nodemailer.createTransport(options).sendMail({ from: options.from, to, subject, text, html }); }
  catch { throw new MailDeliveryError('邮件发送失败，请稍后重试。'); }
}
export function sendVerificationCode(to: string, code: string) { return send(to, '团总支工作台邮箱验证', `你正在申请加入海洋科学与工程学院团总支工作台。\n\n验证码：${code}\n有效期：10 分钟。\n\n如果不是你本人操作，请忽略。`, `<p>你正在申请加入海洋科学与工程学院团总支工作台。</p><p>验证码：<strong>${code}</strong></p><p>有效期：10 分钟。</p><p>如果不是你本人操作，请忽略。</p>`); }
export function sendApplicationApproved(input: { to: string; name: string; email: string; department: string; role: string; activationUrl: string }) { const name = escapeHtml(input.name); const email = escapeHtml(input.email); const department = escapeHtml(input.department); const role = escapeHtml(input.role); return send(input.to, '团总支工作台申请已通过', `${input.name}，你的申请已通过。\n账号：${input.email}\n部门：${input.department}\n身份：${input.role}\n请在 24 小时内设置密码并激活账号：${input.activationUrl}`, `<p>${name}，你的申请已通过。</p><p>账号：${email}<br/>部门：${department}<br/>身份：${role}</p><p><a href="${input.activationUrl}">设置密码并激活账号</a></p><p>链接有效期为 24 小时。</p>`); }
export function sendApplicationRejected(input: { to: string; name: string; note?: string | null }) { return send(input.to, '团总支工作台申请结果', `${input.name}，你的申请未通过。${input.note ? `\n说明：${input.note}` : ''}`, `<p>${escapeHtml(input.name)}，你的申请未通过。</p>${input.note ? `<p>说明：${escapeHtml(input.note)}</p>` : ''}`); }
