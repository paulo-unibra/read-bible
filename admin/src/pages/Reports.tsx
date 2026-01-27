import jsPDF from "jspdf";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import "./Reports.css";

interface GeneralStats {
  users: {
    total: number;
    withActivePlan: number;
    upToDate: number;
    withCompletedPlan: number;
    withQuizResults: number;
    newInLast30Days: number;
    activeInLast7Days: number;
    notStartedReading: number;
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

interface PlayStoreStats {
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  installs: {
    totals: {
      installs: number;
      uninstalls: number;
      updates: number;
      installEvents: number;
    };
    timeline: Array<{
      date: string;
      installs: number;
      uninstalls: number;
      updates: number;
      installEvents: number;
    }>;
  };
  crashes: {
    averages: {
      crashRate: number;
      crashRatePerUserPercent: number;
    };
    totals: {
      distinctCrashes: number;
    };
    timeline: Array<{
      date: string;
      crashRate: number;
      crashRatePerUserPercent: number;
      distinctCrashes: number;
    }>;
  };
  anrs: {
    averages: {
      anrRate: number;
      anrRatePerUserPercent: number;
    };
    totals: {
      distinctAnrs: number;
    };
    timeline: Array<{
      date: string;
      anrRate: number;
      anrRatePerUserPercent: number;
      distinctAnrs: number;
    }>;
  };
  generatedAt: string;
}

const Reports: React.FC = () => {
  const [stats, setStats] = useState<GeneralStats | null>(null);
  const [playStoreStats, setPlayStoreStats] = useState<PlayStoreStats | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadingPlayStore, setLoadingPlayStore] = useState(false);
  const [error, setError] = useState("");
  const [_playStoreError, setPlayStoreError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [playStoreDays, setPlayStoreDays] = useState(7);
  const [appDownloads, setAppDownloads] = useState(0);

  // Estado para controlar quais seções incluir no relatório
  const [reportSections, setReportSections] = useState(() => {
    const saved = localStorage.getItem("reportSections");
    return saved
      ? JSON.parse(saved)
      : {
          users: true,
          readingPlans: true,
          quizzes: true,
          playStore: true,
        };
  });

  // Estado para controlar quais cards individuais incluir
  const [selectedCards, setSelectedCards] = useState(() => {
    const saved = localStorage.getItem("selectedCards");
    return saved
      ? JSON.parse(saved)
      : {
          // Usuários
          totalUsers: true,
          withActivePlan: true,
          upToDate: true,
          withCompletedPlan: true,
          withQuizResults: true,
          newUsers: true,
          activeUsers: true,
          notStarted: true,
          downloads: true,
          // Planos
          totalPlans: true,
          completedDays: true,
          plansByType: true,
          // Quizzes
          totalQuizResults: true,
          averageScore: true,
        };
  });

  const { hasPermission, logout } = useAuth();
  const navigate = useNavigate();

  // Salvar reportSections no localStorage quando mudar
  useEffect(() => {
    localStorage.setItem("reportSections", JSON.stringify(reportSections));
  }, [reportSections]);

  // Salvar selectedCards no localStorage quando mudar
  useEffect(() => {
    localStorage.setItem("selectedCards", JSON.stringify(selectedCards));
  }, [selectedCards]);

  useEffect(() => {
    if (!hasPermission("visualizar_relatorios")) {
      navigate("/dashboard");
      return;
    }

    loadStats();
    loadPlayStoreStats();
    loadAppDownloads();
  }, []);

  const loadAppDownloads = async () => {
    try {
      const response = await api.get("/admin/reports/app-downloads");
      setAppDownloads(response.data.downloads || 0);
    } catch (err) {
      console.error("Erro ao carregar downloads:", err);
    }
  };

  const saveAppDownloads = async (value: number) => {
    try {
      await api.put("/admin/reports/app-downloads", { downloads: value });
    } catch (err: any) {
      alert(
        "Erro ao salvar downloads: " +
          (err.response?.data?.error || err.message),
      );
    }
  };

  const loadStats = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/reports/general-stats");
      setStats(response.data);
    } catch (err: any) {
      setError("Erro ao carregar estatísticas");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadPlayStoreStats = async (days: number = 30) => {
    setLoadingPlayStore(true);
    setPlayStoreError("");

    try {
      const response = await api.get(
        `/admin/reports/play-store/general?days=${days}`,
      );
      setPlayStoreStats(response.data.data);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        "Erro ao carregar estatísticas do Play Store";
      setPlayStoreError(errorMessage);
      console.error(err);
    } finally {
      setLoadingPlayStore(false);
    }
  };

  const handlePlayStoreDaysChange = (days: number) => {
    setPlayStoreDays(days);
    loadPlayStoreStats(days);
  };

  const exportToPDF = async () => {
    if (!stats) return;

    setIsExporting(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = 15;

      // Cores do tema
      const primaryColor = [14, 52, 112]; // #4d6effff
      const darkGray = [51, 51, 51];
      const lightGray = [128, 128, 128];
      const bgLight = [245, 247, 250];

      // Função para desenhar caixa com borda arredondada
      const drawBox = (
        x: number,
        y: number,
        width: number,
        height: number,
        bgColor: number[],
        borderColor?: number[],
      ) => {
        doc.setFillColor(...(bgColor as [number, number, number]));
        if (borderColor) {
          doc.setDrawColor(...(borderColor as [number, number, number]));
          doc.setLineWidth(0.5);
        }
        doc.roundedRect(x, y, width, height, 2, 2, borderColor ? "FD" : "F");
      };

      // Logo centralizada acima do cabeçalho
      try {
        const logoImg = await fetch("/src/assets/logo-report.png");
        const logoBlob = await logoImg.blob();
        const logoDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        // Logo centralizada (30x30)
        const logoSize = 30;
        const logoX = (pageWidth - logoSize) / 2;
        doc.addImage(logoDataUrl, "PNG", logoX, y, logoSize, logoSize);
        y += logoSize + 5; // Espaço após a logo
      } catch {
        // Se não conseguir carregar a logo, continua sem ela
      }

      // Cabeçalho - Igreja
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...(darkGray as [number, number, number]));
      doc.text("IGREJA EVANGÉLICA ASSEMBLEIA DE DEUS", pageWidth / 2, y, {
        align: "center",
      });

      y += 7;

      doc.setFontSize(12);
      doc.setTextColor(...(primaryColor as [number, number, number]));
      doc.text("BÍBLIA EM FOCO – RELATÓRIO DE ATIVIDADES", pageWidth / 2, y, {
        align: "center",
      });

      y += 5;

      // Linha separadora
      doc.setDrawColor(...(primaryColor as [number, number, number]));
      doc.setLineWidth(1);
      doc.line(15, y, pageWidth - 15, y);

      y += 5;

      // Caixa de informações da equipe
      drawBox(15, y, pageWidth - 30, 35, [248, 250, 252], primaryColor);

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...(darkGray as [number, number, number]));
      doc.text("Equipe IEADPE – Área 10", 20, y + 7);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Pastor Setorial:", 20, y + 15);
      doc.setFont("helvetica", "bold");
      doc.text("Pr. Paulo Cristóvão", 60, y + 15);

      doc.setFont("helvetica", "normal");
      doc.text("Coordenação da Área 10:", 20, y + 22);
      doc.setFont("helvetica", "bold");
      doc.text("Pb. Waldomiro Farias", 60, y + 22);

      doc.setFont("helvetica", "italic");
      doc.setTextColor(...(lightGray as [number, number, number]));
      doc.setFontSize(8);
      doc.text(
        `Gerado em: ${new Date(stats.generatedAt).toLocaleString("pt-BR")}`,
        20,
        y + 30,
      );

      y += 40;

      // Função para desenhar bloco de estatísticas
      const drawStatsBlock = (
        title: string,
        _icon: string,
        items: Array<{
          label: string;
          value: string | number;
          highlight?: boolean;
        }>,
      ) => {
        // Cabeçalho do bloco
        drawBox(15, y, pageWidth - 30, 10, primaryColor);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        // Usar símbolos simples ao invés de emojis
        doc.text(title, 20, y + 7);

        y += 12;

        // Corpo do bloco
        const blockHeight = items.length * 8 + 8;
        drawBox(15, y, pageWidth - 30, blockHeight, bgLight, [220, 220, 220]);

        y += 6;

        items.forEach((item, _index) => {
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...(darkGray as [number, number, number]));
          doc.text(item.label + ":", 20, y);

          doc.setFont("helvetica", "bold");
          if (item.highlight) {
            doc.setTextColor(...(primaryColor as [number, number, number]));
          } else {
            doc.setTextColor(...(darkGray as [number, number, number]));
          }
          doc.text(String(item.value), pageWidth - 20, y, { align: "right" });

          y += 8;
        });

        y += 4;
      };

      // Estatísticas de Usuários
      if (reportSections.users) {
        const userItems: Array<{
          label: string;
          value: string | number;
          highlight?: boolean;
        }> = [];

        if (selectedCards.downloads && appDownloads > 0) {
          userItems.push({
            label: "Downloads do aplicativo",
            value: appDownloads,
            highlight: true,
          });
        }

        if (selectedCards.totalUsers) {
          userItems.push({
            label: "Total de usuários cadastrados",
            value: stats.users.total,
            highlight: true,
          });
        }

        if (selectedCards.withActivePlan) {
          userItems.push({
            label: "Usuários com plano ativo",
            value: stats.users.withActivePlan,
          });
        }

        if (selectedCards.upToDate) {
          userItems.push({
            label: "Usuários com leitura em dia",
            value: stats.users.upToDate,
          });
        }

        if (selectedCards.withCompletedPlan) {
          userItems.push({
            label: "Usuários que completaram planos",
            value: stats.users.withCompletedPlan,
          });
        }

        if (selectedCards.withQuizResults) {
          userItems.push({
            label: "Usuários com questionários respondidos",
            value: stats.users.withQuizResults,
          });
        }

        if (selectedCards.newUsers) {
          userItems.push({
            label: "Novos usuários (30 dias)",
            value: stats.users.newInLast30Days,
            highlight: true,
          });
        }

        if (selectedCards.activeUsers) {
          userItems.push({
            label: "Usuários ativos (7 dias)",
            value: stats.users.activeInLast7Days,
            highlight: true,
          });
        }

        if (selectedCards.notStarted) {
          userItems.push({
            label: "Ainda não iniciaram a leitura",
            value: stats.users.notStartedReading,
          });
        }

        if (userItems.length > 0) {
          drawStatsBlock("Estatísticas de Usuários", "👥", userItems);
        }
      }

      // Estatísticas de Planos de Leitura
      if (reportSections.readingPlans) {
        const planItems: Array<{
          label: string;
          value: string | number;
          highlight?: boolean;
        }> = [];

        if (selectedCards.totalPlans) {
          planItems.push({
            label: "Total de planos criados",
            value: stats.readingPlans.total,
            highlight: true,
          });
        }

        if (selectedCards.completedDays) {
          planItems.push({
            label: "Total de dias completados",
            value: stats.readingPlans.totalCompletedDays,
          });
        }

        // Adicionar planos por tipo
        if (
          selectedCards.plansByType &&
          Object.keys(stats.readingPlans.byType).length > 0
        ) {
          Object.entries(stats.readingPlans.byType).forEach(([type, count]) => {
            const typeName =
              type === "yearly" ? "Plano de Leitura Anual" : type;
            planItems.push({ label: `  ${typeName}`, value: count });
          });
        }

        if (planItems.length > 0) {
          drawStatsBlock("Planos de Leitura", "📖", planItems);
        }
      }

      // Estatísticas de Questionários
      if (reportSections.quizzes) {
        const quizItems: Array<{
          label: string;
          value: string | number;
          highlight?: boolean;
        }> = [];

        if (selectedCards.totalQuizResults) {
          quizItems.push({
            label: "Total de questionários respondidos",
            value: stats.quizzes.totalResults,
            highlight: true,
          });
        }

        if (selectedCards.averageScore) {
          quizItems.push({
            label: "Média de acertos",
            value: `${stats.quizzes.averageScore.toFixed(2)}%`,
            highlight: true,
          });
        }

        if (quizItems.length > 0) {
          drawStatsBlock("Questionários", "📝", quizItems);
        }
      }

      // Rodapé
      doc.setDrawColor(...(primaryColor as [number, number, number]));
      doc.setLineWidth(0.5);
      doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);

      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...(lightGray as [number, number, number]));
      doc.text(
        "Bíblia em Foco - Sistema de Gerenciamento",
        pageWidth / 2,
        pageHeight - 12,
        { align: "center" },
      );
      doc.text("© 2026 IEADPE - Área 10", pageWidth / 2, pageHeight - 7, {
        align: "center",
      });

      // Salvar PDF
      const fileName = `relatorio-biblia-foco-${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      setError("Erro ao gerar PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  return (
    <>
      <Sidebar />
      <div className="reports-page">
        <div className="reports-header">
          <div className="header-content">
            <button
              onClick={() => navigate("/dashboard")}
              className="back-button"
            >
              ← Voltar
            </button>
            <h1>Relatórios</h1>
          </div>
          <div className="header-actions">
            {/* Checkboxes para selecionar seções do relatório */}
            <div className="report-sections-selector">
              <label className="section-checkbox">
                <input
                  type="checkbox"
                  checked={reportSections.users}
                  onChange={(e) =>
                    setReportSections({
                      ...reportSections,
                      users: e.target.checked,
                    })
                  }
                />
                <span>Usuários</span>
              </label>
              <label className="section-checkbox">
                <input
                  type="checkbox"
                  checked={reportSections.readingPlans}
                  onChange={(e) =>
                    setReportSections({
                      ...reportSections,
                      readingPlans: e.target.checked,
                    })
                  }
                />
                <span>Planos</span>
              </label>
              <label className="section-checkbox">
                <input
                  type="checkbox"
                  checked={reportSections.quizzes}
                  onChange={(e) =>
                    setReportSections({
                      ...reportSections,
                      quizzes: e.target.checked,
                    })
                  }
                />
                <span>Quizzes</span>
              </label>
              <label className="section-checkbox">
                <input
                  type="checkbox"
                  checked={reportSections.playStore}
                  onChange={(e) =>
                    setReportSections({
                      ...reportSections,
                      playStore: e.target.checked,
                    })
                  }
                />
                <span>Play Store</span>
              </label>
            </div>
            <button
              onClick={exportToPDF}
              className="export-button"
              disabled={loading || !stats || isExporting}
            >
              {isExporting ? "📥 Gerando..." : "📥 Exportar PDF"}
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
                    <label className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCards.totalUsers}
                        onChange={(e) =>
                          setSelectedCards({
                            ...selectedCards,
                            totalUsers: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div className="stat-value">{stats.users.total}</div>
                    <div className="stat-label">Total de Usuários</div>
                  </div>

                  <div className="stat-card success">
                    <label className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCards.withActivePlan}
                        onChange={(e) =>
                          setSelectedCards({
                            ...selectedCards,
                            withActivePlan: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div className="stat-value">
                      {stats.users.withActivePlan}
                    </div>
                    <div className="stat-label">Com Plano Ativo</div>
                    <div className="stat-percentage">
                      {calculatePercentage(
                        stats.users.withActivePlan,
                        stats.users.total,
                      )}
                      % do total
                    </div>
                  </div>

                  <div className="stat-card info">
                    <label className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCards.upToDate}
                        onChange={(e) =>
                          setSelectedCards({
                            ...selectedCards,
                            upToDate: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div className="stat-value">{stats.users.upToDate}</div>
                    <div className="stat-label">Leitura em Dia</div>
                    <div className="stat-percentage">
                      {calculatePercentage(
                        stats.users.upToDate,
                        stats.users.withActivePlan,
                      )}
                      % dos ativos
                    </div>
                  </div>

                  <div className="stat-card warning">
                    <label className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCards.withCompletedPlan}
                        onChange={(e) =>
                          setSelectedCards({
                            ...selectedCards,
                            withCompletedPlan: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div className="stat-value">
                      {stats.users.withCompletedPlan}
                    </div>
                    <div className="stat-label">Completaram Plano</div>
                    <div className="stat-percentage">
                      {calculatePercentage(
                        stats.users.withCompletedPlan,
                        stats.users.total,
                      )}
                      % do total
                    </div>
                  </div>

                  <div className="stat-card accent">
                    <label className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCards.withQuizResults}
                        onChange={(e) =>
                          setSelectedCards({
                            ...selectedCards,
                            withQuizResults: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div className="stat-value">
                      {stats.users.withQuizResults}
                    </div>
                    <div className="stat-label">Responderam Questionários</div>
                    <div className="stat-percentage">
                      {calculatePercentage(
                        stats.users.withQuizResults,
                        stats.users.total,
                      )}
                      % do total
                    </div>
                  </div>

                  <div className="stat-card new">
                    <label className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCards.newUsers}
                        onChange={(e) =>
                          setSelectedCards({
                            ...selectedCards,
                            newUsers: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div className="stat-value">
                      {stats.users.newInLast30Days}
                    </div>
                    <div className="stat-label">Novos (30 dias)</div>
                  </div>

                  <div className="stat-card active">
                    <label className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCards.activeUsers}
                        onChange={(e) =>
                          setSelectedCards({
                            ...selectedCards,
                            activeUsers: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div className="stat-value">
                      {stats.users.activeInLast7Days}
                    </div>
                    <div className="stat-label">Ativos (7 dias)</div>
                  </div>

                  <div
                    className="stat-card"
                    style={{
                      backgroundColor: "#f8d7da",
                      borderColor: "#f5c6cb",
                    }}
                  >
                    <label className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCards.notStarted}
                        onChange={(e) =>
                          setSelectedCards({
                            ...selectedCards,
                            notStarted: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div className="stat-value">
                      {stats.users.notStartedReading}
                    </div>
                    <div className="stat-label">
                      Ainda não iniciaram a leitura
                    </div>
                    <div className="stat-percentage">
                      {calculatePercentage(
                        stats.users.notStartedReading,
                        stats.users.withActivePlan,
                      )}
                      % dos planos ativos
                    </div>
                  </div>

                  <div
                    className="stat-card"
                    style={{
                      backgroundColor: "#e3f2fd",
                      borderColor: "#90caf9",
                    }}
                  >
                    <label className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCards.downloads}
                        onChange={(e) =>
                          setSelectedCards({
                            ...selectedCards,
                            downloads: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div
                      className="stat-value"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <input
                        type="number"
                        value={appDownloads}
                        onChange={(e) =>
                          setAppDownloads(Number(e.target.value))
                        }
                        onBlur={(e) => saveAppDownloads(Number(e.target.value))}
                        className="downloads-input"
                        min="0"
                        placeholder="0"
                        style={{
                          fontSize: "2rem",
                          fontWeight: "600",
                          border: "2px solid #90caf9",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          width: "150px",
                          textAlign: "center",
                        }}
                      />
                    </div>
                    <div className="stat-label">📥 Downloads do App</div>
                    <div
                      className="stat-note"
                      style={{
                        fontSize: "0.75rem",
                        color: "#666",
                        marginTop: "4px",
                      }}
                    >
                      Editável manualmente
                    </div>
                  </div>
                </div>
              </div>

              {/* Planos de Leitura */}
              <div className="stats-section">
                <h2>📖 Estatísticas de Planos de Leitura</h2>
                <div className="stats-grid">
                  <div className="stat-card primary">
                    <label className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCards.totalPlans}
                        onChange={(e) =>
                          setSelectedCards({
                            ...selectedCards,
                            totalPlans: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div className="stat-value">{stats.readingPlans.total}</div>
                    <div className="stat-label">Total de Planos Criados</div>
                  </div>

                  <div className="stat-card success">
                    <label className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCards.completedDays}
                        onChange={(e) =>
                          setSelectedCards({
                            ...selectedCards,
                            completedDays: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div className="stat-value">
                      {stats.readingPlans.totalCompletedDays}
                    </div>
                    <div className="stat-label">
                      Dias de Leitura Completados
                    </div>
                  </div>
                </div>

                {Object.keys(stats.readingPlans.byType).length > 0 && (
                  <div className="subsection">
                    <h3>
                      <label className="section-title-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedCards.plansByType}
                          onChange={(e) =>
                            setSelectedCards({
                              ...selectedCards,
                              plansByType: e.target.checked,
                            })
                          }
                        />
                        <span>Planos por Tipo</span>
                      </label>
                    </h3>
                    <div className="stats-grid">
                      {Object.entries(stats.readingPlans.byType).map(
                        ([type, count]) => {
                          const typeName =
                            type === "yearly" ? "Plano de Leitura Anual" : type;
                          return (
                            <div key={type} className="stat-card secondary">
                              <div className="stat-value">{count}</div>
                              <div className="stat-label">{typeName}</div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Questionários */}
              <div className="stats-section">
                <h2>📝 Estatísticas de Questionários</h2>
                <div className="stats-grid">
                  <div className="stat-card primary">
                    <label className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCards.totalQuizResults}
                        onChange={(e) =>
                          setSelectedCards({
                            ...selectedCards,
                            totalQuizResults: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div className="stat-value">
                      {stats.quizzes.totalResults}
                    </div>
                    <div className="stat-label">Questionários Respondidos</div>
                  </div>

                  <div className="stat-card success">
                    <label className="card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCards.averageScore}
                        onChange={(e) =>
                          setSelectedCards({
                            ...selectedCards,
                            averageScore: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <div className="stat-value">
                      {stats.quizzes.averageScore.toFixed(2)}%
                    </div>
                    <div className="stat-label">Média de Acertos</div>
                  </div>
                </div>
              </div>

              {/* Google Play Store Stats */}
              {playStoreStats && (
                <div className="stats-section">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "20px",
                    }}
                  >
                    <h2>📱 Estatísticas do Google Play Store</h2>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        className={`period-button ${
                          playStoreDays === 7 ? "active" : ""
                        }`}
                        onClick={() => handlePlayStoreDaysChange(7)}
                      >
                        7 dias
                      </button>
                      <button
                        className={`period-button ${
                          playStoreDays === 30 ? "active" : ""
                        }`}
                        onClick={() => handlePlayStoreDaysChange(30)}
                      >
                        30 dias
                      </button>
                      <button
                        className={`period-button ${
                          playStoreDays === 90 ? "active" : ""
                        }`}
                        onClick={() => handlePlayStoreDaysChange(90)}
                      >
                        90 dias
                      </button>
                    </div>
                  </div>

                  {loadingPlayStore ? (
                    <div className="loading">
                      Carregando estatísticas do Play Store...
                    </div>
                  ) : playStoreStats && (playStoreStats as any)._note ? (
                    <div
                      className="info-message"
                      style={{
                        padding: "20px",
                        backgroundColor: "#e3f2fd",
                        border: "1px solid #2196f3",
                        borderRadius: "8px",
                        color: "#0d47a1",
                        marginBottom: "20px",
                      }}
                    >
                      <h4 style={{ marginTop: 0 }}>
                        ℹ️ Dados do Google Play ainda não disponíveis
                      </h4>
                      <p>
                        <strong>App na Play Store:</strong>{" "}
                        <a
                          href="https://play.google.com/store/apps/details?id=com.readbible.app"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#1976d2" }}
                        >
                          Bíblia em Foco
                        </a>
                        <br />
                        <strong>Publicado em:</strong> 25/12/2025 (13 dias
                        atrás)
                        <br />
                        <strong>Package:</strong> <code>com.readbible.app</code>
                        <br />
                        <strong>Usuários cadastrados:</strong>{" "}
                        {stats?.users?.total || 270} (volume suficiente ✓)
                      </p>
                      <p>
                        <strong>Por que os dados não aparecem ainda?</strong>
                      </p>
                      <ul style={{ marginBottom: 10 }}>
                        <li>
                          🎯 <strong>Trilha de produção:</strong> A API só conta
                          usuários da versão de produção pública (não testes
                          internos/fechados)
                        </li>
                        <li>
                          📊 <strong>Métricas de qualidade:</strong> Só aparecem
                          quando há eventos para reportar (crashes, ANRs, slow
                          rendering)
                        </li>
                        <li>
                          🔄 <strong>Período de coleta:</strong> Google precisa
                          acumular dados por alguns dias antes de disponibilizar
                        </li>
                        <li>
                          ⏰ <strong>Atraso natural:</strong> Pode haver atraso
                          de 24-48h entre os eventos e sua disponibilização na
                          API
                        </li>
                      </ul>
                      <p>
                        <strong>✅ Configuração correta:</strong>
                      </p>
                      <ul style={{ marginBottom: 10 }}>
                        <li>✓ App publicado na Play Store</li>
                        <li>
                          ✓ Service Account com permissões de Administrador
                        </li>
                        <li>
                          ✓ API do Google Play Developer Reporting habilitada
                        </li>
                        <li>✓ Tempo suficiente desde publicação (13 dias)</li>
                      </ul>
                      <p
                        style={{
                          marginBottom: 0,
                          fontSize: "0.9em",
                          marginTop: 10,
                        }}
                      >
                        💡 <strong>Próximo passo:</strong> Os dados aparecerão
                        automaticamente quando o app atingir o volume mínimo de
                        usuários ativos. Continue promovendo o app para aumentar
                        as instalações!
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Instalações */}
                      <div className="subsection">
                        <h3>📥 Instalações e Atualizações</h3>
                        <div
                          style={{
                            padding: "15px",
                            backgroundColor: "#e3f2fd",
                            border: "1px solid #2196f3",
                            borderRadius: "8px",
                            color: "#0d47a1",
                            marginBottom: "20px",
                          }}
                        >
                          <p style={{ margin: 0 }}>
                            ℹ️ <strong>Nota:</strong> Dados de instalações não
                            estão disponíveis na API do Google Play Developer
                            Reporting. Esta API fornece apenas métricas de
                            qualidade (crashes, ANRs, erros de desempenho).
                          </p>
                        </div>
                      </div>

                      {/* Estabilidade */}
                      <div className="subsection">
                        <h3>🛡️ Estabilidade do App</h3>
                        <div className="stats-grid">
                          <div className="stat-card danger">
                            <div className="stat-value">
                              {playStoreStats.crashes.totals.distinctCrashes}
                            </div>
                            <div className="stat-label">Crashes Distintos</div>
                          </div>

                          <div className="stat-card warning">
                            <div className="stat-value">
                              {playStoreStats.crashes.averages.crashRatePerUserPercent.toFixed(
                                3,
                              )}
                              %
                            </div>
                            <div className="stat-label">
                              Taxa de Crash (Usuários)
                            </div>
                          </div>

                          <div className="stat-card danger">
                            <div className="stat-value">
                              {playStoreStats.anrs.totals.distinctAnrs}
                            </div>
                            <div className="stat-label">ANRs Distintos</div>
                          </div>

                          <div className="stat-card warning">
                            <div className="stat-value">
                              {playStoreStats.anrs.averages.anrRatePerUserPercent.toFixed(
                                3,
                              )}
                              %
                            </div>
                            <div className="stat-label">
                              Taxa de ANR (Usuários)
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="report-footer">
                        <p>
                          Período:{" "}
                          {new Date(
                            playStoreStats.period.startDate,
                          ).toLocaleDateString("pt-BR")}{" "}
                          -{" "}
                          {new Date(
                            playStoreStats.period.endDate,
                          ).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="report-footer">
                <p>
                  Relatório gerado em:{" "}
                  {new Date(stats.generatedAt).toLocaleString("pt-BR")}
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default Reports;
