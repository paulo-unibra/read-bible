import authService, { API_URL } from './AuthService';

export interface BibleCuriosity {
  id: number;
  content: string;
  theme: string | null;
  date: string;
  isFavorited: boolean;
}

class BibleCuriosityService {
  /**
   * Obter curiosidade do dia
   */
  async getTodayCuriosity(): Promise<{ success: boolean; data: BibleCuriosity | null }> {
    try {
      const token = await authService.getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/curiosities/today`, {
        method: 'GET',
        headers,
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar curiosidade:', error);
      return {
        success: false,
        data: null,
      };
    }
  }

  /**
   * Favoritar/desfavoritar curiosidade
   */
  async toggleFavorite(curiosityId: number): Promise<{ success: boolean; data?: { isFavorited: boolean } }> {
    try {
      const token = await authService.getToken();
      
      if (!token) {
        return { success: false };
      }

      const response = await fetch(`${API_URL}/curiosities/${curiosityId}/favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao favoritar curiosidade:', error);
      return { success: false };
    }
  }

  /**
   * Obter curiosidades favoritas
   */
  async getFavorites(): Promise<{ success: boolean; data: BibleCuriosity[] }> {
    try {
      const token = await authService.getToken();
      
      if (!token) {
        return { success: false, data: [] };
      }

      const response = await fetch(`${API_URL}/curiosities/favorites`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar favoritos:', error);
      return { success: false, data: [] };
    }
  }
}

export default new BibleCuriosityService();
