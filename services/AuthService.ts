import type { User as FbUser } from 'firebase/auth';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

// Configuração fornecida
const firebaseConfig = {
  apiKey: "AIzaSyDAXEf1OzQm53Y9075uRM8CuFIWWChDFjg",
  authDomain: "palavra-em-jogo.firebaseapp.com",
  projectId: "palavra-em-jogo",
  storageBucket: "palavra-em-jogo.firebasestorage.app",
  messagingSenderId: "53843605295",
  appId: "1:53843605295:web:4a63742e23208b4c68d3da",
  measurementId: "G-SZK07ZV52Q"
};

class FirebaseAuthService {
  private initialized = false;
  private current: FbUser | null = null;
  private ready = false;
  private listeners: ((user: FbUser | null) => void)[] = [];

  private init() {
    if (this.initialized) return;
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
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