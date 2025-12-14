import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333';

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    token: string;
  };
  error?: any;
}

export interface ReadingPlan {
  id: number;
  name: string;
  currentDay: number;
  totalDays: number;
  chaptersPerDay: number;
  completedChapters: number;
  totalChapters: number;
  progress: number;
}

export interface TodayReading {
  day: number;
  bookName: string;
  startChapter: number;
  endChapter: number;
  isCompleted: boolean;
}

class AuthService {
  private token: string | null = null;
  private user: User | null = null;

  /**
   * Inicializar serviço carregando dados do storage
   */
  async init() {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      const userJson = await AsyncStorage.getItem('@auth_user');
      
      if (token && userJson) {
        this.token = token;
        this.user = JSON.parse(userJson);
      }
    } catch (error) {
      console.error('Erro ao inicializar auth:', error);
    }
  }

  /**
   * Registrar novo usuário
   */
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data: AuthResponse = await response.json();

      if (data.success && data.data) {
        this.token = data.data.token;
        this.user = data.data.user;
        
        await AsyncStorage.setItem('@auth_token', data.data.token);
        await AsyncStorage.setItem('@auth_user', JSON.stringify(data.data.user));
      }

      return data;
    } catch (error) {
      console.error('Erro ao registrar:', error);
      return {
        success: false,
        message: 'Erro ao conectar com o servidor',
        error,
      };
    }
  }

  /**
   * Fazer login
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data: AuthResponse = await response.json();

      if (data.success && data.data) {
        this.token = data.data.token;
        this.user = data.data.user;
        
        await AsyncStorage.setItem('@auth_token', data.data.token);
        await AsyncStorage.setItem('@auth_user', JSON.stringify(data.data.user));
      }

      return data;
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      return {
        success: false,
        message: 'Erro ao conectar com o servidor',
        error,
      };
    }
  }

  /**
   * Fazer logout
   */
  async logout(): Promise<void> {
    try {
      if (this.token) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
        });
      }
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      this.token = null;
      this.user = null;
      await AsyncStorage.removeItem('@auth_token');
      await AsyncStorage.removeItem('@auth_user');
    }
  }

  /**
   * Verificar se está autenticado
   */
  isAuthenticated(): boolean {
    return !!this.token && !!this.user;
  }

  /**
   * Obter usuário atual
   */
  getUser(): User | null {
    return this.user;
  }

  /**
   * Obter token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Criar plano de leitura
   */
  async createReadingPlan(): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/reading-plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao criar plano:', error);
      return {
        success: false,
        message: 'Erro ao conectar com o servidor',
      };
    }
  }

  /**
   * Obter plano ativo
   */
  async getActivePlan(): Promise<{ success: boolean; data: { plan: ReadingPlan; todayReading: TodayReading } | null }> {
    try {
      const response = await fetch(`${API_URL}/reading-plans/active`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar plano:', error);
      return {
        success: false,
        data: null,
      };
    }
  }

  /**
   * Completar leitura do dia
   */
  async completeDay(day: number): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/reading-plans/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ day }),
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao completar dia:', error);
      return {
        success: false,
        message: 'Erro ao conectar com o servidor',
      };
    }
  }

  /**
   * Obter histórico
   */
  async getHistory(): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/reading-plans/history`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      return {
        success: false,
        data: [],
      };
    }
  }

  /**
   * Obter histórico completo (últimas 100 leituras)
   */
  async getAllHistory(): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/reading-plans/all-history`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar histórico completo:', error);
      return {
        success: false,
        data: [],
      };
    }
  }

  /**
   * Desmarcar leitura de um dia
   */
  async unmarkDay(day: number): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/reading-plans/unmark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({ day }),
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao desmarcar dia:', error);
      return {
        success: false,
        message: 'Erro ao conectar com o servidor',
      };
    }
  }

  /**
   * Excluir plano de leitura
   */
  async deletePlan(): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/reading-plans`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao excluir plano:', error);
      return {
        success: false,
        message: 'Erro ao conectar com o servidor',
      };
    }
  }
}

export default new AuthService();
