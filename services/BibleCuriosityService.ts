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
      console.log('🔄 [BibleCuriosityService] getTodayCuriosity iniciado');
      
      const token = await authService.getToken();
      console.log('🔑 [BibleCuriosityService] Token:', token ? `${token.substring(0, 20)}...` : 'ausente');
      console.log('🔑 [BibleCuriosityService] Token completo presente:', !!token);
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('✅ [BibleCuriosityService] Header Authorization adicionado');
      } else {
        console.log('❌ [BibleCuriosityService] SEM TOKEN - requisição será anônima');
      }

      console.log('🌐 [BibleCuriosityService] URL:', `${API_URL}/curiosities/today`);

      const response = await fetch(`${API_URL}/curiosities/today`, {
        method: 'GET',
        headers,
      });

      console.log('📡 [BibleCuriosityService] Status:', response.status);
      console.log('📡 [BibleCuriosityService] OK:', response.ok);

      const result = await response.json();
      console.log('📥 [BibleCuriosityService] Resposta completa:', JSON.stringify(result, null, 2));
      
      if (result.data) {
        console.log('📊 [BibleCuriosityService] isFavorited da API:', result.data.isFavorited);
        console.log('📊 [BibleCuriosityService] likesCount da API:', result.data.likesCount);
      }
      
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
      console.log('🔄 [BibleCuriosityService] toggleFavorite iniciado');
      console.log('📋 [BibleCuriosityService] curiosityId:', curiosityId);
      
      const token = await authService.getToken();
      console.log('🔑 [BibleCuriosityService] Token obtido:', token ? `${token.substring(0, 20)}...` : 'null');
      
      if (!token) {
        console.error('❌ [BibleCuriosityService] Token não encontrado');
        return { success: false };
      }

      const url = `${API_URL}/curiosities/${curiosityId}/favorite`;
      console.log('🌐 [BibleCuriosityService] URL da requisição:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('📡 [BibleCuriosityService] Status da resposta:', response.status);
      console.log('📡 [BibleCuriosityService] Status text:', response.statusText);
      console.log('📡 [BibleCuriosityService] Response ok:', response.ok);

      // Verificar se a resposta tem conteúdo
      const contentType = response.headers.get('content-type');
      console.log('📄 [BibleCuriosityService] Content-Type:', contentType);

      if (!response.ok) {
        console.error('❌ [BibleCuriosityService] Resposta não OK:', response.status);
        const errorText = await response.text();
        console.error('❌ [BibleCuriosityService] Erro texto:', errorText);
        return { success: false };
      }

      // Tentar ler o corpo da resposta
      const responseText = await response.text();
      console.log('📥 [BibleCuriosityService] Resposta texto bruto:', responseText);

      if (!responseText) {
        console.error('❌ [BibleCuriosityService] Resposta vazia');
        return { success: false };
      }

      const responseData = JSON.parse(responseText);
      console.log('📥 [BibleCuriosityService] Dados da resposta:', JSON.stringify(responseData, null, 2));

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
