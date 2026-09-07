import type { DepartmentDto, MemberDto, TaskDto } from './contracts';
import { apiClient } from './client';

export const workspaceApi = {
  departments: () => apiClient<DepartmentDto[]>('/api/departments'),
  members: () => apiClient<MemberDto[]>('/api/members'),
  createMember: (input: { name: string; email: string; role: string; departmentId: string | null }) => apiClient<MemberDto>('/api/members', { method: 'POST', body: JSON.stringify(input) }),
  updateMemberAccount: (id: string, action: 'enable' | 'disable' | 'reset-password') => apiClient<{ id: string; action: string }>(`/api/members/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) }),
  tasks: (filters?: { status?: string; q?: string }) => {
    const query = new URLSearchParams();
    if (filters?.status) query.set('status', filters.status);
    if (filters?.q) query.set('q', filters.q);
    return apiClient<TaskDto[]>(`/api/tasks${query.size ? `?${query}` : ''}`);
  },
  task: (id: string) => apiClient<TaskDto>(`/api/tasks/${id}`),
  createTask: (input: unknown) => apiClient<TaskDto>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
};
