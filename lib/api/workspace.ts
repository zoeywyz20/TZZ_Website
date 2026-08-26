import type { DepartmentDto, MemberDto, TaskDto } from './contracts';
import { apiClient } from './client';

export const workspaceApi = {
  departments: () => apiClient<DepartmentDto[]>('/api/departments'),
  members: () => apiClient<MemberDto[]>('/api/members'),
  tasks: (filters?: { status?: string; q?: string }) => {
    const query = new URLSearchParams();
    if (filters?.status) query.set('status', filters.status);
    if (filters?.q) query.set('q', filters.q);
    return apiClient<TaskDto[]>(`/api/tasks${query.size ? `?${query}` : ''}`);
  },
  task: (id: string) => apiClient<TaskDto>(`/api/tasks/${id}`),
  createTask: (input: unknown) => apiClient<TaskDto>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
};
