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
  { id: 'dept-org', name: '组织建设部', shortName: '组建部', description: '负责团组织建设、团员管理、组织关系等工作', leaderId: 'user-djy' },
  { id: 'dept-theory', name: '理论学习部', shortName: '理学部', description: '负责理论学习、主题团日、青年大学习等工作', leaderId: 'user-zxq' },
  { id: 'dept-practice', name: '社会实践部', shortName: '实践部', description: '负责社会实践、志愿服务、暑期实践等工作', leaderId: 'user-bjr' },
] as const;

const profiles = [
  { id: 'user-wyz', name: '吴媛智', email: 'wuyuanzhi@ocean.edu.cn', role: Role.SECRETARY, phone: '138****1234', studentId: '20260101', departmentId: null, joinedAt: new Date('2025-09-01T00:00:00Z') },
  { id: 'user-dyx', name: '丁怡萱', email: 'dingyixuan@ocean.edu.cn', role: Role.DEPUTY_SECRETARY, studentId: '20260102', departmentId: null, joinedAt: new Date('2025-09-01T00:00:00Z') },
  { id: 'user-zxq', name: '曾雪琴', email: 'zengxueqin@ocean.edu.cn', role: Role.MINISTER, studentId: '20260103', departmentId: 'dept-theory', joinedAt: new Date('2025-09-01T00:00:00Z') },
  { id: 'user-bjr', name: '鲍君睿', email: 'baojunrui@ocean.edu.cn', role: Role.MINISTER, studentId: '20260104', departmentId: 'dept-practice', joinedAt: new Date('2025-09-01T00:00:00Z') },
  { id: 'user-qhh', name: '覃欢欢', email: 'qinhuanhuan@ocean.edu.cn', role: Role.VICE_MINISTER, studentId: '20260105', departmentId: 'dept-theory', joinedAt: new Date('2025-09-01T00:00:00Z') },
  { id: 'user-djy', name: '邓陈彦', email: 'dengchenyan@ocean.edu.cn', role: Role.MINISTER, studentId: '20260106', departmentId: 'dept-org', joinedAt: new Date('2025-09-01T00:00:00Z') },
  { id: 'user-wj', name: '王娟', email: 'wangjuan@ocean.edu.cn', role: Role.MEMBER, studentId: '20260107', departmentId: 'dept-org', joinedAt: new Date('2025-09-15T00:00:00Z') },
  { id: 'user-myj', name: '马英杰', email: 'mayingjie@ocean.edu.cn', role: Role.MEMBER, studentId: '20260108', departmentId: 'dept-practice', joinedAt: new Date('2025-09-15T00:00:00Z') },
  { id: 'user-zxy', name: '赵心怡', email: 'zhaoxinyi@ocean.edu.cn', role: Role.MEMBER, studentId: '20260109', departmentId: 'dept-theory', joinedAt: new Date('2025-09-15T00:00:00Z') },
] as const;

async function main() {
  const passwordHash = await bcrypt.hash(requiredSeedPassword, 12);

  for (const department of departments) {
    await db.department.upsert({
      where: { name: department.name },
      update: { shortName: department.shortName, description: department.description },
      create: { id: department.id, name: department.name, shortName: department.shortName, description: department.description },
    });
  }

  for (const profile of profiles) {
    const { id, ...profileData } = profile;
    await db.profile.upsert({
      where: { email: profile.email },
      update: profileData,
      create: { id, ...profileData, passwordHash },
    });
  }

  for (const department of departments) {
    await db.department.update({ where: { name: department.name }, data: { leaderId: department.leaderId } });
  }
}

main()
  .then(() => console.log('Seeded departments and user profiles.'))
  .finally(async () => db.$disconnect());
