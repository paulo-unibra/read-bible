import type { AlertButton, AlertOptions } from 'react-native';

export type Feedback = { id: number; title: string; message?: string; buttons: AlertButton[]; options?: AlertOptions };
let nextId = 0;
let visible: Feedback | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
export const feedbackStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  current: () => visible,
  dismiss(id: number) {
    if (visible?.id !== id) return;
    visible = null;
    emit();
  },
};

// Same call signature as native alerts, preserving every existing action.
const AppFeedback = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    visible = { id: ++nextId, title, message, buttons: buttons ?? [], options };
    emit();
  },
};
export default AppFeedback;
