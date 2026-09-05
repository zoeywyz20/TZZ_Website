import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../generated/prisma/client';
import bcrypt from 'bcryptjs';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

const databaseUrl = process.env.DATABASE_URL;
const seedPassword = process.env.SEED_DEFAULT_PASSWORD;

if (!databaseUrl) throw new Error('DATABASE_URL is required for db:seed.');
if (!seedPassword) throw new Error('SEED_DEFAULT_PASSWORD is required for db:seed.');
const requiredSeedPassword: string = seedPassword;

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const departments = [
  { id: 'dept-org', name: '组织建设部', shortName: '组建部', description: '负责团组织建设、团员管理、组织关系等工作', leaderId: 'user-bjr' },
  { id: 'dept-theory', name: '理论学习部', shortName: '理学部', description: '负责理论学习、主题团日、青年大学习等工作', leaderId: 'user-dcy' },
  { id: 'dept-practice', name: '社会实践部', shortName: '实践部', description: '负责社会实践、志愿服务、暑期实践等工作', leaderId: 'user-myj' },
] as const;

// These accounts and addresses are development/test data only. Replace them with
// confirmed production accounts before the system is put into formal use.
const profiles = [
  { id: 'user-wyz', name: '吴媛智', email: 'wyz@example.local', role: Role.SECRETARY, phone: null, studentId: null, departmentId: null, joinedAt: new Date('2025-09-01T00:00:00Z') },
  { id: 'user-bjr', name: '鲍君睿', email: 'bjr@example.local', role: Role.MINISTER, phone: null, studentId: null, departmentId: 'dept-org', joinedAt: new Date('2025-09-01T00:00:00Z') },
  { id: 'user-qhh', name: '覃欢欢', email: 'qhh@example.local', role: Role.VICE_MINISTER, phone: null, studentId: null, departmentId: 'dept-org', joinedAt: new Date('2025-09-01T00:00:00Z') },
  { id: 'user-dyx', name: '丁怡萱', email: 'dyx@example.local', role: Role.DEPUTY_SECRETARY, phone: null, studentId: null, departmentId: 'dept-theory', joinedAt: new Date('2025-09-01T00:00:00Z') },
  { id: 'user-dcy', name: '邓陈彦', email: 'djy@example.local', role: Role.MINISTER, phone: null, studentId: null, departmentId: 'dept-theory', joinedAt: new Date('2025-09-01T00:00:00Z') },
  { id: 'user-wj', name: '王娟', email: 'wj@example.local', role: Role.VICE_MINISTER, phone: null, studentId: null, departmentId: 'dept-theory', joinedAt: new Date('2025-09-15T00:00:00Z') },
  { id: 'user-zxq', name: '曾雪琴', email: 'zxq@example.local', role: Role.DEPUTY_SECRETARY, phone: null, studentId: null, departmentId: 'dept-practice', joinedAt: new Date('2025-09-01T00:00:00Z') },
  { id: 'user-myj', name: '马英杰', email: 'myj@example.local', role: Role.MINISTER, phone: null, studentId: null, departmentId: 'dept-practice', joinedAt: new Date('2025-09-15T00:00:00Z') },
  { id: 'user-zxy', name: '赵心怡', email: 'zxy@example.local', role: Role.VICE_MINISTER, phone: null, studentId: null, departmentId: 'dept-practice', joinedAt: new Date('2025-09-15T00:00:00Z') },
] as const;

async function main() {
  const passwordHash = await bcrypt.hash(requiredSeedPassword, 12);

  for (const department of departments) {
    await db.department.upsert({
      where: { id: department.id },
      update: { shortName: department.shortName, description: department.description },
      create: { id: department.id, name: department.name, shortName: department.shortName, description: department.description },
    });
  }

  for (const profile of profiles) {
    const { id, ...profileData } = profile;
    await db.profile.upsert({
      where: { id: profile.id },
      update: profileData,
      create: { id, ...profileData, passwordHash },
    });
  }

  for (const department of departments) {
    await db.department.update({ where: { id: department.id }, data: { leaderId: department.leaderId } });
  }
}

main()
  .then(() => console.log('Seeded departments and user profiles.'))
  .finally(async () => db.$disconnect());
