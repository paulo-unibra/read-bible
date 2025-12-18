import { API_URL } from './AuthService';

class PasswordResetService {
  /**
   * Solicitar reset de senha
   */
  async requestReset(email: string): Promise<{ success: boolean; message: string; token?: string }> {
    try {
      const response = await fetch(`${API_URL}/password/forgot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[PasswordResetService] Error requesting reset:', error);
      return {
        success: false,
        message: 'Erro ao solicitar recuperação de senha',
      };
    }
  }

  /**
   * Verificar token
   */
  async verifyToken(email: string, token: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_URL}/password/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, token }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[PasswordResetService] Error verifying token:', error);
      return {
        success: false,
        message: 'Erro ao verificar token',
      };
    }
  }

  /**
   * Redefinir senha
   */
  async resetPassword(
    email: string,
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_URL}/password/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, token, newPassword }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[PasswordResetService] Error resetting password:', error);
      return {
        success: false,
        message: 'Erro ao redefinir senha',
      };
    }
  }
}

export default new PasswordResetService();
