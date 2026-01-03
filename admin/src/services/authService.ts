import api from './api';
import type { User, LoginResponse } from '../types/auth';

class AuthService {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/admin/login', {
      email,
      password,
    });
    
    // Salvar token e usuário no localStorage
    localStorage.setItem('admin_token', response.data.token);
    localStorage.setItem('admin_user', JSON.stringify(response.data.user));
    
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await api.post('/admin/logout');
    } finally {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
    }
  }

  async me(): Promise<User> {
    const response = await api.get<User>('/admin/me');
    localStorage.setItem('admin_user', JSON.stringify(response.data));
    return response.data;
  }

  getStoredUser(): User | null {
    const userStr = localStorage.getItem('admin_user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return localStorage.getItem('admin_token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  hasPermission(permission: string): boolean {
    const user = this.getStoredUser();
    return user?.permissions.includes(permission) || false;
  }

  hasAnyPermission(permissions: string[]): boolean {
    const user = this.getStoredUser();
    if (!user) return false;
    
    return permissions.some(p => user.permissions.includes(p));
  }

  hasAllPermissions(permissions: string[]): boolean {
    const user = this.getStoredUser();
    if (!user) return false;
    
    return permissions.every(p => user.permissions.includes(p));
  }
}

export default new AuthService();
