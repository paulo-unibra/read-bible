import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

interface PlaybackInfo {
  bookName?: string;
  chapter?: number;
  currentTime: number; // ms
  duration: number; // ms
  isPlaying: boolean;
  loading?: boolean;
}

// Nota: Controles completos (lock screen / controles reais) exigem libs nativas específicas.
// Aqui optamos por uma notificação discreta e estável: só muda em play/pause/troca de capítulo.

class PlaybackNotificationService {
  private initialized = false;
  private currentNotificationId: string | null = null;
  private categoryRegistered = false;
  private actionHandler?: (actionId: string) => void;
  private responseListenerSet = false;

  async init() {
    if (this.initialized) return;
    // Permissões (iOS requer prompt). Android normalmente já permite.
    try {
      await Notifications.requestPermissionsAsync();
    } catch {}

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('audio-playback', {
        name: 'Reprodução de Áudio',
        importance: Notifications.AndroidImportance.LOW,
  // sound omitido para não reproduzir som
        vibrationPattern: [0],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        description: 'Status de reprodução da Bíblia em áudio'
      });
    }

    if (!this.categoryRegistered) {
      try {
        await Notifications.setNotificationCategoryAsync('audio-playback-category', [
          {
            identifier: 'PAUSE_ACTION',
            buttonTitle: 'Pausar',
            options: { isAuthenticationRequired: false, isDestructive: false },
          },
          {
            identifier: 'PLAY_ACTION',
            buttonTitle: 'Tocar',
            options: { isAuthenticationRequired: false, isDestructive: false },
          },
          {
            identifier: 'STOP_ACTION',
            buttonTitle: 'Parar',
            options: { isAuthenticationRequired: false, isDestructive: true },
          },
        ]);
        this.categoryRegistered = true;
      } catch {}
    }

    if (!this.responseListenerSet) {
      try {
        Notifications.addNotificationResponseReceivedListener((response) => {
          const action = (response as any)?.actionIdentifier;
            if (action && action !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
              this.actionHandler?.(action);
            }
        });
        this.responseListenerSet = true;
      } catch {}
    }

    this.initialized = true;
  }

  private formatTime(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  async showOrUpdate(info: PlaybackInfo) {
    await this.init();
    const { chapter, bookName, currentTime, duration, isPlaying, loading } = info;
    const progress = (duration > 0 && currentTime > 0)
      ? `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`
      : (loading ? '' : (duration > 0 ? this.formatTime(duration) : ''));
    const title = loading ? 'Carregando áudio…' : `${bookName ?? 'Livro'} ${chapter ?? ''}`.trim();
    const bodyBase = isPlaying ? 'Reproduzindo' : (loading ? 'Preparando' : 'Pausado');
    const body = progress ? `${bodyBase} • ${progress}` : bodyBase;

    const content: Notifications.NotificationContentInput = {
      title,
      body,
      sound: false,
      categoryIdentifier: 'audio-playback-category',
      data: { type: 'audio-status', chapter, bookName },
    };

    // Se existe notificação ativa, não recria desnecessariamente quando o texto não muda.
    if (this.currentNotificationId) {
      // Estratégia: como Expo não atualiza in-place, apenas recriamos quando estado principal mudou
      try { await Notifications.dismissNotificationAsync(this.currentNotificationId); } catch {}
      this.currentNotificationId = null;
    }
    try {
      this.currentNotificationId = await Notifications.scheduleNotificationAsync({ content, trigger: null });
    } catch {}
  }

  async dismiss() {
    if (this.currentNotificationId) {
      try { await Notifications.dismissNotificationAsync(this.currentNotificationId); } catch {}
      this.currentNotificationId = null;
    }
  }

  setActionHandler(handler: (actionId: string) => void) {
    this.actionHandler = handler;
  }
}

export default new PlaybackNotificationService();
