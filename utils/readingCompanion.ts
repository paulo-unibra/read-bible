import type { ReadingPlan, ReadingPlanDay } from '../types';
import { isReadingPlanLate } from './readingPlanStatus';

export type CompanionMood = 'curious' | 'sleepy' | 'hopeful' | 'happy' | 'joyful';
export interface CompanionQuizResult {
  createdAt: string;
  lastCompletedAt?: string;
  correctAnswers: number;
  totalQuestions: number;
}

export const companions = [
  { name: 'Pipo', species: 'Gatinho', color: '#E7A34B', kind: 'cat' },
  { name: 'Lumi', species: 'Coelhinho', color: '#B3A0DE', kind: 'bunny' },
  { name: 'Nino', species: 'Ursinho', color: '#B18B70', kind: 'bear' },
  { name: 'Tito', species: 'Pintinho', color: '#E4C24E', kind: 'chick' },
  { name: 'Mimi', species: 'Gatinho', color: '#C4A0A4', kind: 'cat' },
  { name: 'Nuvem', species: 'Coelhinho', color: '#B6C8D5', kind: 'bunny' },
  { name: 'Mel', species: 'Ursinho', color: '#CCA15F', kind: 'bear' },
  { name: 'Pipoca', species: 'Pintinho', color: '#E8CE83', kind: 'chick' },
  { name: 'Rubi', species: 'Raposinha', color: '#C77665', kind: 'fox' },
  { name: 'Tico', species: 'Cachorrinho', color: '#AA9C86', kind: 'dog' },
  { name: 'Bao', species: 'Pandinha', color: '#D6CDBF', kind: 'panda' },
  { name: 'Euca', species: 'Coala', color: '#9EADA5', kind: 'koala' },
  { name: 'Kiwi', species: 'Sapinho', color: '#A7BD6D', kind: 'frog' },
  { name: 'Floe', species: 'Pinguim', color: '#8D9EA7', kind: 'penguin' },
  { name: 'Fubá', species: 'Gatinho', color: '#D6B66E', kind: 'cat' },
  { name: 'Pérola', species: 'Coelhinho', color: '#D5BAAD', kind: 'bunny' },
  { name: 'Cacau', species: 'Ursinho', color: '#927868', kind: 'bear' },
  { name: 'Sol', species: 'Pintinho', color: '#E3AB58', kind: 'chick' },
  { name: 'Maple', species: 'Raposinha', color: '#B9896E', kind: 'fox' },
  { name: 'Paçoca', species: 'Cachorrinho', color: '#C7AD85', kind: 'dog' },
  { name: 'Yuki', species: 'Pandinha', color: '#CBD7DE', kind: 'panda' },
  { name: 'Cinza', species: 'Coala', color: '#A4A4B3', kind: 'koala' },
  { name: 'Broto', species: 'Sapinho', color: '#96BC94', kind: 'frog' },
  { name: 'Polo', species: 'Pinguim', color: '#8A8FAF', kind: 'penguin' },
  { name: 'Bento', species: 'Gatinho', color: '#9BA6BC', kind: 'cat' },
  { name: 'Flora', species: 'Coelhinho', color: '#D6A3B9', kind: 'bunny' },
  { name: 'Tobias', species: 'Ursinho', color: '#B69F87', kind: 'bear' },
  { name: 'Lilo', species: 'Pintinho', color: '#C9BD69', kind: 'chick' },
  { name: 'Caju', species: 'Raposinha', color: '#DFA36A', kind: 'fox' },
  { name: 'Floquinho', species: 'Cachorrinho', color: '#C3C8CD', kind: 'dog' },
  { name: 'Kiko', species: 'Pandinha', color: '#C2D2C7', kind: 'panda' },
  { name: 'Otto', species: 'Coala', color: '#B4A799', kind: 'koala' },
  { name: 'Jade', species: 'Sapinho', color: '#7BB6A3', kind: 'frog' },
  { name: 'Neve', species: 'Pinguim', color: '#A5B8C3', kind: 'penguin' },
  { name: 'Amora', species: 'Gatinho', color: '#B69CC6', kind: 'cat' },
  { name: 'Algodão', species: 'Coelhinho', color: '#BCC8AF', kind: 'bunny' },
  { name: 'Avelã', species: 'Ursinho', color: '#BD9877', kind: 'bear' },
  { name: 'Dourado', species: 'Pintinho', color: '#D3AC3D', kind: 'chick' },
  { name: 'Aurora', species: 'Raposinha', color: '#C995A5', kind: 'fox' },
  { name: 'Bolota', species: 'Cachorrinho', color: '#B89980', kind: 'dog' },
  { name: 'Mei', species: 'Pandinha', color: '#D7C8D3', kind: 'panda' },
  { name: 'Kiara', species: 'Coala', color: '#B8A1AF', kind: 'koala' },
  { name: 'Trevo', species: 'Sapinho', color: '#9FAE65', kind: 'frog' },
  { name: 'Nalu', species: 'Pinguim', color: '#7DADA9', kind: 'penguin' },
  { name: 'Faísca', species: 'Raposinha', color: '#DA8B5C', kind: 'fox' },
  { name: 'Biscoito', species: 'Cachorrinho', color: '#C7A47E', kind: 'dog' },
  { name: 'Bambu', species: 'Pandinha', color: '#D8DCCF', kind: 'panda' },
  { name: 'Koda', species: 'Coala', color: '#9EA8B1', kind: 'koala' },
  { name: 'Zeca', species: 'Sapinho', color: '#8EB573', kind: 'frog' },
  { name: 'Pingo', species: 'Pinguim', color: '#7994AD', kind: 'penguin' },
] as const;

