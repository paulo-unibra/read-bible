import type { User as FbUser } from 'firebase/auth';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

// Configuração via variáveis de ambiente (.env) - usar prefixo EXPO_PUBLIC_ para exposição no bundle
// Crie um arquivo .env baseado no .env.example e preencha estes valores.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

function ensureFirebaseEnv() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    // Lançamos erro cedo para facilitar diagnóstico em desenvolvimento.
    throw new Error(
      `Firebase config incompleta. Variáveis ausentes: ${missing.join(', ')}. ` +
      'Verifique seu arquivo .env (copie de .env.example) e reinicie o Metro bundler.'
    );
  }
}

class FirebaseAuthService {
  private initialized = false;
  private current: FbUser | null = null;
  private ready = false;
  private listeners: ((user: FbUser | null) => void)[] = [];

  private init() {
    if (this.initialized) return;
    if (!firebase.apps.length) {
      ensureFirebaseEnv();
      firebase.initializeApp(firebaseConfig as any);
    }
    firebase.auth().onAuthStateChanged((user) => {
      this.current = user as FbUser | null;
      this.ready = true;
      this.listeners.forEach((l) => l(this.current));
    });
    this.initialized = true;
  }

  isReady() { return this.ready; }

  onChange(cb: (user: FbUser | null) => void) {
    this.init();
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== cb);
    };
  }

  async register(email: string, password: string) {
    this.init();
    const cred = await firebase.auth().createUserWithEmailAndPassword(email.trim(), password);
    return cred.user as FbUser;
  }

  async registerWithName(email: string, password: string, displayName: string) {
    const user = await this.register(email, password);
    try { await (user as any).updateProfile?.({ displayName }); } catch {}
    return user;
  }

  async emailExists(email: string): Promise<boolean> {
    this.init();
    try {
      const methods = await firebase.auth().fetchSignInMethodsForEmail(email.trim());
      return methods && methods.length > 0;
    } catch {
      return false; // Em caso de erro (ex: formato inválido) tratamos depois na validação de formato
    }
  }

  async login(email: string, password: string) {
    this.init();
    const cred = await firebase.auth().signInWithEmailAndPassword(email.trim(), password);
    return cred.user as FbUser;
  }

  async logout() {
    this.init();
    await firebase.auth().signOut();
  }

  getCurrentUser() { this.init(); return this.current; }
}

export default new FirebaseAuthService();