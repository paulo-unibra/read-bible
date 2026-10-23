import authService, { API_URL } from './AuthService';
import tamagoshiService from './TamagoshiService';

export interface ReferralSummary {
  code: string;
  inviteUrl: string;
  confirmedInvites: number;
  pendingInvites: number;
  totalHealthPoints: number;
  rewardPerInvite: number;
}
class ReferralService {
  async getMine(): Promise<ReferralSummary> {
    const userId = authService.getUser()?.id;
    const token = authService.getToken();
    if (userId == null || !token) throw new Error('Entre na sua conta para convidar.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${API_URL}/referrals/me`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      const body = await response.json();
      if (!response.ok || !body.success || !body.data) throw new Error('Não foi possível consultar os convites. Tente novamente.');
      const data = body.data as ReferralSummary;
      if (!Number.isSafeInteger(data.totalHealthPoints) || data.totalHealthPoints < 0 || !/^[A-F0-9]{12}$/.test(data.code)) throw new Error('Resposta de convites inválida.');
      // A delayed response must never credit another account after logout/login.
      if (authService.getUser()?.id !== userId || authService.getToken() !== token) throw new Error('A sessão mudou. Tente novamente.');
      await tamagoshiService.applyInviteRewards(userId, data.totalHealthPoints);
      return data;
    } finally { clearTimeout(timer); }
  }
}
export default new ReferralService();
