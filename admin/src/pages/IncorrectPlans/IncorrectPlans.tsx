import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import readingPlanService from '../../services/readingPlanService';
import './IncorrectPlans.css';

interface IncorrectPlan {
  planId: number;
  userId: number;
  userName: string;
  userEmail: string;
  planName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  expectedDays: number;
  actualDays: number;
  progressRecords: number;
  missingDays: number;
  chaptersPerDay: number;
  totalChapters: number;
  completedDays: number;
  completedChapters: number;
  progressPercentage: number;
  issue: string;
}

export default function IncorrectPlans() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<IncorrectPlan[]>([]);
  const [recalculating, setRecalculating] = useState<number | null>(null);

  useEffect(() => {
    loadIncorrectPlans();
  }, []);

  const loadIncorrectPlans = async () => {
    try {
      setLoading(true);
      const data = await readingPlanService.listIncorrectPlans();
      setPlans(data.plans);
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
      alert('Erro ao carregar planos incorretos');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async (planId: number, userName: string) => {
    if (!confirm(
      `Tem certeza que deseja recalcular o plano de ${userName}?\n\n` +
      `Isso irá:\n` +
      `✓ Manter todas as leituras já completadas\n` +
      `✓ Recalcular o plano até o fim do ano\n` +
      `✓ Ajustar os capítulos por dia\n` +
      `✓ Remover apenas leituras não completadas`
    )) {
      return;
    }

    try {
      setRecalculating(planId);
      const result = await readingPlanService.recalculatePlan(planId);
      
      alert(
        `✅ Plano recalculado com sucesso!\n\n` +
        `📊 Resumo das mudanças:\n` +
        `• ${result.changes.keptCompletedRecords} leituras completadas mantidas\n` +
        `• ${result.changes.deletedRecords} leituras não completadas removidas\n` +
        `• ${result.changes.newRecords} novos dias de leitura criados\n\n` +
        `📅 Novo plano:\n` +
        `• Total de dias: ${result.plan.totalDays}\n` +
        `• Capítulos por dia: ${result.plan.chaptersPerDay}\n` +
        `• Capítulos restantes: ${result.plan.remainingChapters}`
      );

      // Recarregar lista
      await loadIncorrectPlans();
    } catch (error: any) {
      console.error('Erro ao recalcular plano:', error);
      alert(`Erro ao recalcular plano: ${error.message}`);
    } finally {
      setRecalculating(null);
    }
  };

  return (
    <div className="incorrect-plans">
      <header className="incorrect-plans-header">
        <div className="header-content">
          <h1>⚠️ Planos de Leitura Incorretos</h1>
          <p className="subtitle">
            Identificar e corrigir planos com cálculo incorreto de dias
          </p>
        </div>
      </header>

      <div className="content">
        {loading && (
          <div className="loading-card">
            <div className="loading-spinner"></div>
            <p>Carregando planos...</p>
          </div>
        )}

        {!loading && plans.length === 0 && (
          <div className="empty-card">
            <div className="empty-icon">✅</div>
            <h3>Nenhum plano incorreto encontrado</h3>
            <p>Todos os planos de leitura estão com os cálculos corretos!</p>
          </div>
        )}

        {!loading && plans.length > 0 && (
          <div className="plans-card">
            <div className="card-header">
              <h2 className="card-title">
                {plans.length} {plans.length === 1 ? 'Plano Incorreto' : 'Planos Incorretos'}
              </h2>
              <p className="card-description">
                Planos com menos dias no reading_progress do que o período calculado (start_date → end_date)
              </p>
            </div>

            <div className="plans-table-container">
              <table className="plans-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Plano</th>
                    <th>Problema</th>
                    <th>Dias Esperados</th>
                    <th>Dias Criados</th>
                    <th>Faltam</th>
                    <th>Progresso</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.planId}>
                      <td>
                        <div className="user-info">
                          <div className="user-name">{plan.userName}</div>
                          <div className="user-email">{plan.userEmail}</div>
                        </div>
                      </td>
                      <td>
                        <div className="plan-info">
                          <div className="plan-name">{plan.planName}</div>
                          <div className="plan-dates">
                            {new Date(plan.startDate).toLocaleDateString('pt-BR')} até{' '}
                            {new Date(plan.endDate).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="issue-badge">{plan.issue}</span>
                      </td>
                      <td>
                        <div className="stat-value">{plan.expectedDays}</div>
                        <div className="stat-label">dias</div>
                      </td>
                      <td>
                        <div className="stat-value">{plan.actualDays}</div>
                        <div className="stat-label">dias</div>
                      </td>
                      <td>
                        <div className="stat-value highlight">{plan.missingDays}</div>
                        <div className="stat-label">dias</div>
                      </td>
                      <td>
                        <div className="progress-info">
                          <div className="progress-text">
                            {plan.completedChapters}/{plan.totalChapters} capítulos
                          </div>
                          <div className="progress-bar">
                            <div 
                              className="progress-fill" 
                              style={{ width: `${plan.progressPercentage}%` }}
                            />
                          </div>
                          <div className="progress-days">
                            {plan.completedDays} dias lidos
                          </div>
                        </div>
                      </td>
                      <td>
                        <button
                          className="recalculate-button"
                          onClick={() => handleRecalculate(plan.planId, plan.userName)}
                          disabled={recalculating === plan.planId}
                        >
                          {recalculating === plan.planId ? (
                            <>
                              <span className="spinner-small"></span>
                              Recalculando...
                            </>
                          ) : (
                            <>
                              🔧 Recalcular
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="info-box">
              <h3>ℹ️ Como funciona o recálculo?</h3>
              <ul>
                <li>✅ <strong>Mantém</strong> todas as leituras já completadas pelo usuário</li>
                <li>✅ <strong>Recalcula</strong> o plano até o fim do ano (ou próximo ano se faltar menos de 90 dias)</li>
                <li>✅ <strong>Ajusta</strong> os capítulos por dia baseado no tempo restante</li>
                <li>✅ <strong>Remove</strong> apenas leituras futuras não completadas</li>
                <li>✅ <strong>Continua</strong> de onde o usuário parou</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
