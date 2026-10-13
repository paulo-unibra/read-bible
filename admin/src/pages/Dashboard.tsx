import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { MainContent } from "../components/ui/StyledComponents";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

interface DashboardStats {
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
}

const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

const planTypeLabels: Record<string, string> = {
  yearly: "Anual",
  sequential: "Sequencial",
  interleaved: "Intercalado",
  beginner: "Iniciante",
  custom: "Personalizado",
};

const Dashboard: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");

  useEffect(() => {
    let active = true;

    api
      .get("/admin/reports/general-stats")
      .then((response) => {
        if (active) setStats(response.data);
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar as estatísticas agora.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const activePlanProgress = stats?.users.withActivePlan
    ? Math.min(100, Math.round((stats.users.upToDate / stats.users.withActivePlan) * 100))
    : 0;

  const activityMetrics = [
    { label: "Planos ativos", value: stats?.users.withActivePlan ?? 0 },
    { label: "Em dia", value: stats?.users.upToDate ?? 0 },
    { label: "Concluíram plano", value: stats?.users.withCompletedPlan ?? 0 },
    { label: "Ativos · 7 dias", value: stats?.users.activeInLast7Days ?? 0 },
    { label: "Novos · 30 dias", value: stats?.users.newInLast30Days ?? 0 },
    { label: "Com questionários", value: stats?.users.withQuizResults ?? 0 },
  ];
  const maxActivity = Math.max(1, ...activityMetrics.map((item) => item.value));

  const planTypes = Object.entries(stats?.readingPlans.byType ?? {})
    .map(([type, count]) => ({
      label: planTypeLabels[type] || type,
      value: count,
    }))
    .sort((a, b) => b.value - a.value);
  const maxPlanCount = Math.max(1, ...planTypes.map((item) => item.value));

  const quickLinks = useMemo(
    () =>
      [
        { title: "Questionários", detail: "Conteúdo bíblico", icon: "✎", path: "/quizzes", permission: "gerenciar_questionarios", color: "from-fuchsia-400 to-purple-500" },
        { title: "Usuários", detail: "Contas e acessos", icon: "♙", path: "/users", permission: "gerenciar_usuarios", color: "from-sky-400 to-indigo-500" },
        { title: "Planos ativos", detail: "Acompanhamento", icon: "▤", path: "/active-plans", permission: "gerenciar_conteudo", color: "from-violet-400 to-purple-600" },
        { title: "Relatórios", detail: "Análises do sistema", icon: "▥", path: "/reports", permission: "visualizar_relatorios", color: "from-rose-400 to-fuchsia-500" },
      ].filter(
        (item) =>
          hasPermission(item.permission) &&
          `${item.title} ${item.detail}`.toLocaleLowerCase("pt-BR").includes(moduleSearch.toLocaleLowerCase("pt-BR"))
      ),
    [hasPermission, moduleSearch]
  );

  const metricCards = [
    {
      label: "Usuários cadastrados",
      value: stats?.users.total ?? 0,
      note: `+${formatNumber(stats?.users.newInLast30Days ?? 0)} nos últimos 30 dias`,
      icon: "♙",
      tint: "bg-[#f3e6ff] text-[#9555ce]",
    },
    {
      label: "Planos de leitura",
      value: stats?.readingPlans.total ?? 0,
      note: `${formatNumber(stats?.users.withActivePlan ?? 0)} ativos agora`,
      icon: "▤",
      tint: "bg-[#fce7f3] text-[#d34f9a]",
    },
    {
      label: "Leituras concluídas",
      value: stats?.readingPlans.totalCompletedDays ?? 0,
      note: `${formatNumber(stats?.users.activeInLast7Days ?? 0)} leitores · 7 dias`,
      icon: "✓",
      tint: "bg-[#e8e9ff] text-[#6865cc]",
    },
    {
      label: "Questionários respondidos",
      value: stats?.quizzes.totalResults ?? 0,
      note: `Média de ${stats?.quizzes.averageScore ?? 0}% de acertos`,
      icon: "✎",
      tint: "bg-[#e2f4f4] text-[#398b98]",
    },
  ];

  return (
    <>
      <Sidebar />
      <MainContent className="!min-h-screen !bg-[radial-gradient(ellipse_at_18%_12%,rgba(248,203,243,0.72),transparent_38%),linear-gradient(135deg,#f5e4f5_0%,#eee3f7_55%,#e7e5fb_100%)] !px-6 !py-7 sm:!px-8">
        <div className="mx-auto max-w-[1550px]">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#9b6db7]">Bíblia em Foco · Administração</p>
              <h1 className="m-0 text-[28px] font-semibold tracking-[-0.03em] text-[#382747] sm:text-[32px]">Visão geral</h1>
            </div>
            <div className="flex items-center gap-3">
              <label className="hidden items-center gap-2 rounded-full border border-white/80 bg-white/45 px-4 py-2.5 text-sm text-[#897599] shadow-sm backdrop-blur-xl md:flex">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={moduleSearch}
                  onChange={(event) => setModuleSearch(event.target.value)}
                  placeholder="Buscar módulos"
                  className="w-36 bg-transparent text-sm text-[#4b365a] outline-none placeholder:text-[#9e8bac]"
                  aria-label="Buscar módulos"
                />
              </label>
              <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/45 py-1.5 pl-3 pr-1.5 shadow-sm backdrop-blur-xl">
                <div className="text-right">
                  <p className="m-0 text-xs font-semibold text-[#493458]">{user?.fullName || user?.email || "Administrador"}</p>
                  <p className="m-0 text-[10px] text-[#90799e]">Painel administrativo</p>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#f189ce] to-[#9a69df] text-sm font-bold text-white">
                  {(user?.fullName || user?.email || "A").trim().charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </header>

          {error && (
            <div className="mb-5 rounded-2xl border border-rose-200/70 bg-white/55 px-4 py-3 text-sm text-rose-700 backdrop-blur-xl">
              {error}
            </div>
          )}

          <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principais">
            {metricCards.map((metric) => (
              <article key={metric.label} className="rounded-2xl border border-white/80 bg-white/50 p-4 shadow-[0_8px_30px_rgba(110,69,135,0.07)] backdrop-blur-xl transition-transform hover:-translate-y-0.5 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-2 text-xs font-medium text-[#806d8e]">{metric.label}</p>
                    <p className="m-0 text-[27px] font-semibold leading-none tracking-tight text-[#382747]">
                      {loading ? "—" : formatNumber(metric.value)}
                    </p>
                  </div>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl ${metric.tint}`} aria-hidden="true">{metric.icon}</span>
                </div>
                <p className="mb-0 mt-3 text-[11px] text-[#927ea0]">{metric.note}</p>
              </article>
            ))}
          </section>

          <section className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <article className="rounded-2xl border border-white/80 bg-white/50 p-5 shadow-[0_8px_30px_rgba(110,69,135,0.07)] backdrop-blur-xl xl:col-span-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="m-0 text-[15px] font-semibold text-[#443052]">Engajamento da comunidade</h2>
                  <p className="mb-0 mt-1 text-xs text-[#927ea0]">Indicadores de leitura e participação no sistema</p>
                </div>
                <span className="rounded-full bg-[#f3e9fb] px-3 py-1 text-[10px] font-semibold text-[#8b57b5]">GERAL</span>
              </div>
              <div className="grid h-[220px] grid-cols-6 items-end gap-2 border-b border-dashed border-[#d9cce5] px-1 sm:gap-4 sm:px-3">
                {activityMetrics.map((metric, index) => {
                  const barHeight = metric.value ? Math.max(10, (metric.value / maxActivity) * 100) : 5;
                  return (
                    <div key={metric.label} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                      <span className="text-[10px] font-semibold text-[#745789]">{loading ? "—" : formatNumber(metric.value)}</span>
                      <div className="flex h-[140px] w-full items-end justify-center">
                        <div
                          className={`w-full max-w-12 rounded-t-lg bg-gradient-to-t ${index % 2 ? "from-[#bd72dd] to-[#e8a7e5]" : "from-[#8d70db] to-[#d899df]"} shadow-[0_3px_10px_rgba(162,104,206,0.15)] transition-all duration-500`}
                          style={{ height: `${barHeight}%` }}
                        />
                      </div>
                      <span className="min-h-8 text-center text-[9px] leading-tight text-[#8c7899] sm:text-[10px]">{metric.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[9px] text-[#a391ae]"><span>0</span><span>Usuários e atividades</span><span>{formatNumber(maxActivity)}</span></div>
            </article>

            <article className="flex flex-col items-center justify-center rounded-2xl border border-white/80 bg-white/50 p-5 text-center shadow-[0_8px_30px_rgba(110,69,135,0.07)] backdrop-blur-xl xl:col-span-4">
              <div className="mb-3 self-start text-left">
                <h2 className="m-0 text-[15px] font-semibold text-[#443052]">Ritmo de leitura</h2>
                <p className="mb-0 mt-1 text-xs text-[#927ea0]">Planos ativos acompanhados</p>
              </div>
              <div
                className="grid h-36 w-36 place-items-center rounded-full p-[11px] shadow-[0_8px_22px_rgba(145,83,189,0.12)]"
                style={{ background: `conic-gradient(#db71c6 ${activePlanProgress}%, #9072db 0 ${Math.min(100, activePlanProgress + (100 - activePlanProgress) / 2)}%, #e9dff0 0)` }}
                role="img"
                aria-label={`${activePlanProgress}% dos usuários com plano ativo estão em dia`}
              >
                <div className="grid h-full w-full place-items-center rounded-full border border-white/90 bg-white/85 backdrop-blur-xl">
                  <div>
                    <p className="m-0 text-3xl font-bold tracking-tight text-[#8139ae]">{loading ? "—" : `${activePlanProgress}%`}</p>
                    <p className="m-0 text-[10px] text-[#927ea0]">em dia</p>
                  </div>
                </div>
              </div>
              <p className="mb-0 mt-3 text-xs text-[#806d8e]">
                {formatNumber(stats?.users.upToDate ?? 0)} de {formatNumber(stats?.users.withActivePlan ?? 0)} leitores
              </p>
              <div className="mt-4 grid w-full grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#f6effa] p-3 text-left">
                  <p className="m-0 text-[10px] text-[#927ea0]">Dias concluídos</p>
                  <p className="mb-0 mt-1 text-lg font-semibold text-[#714991]">{loading ? "—" : formatNumber(stats?.readingPlans.totalCompletedDays ?? 0)}</p>
                </div>
                <div className="rounded-xl bg-[#fbecf5] p-3 text-left">
                  <p className="m-0 text-[10px] text-[#927ea0]">Média de acertos</p>
                  <p className="mb-0 mt-1 text-lg font-semibold text-[#ba548f]">{loading ? "—" : `${stats?.quizzes.averageScore ?? 0}%`}</p>
                </div>
              </div>
            </article>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <article className="rounded-2xl border border-white/80 bg-white/50 p-5 shadow-[0_8px_30px_rgba(110,69,135,0.07)] backdrop-blur-xl lg:col-span-4">
              <h2 className="m-0 text-[15px] font-semibold text-[#443052]">Planos por modalidade</h2>
              <p className="mb-4 mt-1 text-xs text-[#927ea0]">Distribuição dos planos cadastrados</p>
              <div className="space-y-3">
                {planTypes.length ? planTypes.slice(0, 5).map((plan, index) => (
                  <div key={plan.label}>
                    <div className="mb-1 flex justify-between text-[11px] text-[#756282]">
                      <span>{plan.label}</span><span className="font-semibold">{formatNumber(plan.value)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#eee5f4]">
                      <div className={`h-full rounded-full bg-gradient-to-r ${index % 2 ? "from-[#d97ac9] to-[#f0aadf]" : "from-[#9874d8] to-[#c19be8]"}`} style={{ width: `${Math.max(4, (plan.value / maxPlanCount) * 100)}%` }} />
                    </div>
                  </div>
                )) : <p className="m-0 py-8 text-center text-xs text-[#9b89a8]">{loading ? "Carregando dados…" : "Sem planos cadastrados"}</p>}
              </div>
            </article>

            <article className="rounded-2xl border border-white/80 bg-white/50 p-5 shadow-[0_8px_30px_rgba(110,69,135,0.07)] backdrop-blur-xl lg:col-span-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="m-0 text-[15px] font-semibold text-[#443052]">Acessos rápidos</h2>
                  <p className="mb-0 mt-1 text-xs text-[#927ea0]">Seus módulos mais utilizados</p>
                </div>
                <span className="text-lg text-[#b078cf]" aria-hidden="true">✧</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {quickLinks.map((item) => (
                  <button key={item.path} type="button" onClick={() => navigate(item.path)} className="group flex items-center gap-3 rounded-xl border border-white/80 bg-white/45 p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${item.color} text-lg text-white shadow-sm`} aria-hidden="true">{item.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-[#493458]">{item.title}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-[#9582a2]">{item.detail}</span>
                    </span>
                    <span className="text-sm text-[#b28ac8] transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
                  </button>
                ))}
                {!quickLinks.length && <p className="col-span-full m-0 py-8 text-center text-xs text-[#9b89a8]">Nenhum módulo corresponde à busca.</p>}
              </div>
            </article>

            <article className="rounded-2xl border border-white/80 bg-white/50 p-5 shadow-[0_8px_30px_rgba(110,69,135,0.07)] backdrop-blur-xl lg:col-span-3">
              <h2 className="m-0 text-[15px] font-semibold text-[#443052]">Seu perfil</h2>
              <p className="mb-0 mt-1 truncate text-xs text-[#927ea0]">{user?.fullName || user?.email}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {user?.roles?.map((role) => (
                  <span key={role.id} className="rounded-full border border-white/80 bg-[#f5eafb] px-2.5 py-1 text-[10px] font-semibold text-[#8853a7]">{role.name}</span>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-gradient-to-br from-[#f7e6f5] to-[#ece8fb] p-3.5">
                <p className="m-0 text-[10px] font-medium text-[#8c72a0]">Planos sem leitura iniciada</p>
                <p className="mb-0 mt-1 text-2xl font-semibold text-[#7f55a4]">{loading ? "—" : formatNumber(stats?.users.notStartedReading ?? 0)}</p>
              </div>
            </article>
          </section>
        </div>
      </MainContent>
    </>
  );
};

export default Dashboard;
