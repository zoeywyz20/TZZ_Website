import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', quiet: true });
process.env.ALLOWED_EMAIL_DOMAIN ||= 'stu.njnu.edu.cn';
process.env.INITIAL_ACCOUNT_PASSWORD ||= '123456';

async function main() {
  const { isAllowedAccountEmail, normalizeEmail, validateNewPassword } = await import('../lib/account-policy-core');
  const cases: Array<[string, boolean]> = [
    ['normalizes email', normalizeEmail('  A@STU.NJNU.EDU.CN ') === 'a@stu.njnu.edu.cn'],
    ['accepts school email', isAllowedAccountEmail('a@stu.njnu.edu.cn')],
    ['rejects non-school email', !isAllowedAccountEmail('a@example.com')],
  ];
  let rejectedInitial = false; try { validateNewPassword({ currentPassword: 'current-password', newPassword: process.env.INITIAL_ACCOUNT_PASSWORD!, confirmPassword: process.env.INITIAL_ACCOUNT_PASSWORD! }); } catch { rejectedInitial = true; }
  cases.push(['rejects initial password reuse', rejectedInitial]);
  for (const [name, pass] of cases) { if (!pass) throw new Error(`FAIL: ${name}`); console.log(`PASS: ${name}`); }
}
main();
