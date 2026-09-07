import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', quiet: true });
process.env.SCHOOL_EMAIL_DOMAIN ||= 'njnu.edu.cn';
process.env.INITIAL_ACCOUNT_PASSWORD ||= '123456';
async function main() {
  const { normalizeStudentId, schoolEmailForStudentId } = await import('../lib/account-policy-core');
  const valid = normalizeStudentId(' 2024abc ') === '2024abc' && schoolEmailForStudentId('2024abc') === '2024abc@njnu.edu.cn';
  if (!valid) throw new Error('FAIL: studentId-to-email'); console.log('PASS: studentId-to-email');
  for (const value of ['a@b', 'a b', 'a\nb', '../a', '']) { let rejected = false; try { normalizeStudentId(value); } catch { rejected = true; } if (!rejected) throw new Error(`FAIL: rejected studentId ${JSON.stringify(value)}`); }
  console.log('PASS: rejects illegal studentId characters');
}
main();