// Catalog version 1 preserves the original four appearances for existing pets.
export function getCompanion(seed: number, catalogVersion: 1 | 2 = 2) {
  let hash = 2166136261;
  for (const char of `readbible-companion-v1:${seed}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return companions[(hash >>> 0) % (catalogVersion === 1 ? 4 : companions.length)];
}

export function getCompanionState(
  plan: ReadingPlan | null,
  days: ReadingPlanDay[],
  results: CompanionQuizResult[] | null,
  now = new Date(),
) {
  const cutoff = now.getTime() - 7 * 86400000;
  const recent = (results ?? []).filter((result) => {
    const time = Date.parse(result.lastCompletedAt ?? result.createdAt);
    return time >= cutoff && time <= now.getTime() && result.totalQuestions > 0;
  });
  const questions = recent.reduce((sum, result) => sum + result.totalQuestions, 0);
  const correct = recent.reduce((sum, result) => sum + result.correctAnswers, 0);
  const accuracy = questions ? Math.round(correct / questions * 100) : 0;
  const quizText = results === null ? 'Questionários indisponíveis no momento'
    : recent.length ? `${recent.length} ${recent.length === 1 ? 'questionário' : 'questionários'} em 7 dias · ${accuracy}% de acertos`
      : 'Nenhum questionário nos últimos 7 dias';
  const late = plan ? isReadingPlanLate(plan, days, now) : false;
  let mood: CompanionMood;
  let message: string;
  let label: string;
  if (!plan) {
    mood = recent.length ? 'happy' : 'curious';
    label = recent.length ? 'Animado' : 'Curioso';
    message = recent.length ? 'Gostei de aprender com você! Vamos começar um plano?' : 'Vamos descobrir uma história juntos? Comece seu plano.';
  } else if (late) {
    mood = recent.length ? 'hopeful' : 'sleepy';
    label = recent.length ? 'Esperançoso' : 'Com saudade';
    message = recent.length ? 'Os questionários me animaram! Vamos retomar a leitura também?' : 'Senti falta da nossa leitura. Um capítulo já é um recomeço!';
  } else if (plan.isCompleted || (recent.length > 0 && accuracy >= 80)) {
    mood = 'joyful';
    label = 'Radiante';
    message = plan.isCompleted ? 'Você concluiu seu plano! Que jornada bonita juntos!' : 'Leitura em dia e tantos aprendizados. Estamos indo muito bem!';
  } else {
    mood = 'happy';
    label = 'Feliz';
    message = recent.length ? 'Cada resposta é uma chance de aprender. Continue assim!' : 'Nossa leitura está em dia! Que tal um questionário depois?';
  }
  return { mood, label, message, quizText,
    planText: !plan ? 'Sem plano ativo' : late ? 'Plano atrasado' : plan.isCompleted ? 'Plano concluído' : 'Plano em dia' };
}
