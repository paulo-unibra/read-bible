import * as Crypto from 'expo-crypto';
import { User } from '../types';

// ID da pasta onde está o users.json informado pelo usuário
const USERS_FILE_ID = '1hZDH3zcG7DFziNMATt_3VIEp3F4WvTOs';
// O arquivo chama-se users.json e deve estar dentro desta pasta. Precisamos localizá-lo ou criá-lo.

interface UsersFileSchema {
  users: User[];
  updatedAt: string;
}

class AuthService {
  private API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
  private cache: { users: User[]; loadedAt: number } | null = null;
  private currentUser: User | null = null;

  private async fetchUsersFile(): Promise<UsersFileSchema> {
    try {
      // Lista arquivos chamados users.json na pasta
      const listUrl = `https://www.googleapis.com/drive/v3/files?q='${USERS_FILE_ID}'+in+parents+and+name='users.json'&key=${this.API_KEY}&fields=files(id,name)`;
      const listResp = await fetch(listUrl);
      if (!listResp.ok) throw new Error('Falha ao listar users.json');
      const listData = await listResp.json();
      if (!listData.files || listData.files.length === 0) {
        // Não existe ainda: retornar estrutura vazia
        return { users: [], updatedAt: new Date().toISOString() };
      }
      const fileId = listData.files[0].id;
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const resp = await fetch(downloadUrl);
      if (!resp.ok) throw new Error('Falha ao baixar users.json');
      const json = await resp.json();
      if (!json.users) return { users: [], updatedAt: new Date().toISOString() };
      return json as UsersFileSchema;
    } catch (err) {
      console.warn('AuthService.fetchUsersFile erro', err);
      return { users: [], updatedAt: new Date().toISOString() };
    }
  }

  private async persistUsers(users: User[]): Promise<void> {
    // Limitação: sem escopo oauth de escrita ou endpoint multipart, não conseguimos fazer upload direto.
    // Placeholder: Em ambiente real usar Drive API (files.update + uploadType=multipart) com credenciais OAuth.
    // Aqui apenas atualizamos cache; o usuário deverá futuramente integrar fluxo de upload.
    this.cache = { users, loadedAt: Date.now() };
    console.log('[AuthService] Persist placeholder - necessário implementar upload para salvar em Drive.');
  }

  private async ensureUsers(): Promise<User[]> {
    if (this.cache && Date.now() - this.cache.loadedAt < 60_000) {
      return this.cache.users;
    }
    const file = await this.fetchUsersFile();
    this.cache = { users: file.users, loadedAt: Date.now() };
    return file.users;
  }

  private async hashPassword(password: string): Promise<string> {
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
  }

  async register(username: string, password: string): Promise<User> {
    username = username.trim().toLowerCase();
    if (!username || !password) throw new Error('Usuário e senha obrigatórios');
    const users = await this.ensureUsers();
    if (users.some(u => u.username === username)) {
      throw new Error('Usuário já existe');
    }
    const passwordHash = await this.hashPassword(password);
    const user: User = {
      id: `u_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      username,
      passwordHash,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    const updated = [...users, user];
    await this.persistUsers(updated);
    this.currentUser = user;
    return user;
  }

  async login(username: string, password: string): Promise<User> {
    username = username.trim().toLowerCase();
    const users = await this.ensureUsers();
    const user = users.find(u => u.username === username);
    if (!user) throw new Error('Usuário não encontrado');
    const hash = await this.hashPassword(password);
    if (hash !== user.passwordHash) throw new Error('Senha inválida');
    user.lastLogin = new Date().toISOString();
    await this.persistUsers(users);
    this.currentUser = user;
    return user;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  logout() { this.currentUser = null; }
}

export default new AuthService();