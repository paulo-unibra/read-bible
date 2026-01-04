import jsPDF from 'jspdf';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './Reports.css';

interface GeneralStats {
  users: {
    total: number;
    withActivePlan: number;
    upToDate: number;
    withCompletedPlan: number;
    withQuizResults: number;
    newInLast30Days: number;
    activeInLast7Days: number;
  };
  readingPlans: {
    total: number;
    totalCompletedDays: number;
    byType: Record<string, number>;
  };
  quizzes: {
    totalResults: number;
    averageScore: number;
  };
  generatedAt: string;
}

const Reports: React.FC = () => {
  const [stats, setStats] = useState<GeneralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  const { hasPermission, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPermission('visualizar_relatorios')) {
      navigate('/dashboard');
      return;
    }

    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.get('/admin/reports/general-stats');
      setStats(response.data);
    } catch (err: any) {
      setError('Erro ao carregar estatísticas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!stats) return;
    
    setIsExporting(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;
      
      // Título
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório Geral - Bíblia em Foco', pageWidth / 2, y, { align: 'center' });
      
      y += 15;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Gerado em: ${new Date(stats.generatedAt).toLocaleString('pt-BR')}`, pageWidth / 2, y, { align: 'center' });
      
      y += 20;
      
      // Estatísticas de Usuários
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('📊 Estatísticas de Usuários', 20, y);
      y += 10;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const userStats = [
        `Total de usuários cadastrados: ${stats.users.total}`,
        `Usuários com plano de leitura ativo: ${stats.users.withActivePlan}`,
        `Usuários com leitura em dia: ${stats.users.upToDate}`,
        `Usuários que completaram algum plano: ${stats.users.withCompletedPlan}`,
        `Usuários que responderam questionários: ${stats.users.withQuizResults}`,
        `Novos usuários (últimos 30 dias): ${stats.users.newInLast30Days}`,
        `Usuários ativos (últimos 7 dias): ${stats.users.activeInLast7Days}`,
      ];
      
      userStats.forEach(stat => {
        doc.text(stat, 25, y);
        y += 7;
      });
      
      y += 10;
      
      // Estatísticas de Planos de Leitura
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('📖 Estatísticas de Planos de Leitura', 20, y);
      y += 10;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const planStats = [
        `Total de planos criados: ${stats.readingPlans.total}`,
        `Total de dias completados: ${stats.readingPlans.totalCompletedDays}`,
      ];
      
      planStats.forEach(stat => {
        doc.text(stat, 25, y);
        y += 7;
      });
      
      // Planos por tipo
      if (Object.keys(stats.readingPlans.byType).length > 0) {
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Planos por tipo:', 25, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
        
        Object.entries(stats.readingPlans.byType).forEach(([type, count]) => {
          doc.text(`  • ${type}: ${count}`, 30, y);
          y += 7;
        });
      }
      
      y += 10;
      
      // Estatísticas de Questionários
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('📝 Estatísticas de Questionários', 20, y);
      y += 10;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const quizStats = [
        `Total de questionários respondidos: ${stats.quizzes.totalResults}`,
        `Média de acertos: ${stats.quizzes.averageScore.toFixed(2)}%`,
      ];
      
      quizStats.forEach(stat => {
        doc.text(stat, 25, y);
        y += 7;
      });
      
      // Rodapé
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('Bíblia em Foco - Sistema de Gerenciamento', pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Salvar PDF
      const fileName = `relatorio-geral-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      setError('Erro ao gerar PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div className="header-content">
          <button onClick={() => navigate('/dashboard')} className="back-button">
            ← Voltar
          </button>
          <h1>Relatórios</h1>
        </div>
        <div className="header-actions">
          <button 
            onClick={exportToPDF} 
            className="export-button"
            disabled={loading || !stats || isExporting}
          >
            {isExporting ? '📥 Gerando...' : '📥 Exportar PDF'}
          </button>
          <button onClick={handleLogout} className="logout-button">
            Sair
          </button>
        </div>
      </div>

      <div className="reports-content">
        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">Carregando estatísticas...</div>
        ) : stats ? (
          <>
            {/* Usuários */}
            <div className="stats-section">
              <h2>📊 Estatísticas de Usuários</h2>
              <div className="stats-grid">
                <div className="stat-card primary">
                  <div className="stat-value">{stats.users.total}</div>
                  <div className="stat-label">Total de Usuários</div>
                </div>
                
                <div className="stat-card success">
                  <div className="stat-value">{stats.users.withActivePlan}</div>
                  <div className="stat-label">Com Plano Ativo</div>
                  <div className="stat-percentage">
                    {calculatePercentage(stats.users.withActivePlan, stats.users.total)}% do total
                  </div>
                </div>
                
                <div className="stat-card info">
                  <div className="stat-value">{stats.users.upToDate}</div>
                  <div className="stat-label">Leitura em Dia</div>
                  <div className="stat-percentage">
                    {calculatePercentage(stats.users.upToDate, stats.users.withActivePlan)}% dos ativos
                  </div>
                </div>
                
                <div className="stat-card warning">
                  <div className="stat-value">{stats.users.withCompletedPlan}</div>
                  <div className="stat-label">Completaram Plano</div>
                  <div className="stat-percentage">
                    {calculatePercentage(stats.users.withCompletedPlan, stats.users.total)}% do total
                  </div>
                </div>

                <div className="stat-card accent">
                  <div className="stat-value">{stats.users.withQuizResults}</div>
                  <div className="stat-label">Responderam Questionários</div>
                  <div className="stat-percentage">
                    {calculatePercentage(stats.users.withQuizResults, stats.users.total)}% do total
                  </div>
                </div>

                <div className="stat-card new">
                  <div className="stat-value">{stats.users.newInLast30Days}</div>
                  <div className="stat-label">Novos (30 dias)</div>
                </div>

                <div className="stat-card active">
                  <div className="stat-value">{stats.users.activeInLast7Days}</div>
                  <div className="stat-label">Ativos (7 dias)</div>
                </div>
              </div>
            </div>

            {/* Planos de Leitura */}
            <div className="stats-section">
              <h2>📖 Estatísticas de Planos de Leitura</h2>
              <div className="stats-grid">
                <div className="stat-card primary">
                  <div className="stat-value">{stats.readingPlans.total}</div>
                  <div className="stat-label">Total de Planos Criados</div>
                </div>
                
                <div className="stat-card success">
                  <div className="stat-value">{stats.readingPlans.totalCompletedDays}</div>
                  <div className="stat-label">Dias de Leitura Completados</div>
                </div>
              </div>

              {Object.keys(stats.readingPlans.byType).length > 0 && (
                <div className="subsection">
                  <h3>Planos por Tipo</h3>
                  <div className="stats-grid">
                    {Object.entries(stats.readingPlans.byType).map(([type, count]) => (
                      <div key={type} className="stat-card secondary">
                        <div className="stat-value">{count}</div>
                        <div className="stat-label">{type}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Questionários */}
            <div className="stats-section">
              <h2>📝 Estatísticas de Questionários</h2>
              <div className="stats-grid">
                <div className="stat-card primary">
                  <div className="stat-value">{stats.quizzes.totalResults}</div>
                  <div className="stat-label">Questionários Respondidos</div>
                </div>
                
                <div className="stat-card success">
                  <div className="stat-value">{stats.quizzes.averageScore.toFixed(2)}%</div>
                  <div className="stat-label">Média de Acertos</div>
                </div>
              </div>
            </div>

            <div className="report-footer">
              <p>Relatório gerado em: {new Date(stats.generatedAt).toLocaleString('pt-BR')}</p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default Reports;
