import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { AppState } from 'react-native';
const sources = {
  reading: require('../assets/falas_leituras/mais_uma_leitura_concluida.mp3'),
  caughtUp: require('../assets/falas_leituras/plano_em_dia.mp3'),
  planCreated: require('../assets/falas_leituras/plano_pronto.mp3'),
  planCompleted: require('../assets/falas_leituras/conclusao_plano.mp3'),
  quiz: require('../assets/falas_leituras/questionario_concluido.mp3'),
  invite: require('../assets/falas_leituras/convidar_alguem_para_ler_com_voce.mp3'),
};
let current: AudioPlayer | null = null;
let lastPlayed = 0;
const listeners = new Set<() => void>();
export function onReadingVoice(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export const hasRecentReadingVoice = () => Date.now() - lastPlayed < 12000;
export function playReadingVoice(event: keyof typeof sources): void {
  if (AppState.currentState !== 'active') return;
  try {
    listeners.forEach(listener => listener());
    current?.remove();
    const player = createAudioPlayer(sources[event]);
    current = player;
    lastPlayed = Date.now();
    player.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish && current === player) { current = null; player.remove(); }
    });
    player.play();
  } catch { current = null; }
}
AppState.addEventListener('change', state => {
  if (state !== 'active') { try { current?.remove(); } catch {} current = null; }
});
