import { z } from 'zod';

const dateString = z.string().datetime({ offset: true });

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000).optional(),
  source: z.string().trim().max(500).optional(),
  departmentId: z.string().uuid().or(z.string().min(1).max(100)),
  leaderId: z.string().uuid().or(z.string().min(1).max(100)),
  priority: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']).default('NORMAL'),
  visibility: z.enum(['ALL', 'DEPARTMENT', 'SPECIFIED']).default('ALL'),
  internalDeadline: dateString.optional(),
  finalDeadline: dateString,
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  status: z.enum(['DRAFT', 'ASSIGNED']).default('ASSIGNED'),
  deliverables: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).optional(),
    required: z.boolean().default(true),
    allowedFormats: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  })).max(30).default([]),
}).superRefine((value, ctx) => {
  if (value.internalDeadline && new Date(value.internalDeadline) > new Date(value.finalDeadline)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['internalDeadline'], message: '内部截止时间不能晚于最终截止时间。' });
  }
});
