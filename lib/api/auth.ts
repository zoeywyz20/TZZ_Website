import type { AuthUser } from './contracts';
import { apiClient } from './client';

export const authApi = {
  login: (email: string, password: string) => apiClient<AuthUser & { requiresPasswordChange: boolean }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => apiClient<{ loggedOut: true }>('/api/auth/logout', { method: 'POST' }),
  me: () => apiClient<AuthUser>('/api/auth/me'),
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => apiClient<{ changed: true }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) }),
};
