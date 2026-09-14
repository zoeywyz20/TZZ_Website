import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error('DATABASE_URL is required for db:seed.');

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const departments = [
  { id: 'dept-org', name: '组织建设部', shortName: '组建部', description: '负责团组织建设、团员管理、组织关系等工作', leaderId: null },
  { id: 'dept-theory', name: '理论学习部', shortName: '理学部', description: '负责理论学习、主题团日、青年大学习等工作', leaderId: null },
  { id: 'dept-practice', name: '社会实践部', shortName: '实践部', description: '负责社会实践、志愿服务、暑期实践等工作', leaderId: null },
] as const;

async function main() {
  for (const department of departments) {
    await db.department.upsert({
      where: { id: department.id },
      update: { shortName: department.shortName, description: department.description },
      create: { id: department.id, name: department.name, shortName: department.shortName, description: department.description },
    });
  }

  for (const department of departments) {
    await db.department.update({ where: { id: department.id }, data: { leaderId: department.leaderId } });
  }
}

main()
  .then(() => console.log('Seeded departments and user profiles.'))
  .finally(async () => db.$disconnect());
