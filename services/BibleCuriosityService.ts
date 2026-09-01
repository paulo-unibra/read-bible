import authService, { API_URL } from './AuthService';

export interface BibleCuriosity {
  id: number;
  content: string;
  theme: string | null;
  date: string;
  isFavorited: boolean;
  likesCount: number;
  sharesCount: number;
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

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('❌ [BibleCuriosityService] Erro ao buscar curiosidade:', error);
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
        console.error('❌ [BibleCuriosityService] Token não encontrado');
        return { success: false };
      }

      const url = `${API_URL}/curiosities/${curiosityId}/favorite`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('❌ [BibleCuriosityService] Resposta não OK:', response.status);
        const errorText = await response.text();
        console.error('❌ [BibleCuriosityService] Erro texto:', errorText);
        return { success: false };
      }

      // Tentar ler o corpo da resposta
      const responseText = await response.text();

      if (!responseText) {
        console.error('❌ [BibleCuriosityService] Resposta vazia');
        return { success: false };
      }

      const responseData = JSON.parse(responseText);

      return responseData;
    } catch (error) {
      console.error('❌ [BibleCuriosityService] Erro ao favoritar curiosidade:', error);
      console.error('❌ [BibleCuriosityService] Stack trace:', error instanceof Error ? error.stack : 'N/A');
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
  /**
   * Registrar compartilhamento
   */
  async registerShare(curiosityId: number): Promise<{ success: boolean; data?: { sharesCount: number } }> {
    try {
      const response = await fetch(`${API_URL}/curiosities/${curiosityId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return { success: false };
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao registrar compartilhamento:', error);
      return { success: false };
    }
  }
}

export default new BibleCuriosityService();
