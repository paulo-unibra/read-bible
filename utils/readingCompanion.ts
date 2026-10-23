import type { ReadingPlan, ReadingPlanDay } from '../types';
import { isReadingPlanLate } from './readingPlanStatus';

export type CompanionMood = 'curious' | 'sleepy' | 'hopeful' | 'happy' | 'joyful';
export interface CompanionQuizResult {
  createdAt: string;
  lastCompletedAt?: string;
  correctAnswers: number;
  totalQuestions: number;
}

const companions = [
  { name: 'Pipo', species: 'Gatinho', color: '#E7A34B', kind: 'cat' },
  { name: 'Lumi', species: 'Coelhinho', color: '#B3A0DE', kind: 'bunny' },
  { name: 'Nino', species: 'Ursinho', color: '#B18B70', kind: 'bear' },
  { name: 'Tito', species: 'Pintinho', color: '#E4C24E', kind: 'chick' },
] as const;

// A deterministic draw keeps the same companion on every device for this account.
export function getCompanion(userId: number) {
  let hash = 2166136261;
  for (const char of `readbible-companion-v1:${userId}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return companions[(hash >>> 0) % companions.length];
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
