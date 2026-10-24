import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { AppState } from 'react-native';
const readingVariations: number[] = [
  require('../assets/falas_leituras/leitura_concluida_1.mp3'),
  require('../assets/falas_leituras/leitura_concluida_2.mp3'),
  require('../assets/falas_leituras/leitura_concluida_3.mp3'),
  require('../assets/falas_leituras/leitura_concluida_4.mp3'),
  require('../assets/falas_leituras/leitura_concluida_5.mp3'),
  require('../assets/falas_leituras/leitura_concluida_6.mp3'),
  require('../assets/falas_leituras/leitura_concluida_7.mp3'),
  require('../assets/falas_leituras/leitura_concluida_8.mp3'),
  require('../assets/falas_leituras/leitura_concluida_9.mp3'),
  require('../assets/falas_leituras/leitura_concluida_10.mp3'),
];
let readingBag: number[] = [];
let previousReading: number | undefined;
function nextReading(): number {
  if (!readingBag.length) {
    readingBag = [...readingVariations];
    for (let i = readingBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [readingBag[i], readingBag[j]] = [readingBag[j], readingBag[i]];
    }
    if (readingBag[readingBag.length - 1] === previousReading) {
      [readingBag[0], readingBag[readingBag.length - 1]] = [readingBag[readingBag.length - 1], readingBag[0]];
    }
  }
  previousReading = readingBag.pop()!;
  return previousReading;
}
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
    const player = createAudioPlayer(event === 'reading' ? nextReading() : sources[event]);
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
