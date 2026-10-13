import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import {
    ActionButton,
    Badge,
    Button,
    EmptyState,
    ErrorMessage,
    FiltersSection,
    MainContent,
    PageTitle,
    Pagination,
    Table,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
} from "../components/ui/StyledComponents";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import "./AuditLogs.css";

interface AuditLogEntry {
  id: number;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: number;
    fullName: string;
    email: string;
  } | null;
}

interface Meta {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  firstPage: number;
  firstPageUrl: string;
  lastPageUrl: string;
  nextPageUrl: string | null;
  previousPageUrl: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Login",
  "auth.login_failed": "Tentativa de login incorreta",
  "auth.register": "Cadastro",
  "auth.logout": "Logout",
  "admin.login": "Login no painel",
  "admin.login_failed": "Login no painel incorreto",
  "profile.name_update": "Alteração de nome",
  "profile.name_manual_fix": "Correção manual de nome",
  "plan.create": "Criação de plano",
  "plan.delete": "Exclusão de plano",
  "plan.disable": "Plano desabilitado (admin)",
  "plan.enable": "Plano reativado (admin)",
  "reading.complete_day": "Marcação de leitura",
  "reading.unmark_day": "Desmarcação de leitura",
  "password.reset": "Redefinição de senha",
  "password.request_reset": "Solicitação de redefinição",
};

const ACTION_COLORS: Record<string, string> = {
  "auth.login": "success",
  "auth.login_failed": "error",
  "auth.register": "info",
  "auth.logout": "neutral",
  "admin.login": "success",
  "admin.login_failed": "error",
  "plan.create": "info",
  "plan.delete": "error",
  "plan.disable": "error",
  "plan.enable": "success",
  "reading.complete_day": "success",
  "reading.unmark_day": "warning",
  "password.reset": "warning",
  "password.request_reset": "warning",
  "profile.name_update": "warning",
  "profile.name_manual_fix": "warning",
};

const PERIODS = [
  { value: "all", label: "Todo o período" },
  { value: "today", label: "Hoje" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
];

const isValidIpAddress = (value: string) => {
  const ipv4 = (address: string) => {
    const octets = address.split(".");
    return octets.length === 4 && octets.every((octet) => {
      if (!/^\d{1,3}$/.test(octet)) return false;
      const number = Number(octet);
      return number >= 0 && number <= 255;
    });
  };

  if (ipv4(value)) return true;
  if (!value.includes(":") || value.includes("%")) return false;

  let address = value;
  if (address.includes(".")) {
    const lastColon = address.lastIndexOf(":");
    if (lastColon < 0 || !ipv4(address.slice(lastColon + 1))) return false;
    address = `${address.slice(0, lastColon + 1)}0:0`;
  }

  const compressed = address.includes("::");
  if (compressed && address.indexOf("::") !== address.lastIndexOf("::")) return false;

  const groups = address.split(":").filter(Boolean);
  if (groups.some((group) => !/^[\da-f]{1,4}$/i.test(group))) return false;
  return compressed ? groups.length < 8 : groups.length === 8;
};

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("30");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [ipInput, setIpInput] = useState("");
  const [ipError, setIpError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPermission("gerenciar_usuarios")) {
      navigate("/dashboard");
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadActions();
  }, []);

  const loadActions = async () => {
    try {
      const response = await api.get("/admin/audit-logs/actions");
      setActions(response.data.data || []);
    } catch (err) {
      console.error("Erro ao carregar ações:", err);
    }
  };

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params: Record<string, string | number> = {
        page,
        limit: 50,
      };

      if (actionFilter !== "all") {
        params.action = actionFilter;
      }

      if (search.trim()) {
        params.search = search.trim();
      }

      if (ipFilter.trim()) {
        params.ip = ipFilter.trim();
      }

      if (dateFrom) {
        params.from = new Date(`${dateFrom}T00:00:00`).toISOString();
      }
      if (dateTo) {
        params.to = new Date(`${dateTo}T23:59:59.999`).toISOString();
      }

      if (!dateFrom && !dateTo && periodFilter !== "all") {
        const to = new Date();
        const from = new Date();

        if (periodFilter === "today") {
          from.setHours(0, 0, 0, 0);
        } else {
          from.setDate(from.getDate() - Number(periodFilter));
        }

        params.from = from.toISOString();
        params.to = to.toISOString();
      }

      const response = await api.get("/admin/audit-logs", { params });
      setLogs(response.data.data);
      setMeta(response.data.meta);
    } catch (err) {
      setError("Erro ao carregar logs de auditoria");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, periodFilter, search, ipFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const getActionLabel = (action: string) =>
    ACTION_LABELS[action] || action.replace(/\./g, " · ");

  const getActionBadge = (action: string) => {
    const type = (ACTION_COLORS[action] || "neutral") as
      | "success"
      | "error"
      | "info"
      | "warning";
    return <Badge type={type}>{getActionLabel(action)}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const handleShowDetails = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setShowDetailsModal(true);
  };

  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedLog(null);
  };

  const handlePeriodChange = (value: string) => {
    setPeriodFilter(value);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const applyTextFilters = () => {
    const trimmedIp = ipInput.trim();
    if (trimmedIp && !isValidIpAddress(trimmedIp)) {
      setIpError("Informe um endereço IPv4 ou IPv6 válido.");
      return;
    }
    setIpError("");
    setSearch(searchInput.trim());
    setIpFilter(trimmedIp);
    setPage(1);
  };

  const handleCopyLogs = async () => {
    const logText = logs
      .map((log) =>
        [
          `Log #${log.id}`,
          `Data/Hora: ${formatDate(log.createdAt)}`,
          `Usuário: ${log.user?.fullName || "Usuário removido"}`,
          `E-mail: ${log.user?.email || "—"}`,
          `ID do usuário: ${log.userId ?? "—"}`,
          `Ação: ${getActionLabel(log.action)} (${log.action})`,
          `Entidade: ${log.entityType || "—"}`,
          `ID da entidade: ${log.entityId ?? "—"}`,
          `IP: ${log.ipAddress || "—"}`,
          `User-Agent: ${log.userAgent || "—"}`,
          `Detalhes: ${JSON.stringify(log.details, null, 2)}`,
        ].join("\n")
      )
      .join("\n\n---\n\n");

    try {
      await navigator.clipboard.writeText(logText);
      setCopyFeedback(`${logs.length} log(s) copiado(s)`);
    } catch (err) {
      setCopyFeedback("Não foi possível copiar. Verifique a permissão da área de transferência.");
      console.error("Erro ao copiar logs:", err);
    }

    window.setTimeout(() => setCopyFeedback(""), 4000);
  };

  const activeFilterCount = [
    actionFilter !== "all",
    search !== "",
    ipFilter !== "",
    Boolean(dateFrom || dateTo) || periodFilter !== "30",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setActionFilter("all");
    setPeriodFilter("30");
    setSearch("");
    setSearchInput("");
    setIpFilter("");
    setIpInput("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <MainContent className="!pb-[120px]">
        <PageTitle>Logs de Auditoria</PageTitle>

        {/* Filtros */}
        <FiltersSection className="sticky top-3 z-50 mb-6 !flex-col !gap-0 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-[var(--color-primary-light)] text-2xl text-[var(--color-primary)]" aria-hidden="true">☷</span>
              <div>
                <h2 className="m-0 text-base font-semibold text-[var(--color-text)]">Filtros</h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Encontre registros por ação, usuário, IP ou período</p>
              </div>
              {activeFilterCount > 0 && (
                <span className="inline-flex whitespace-nowrap rounded-full bg-[var(--color-primary-light)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
                  {activeFilterCount} ativo{activeFilterCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-transparent px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg)]"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersOpen ? "Recolher" : "Abrir filtros"}
              <span className={`inline-block text-lg transition-transform ${filtersOpen ? "rotate-180" : ""}`} aria-hidden="true">⌄</span>
            </button>
          </div>

          {!filtersOpen && activeFilterCount > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtros aplicados">
              {actionFilter !== "all" && <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">{getActionLabel(actionFilter)}</span>}
              {search && <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">Usuário: {search}</span>}
              {ipFilter && <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">IP: {ipFilter}</span>}
              {(dateFrom || dateTo) && <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">{dateFrom || "…"} — {dateTo || "…"}</span>}
              {!dateFrom && !dateTo && periodFilter !== "all" && (
                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">{PERIODS.find((period) => period.value === periodFilter)?.label}</span>
              )}
            </div>
          )}

          {filtersOpen && <div className="mt-4 border-t border-[var(--color-border)] pt-5">
          <div className="grid w-full grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
            <label className="2xl:col-span-1 flex min-w-0 flex-col items-stretch gap-2 text-left text-sm font-medium text-[var(--color-text-secondary)]">
              Ação:
              <select
                className="min-h-10 w-full min-w-0 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-2 text-[0.95rem] text-[var(--color-text)] focus:outline-2 focus:outline-offset-1 focus:outline-[var(--color-primary)]"
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Todas</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {getActionLabel(action)}
                  </option>
                ))}
              </select>
            </label>

            <label className="2xl:col-span-1 flex min-w-0 flex-col items-stretch gap-2 text-left text-sm font-medium text-[var(--color-text-secondary)]">
              Período:
              <select
                className="min-h-10 w-full min-w-0 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-2 text-[0.95rem] text-[var(--color-text)] focus:outline-2 focus:outline-offset-1 focus:outline-[var(--color-primary)]"
                value={periodFilter}
                onChange={(e) => handlePeriodChange(e.target.value)}
              >
                {PERIODS.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-0 flex-col items-stretch gap-2 text-left text-sm font-medium text-[var(--color-text-secondary)] 2xl:col-span-2">
              Usuário (nome ou e-mail):
              <input
                className="min-h-10 w-full min-w-0 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-2 text-[0.95rem] text-[var(--color-text)] focus:outline-2 focus:outline-offset-1 focus:outline-[var(--color-primary)]"
                type="text"
                value={searchInput}
                placeholder="Digite e pressione Enter"
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyTextFilters();
                }}
              />
            </label>

            <label className="flex min-w-0 flex-col items-stretch gap-2 text-left text-sm font-medium text-[var(--color-text-secondary)] 2xl:col-span-1">
              IP:
              <input
                className="min-h-10 w-full min-w-0 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-2 font-mono text-[0.95rem] text-[var(--color-text)] focus:outline-2 focus:outline-offset-1 focus:outline-[var(--color-primary)]"
                type="text"
                value={ipInput}
                placeholder="IPv4 ou IPv6"
                aria-invalid={Boolean(ipError)}
                aria-describedby={ipError ? "ip-filter-error" : "ip-filter-hint"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => {
                  setIpInput(e.target.value.replace(/[^\da-f:.]/gi, "").toLowerCase());
                  setIpError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyTextFilters();
                }}
              />
              <span
                id={ipError ? "ip-filter-error" : "ip-filter-hint"}
                className={`block text-xs font-normal ${ipError ? "break-words text-red-600" : "text-[var(--color-text-secondary)]"}`}
                role={ipError ? "alert" : undefined}
              >
                {ipError || "Aceita IPv4 e IPv6"}
              </span>
            </label>

            <label className="flex min-w-0 flex-col items-stretch gap-2 text-left text-sm font-medium text-[var(--color-text-secondary)] 2xl:col-span-1">
              De:
              <input className="min-h-10 w-full min-w-0 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-2 text-[0.95rem] text-[var(--color-text)] focus:outline-2 focus:outline-offset-1 focus:outline-[var(--color-primary)]" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPeriodFilter("all"); setPage(1); }} />
            </label>
            <label className="flex min-w-0 flex-col items-stretch gap-2 text-left text-sm font-medium text-[var(--color-text-secondary)] 2xl:col-span-1">
              Até:
              <input className="min-h-10 w-full min-w-0 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-2 text-[0.95rem] text-[var(--color-text)] focus:outline-2 focus:outline-offset-1 focus:outline-[var(--color-primary)]" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPeriodFilter("all"); setPage(1); }} />
            </label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2 xl:col-span-1 2xl:col-span-1">
              <Button className="w-full" onClick={applyTextFilters} disabled={loading}>Aplicar filtros</Button>
              {activeFilterCount > 0 && (
                <button type="button" className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border-strong)] bg-transparent px-3 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)]" onClick={clearFilters}>
                  Limpar
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 border-t border-[var(--color-border)] pt-4 max-md:flex-col max-md:items-start">
          {meta && (
            <div className="total-info">
              <strong>{meta.total}</strong> registro(s) encontrado(s)
            </div>
          )}
          <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            <Button onClick={handleCopyLogs} disabled={loading || logs.length === 0}>
              Copiar logs desta página
            </Button>
            {copyFeedback && <span role="status">{copyFeedback}</span>}
          </div>
          </div>
          </div>}
        </FiltersSection>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            Carregando logs...
          </div>
        ) : logs.length === 0 ? (
          <EmptyState>Nenhum log de auditoria encontrado</EmptyState>
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Data/Hora</Th>
                <Th>Usuário</Th>
                <Th>Ação</Th>
                <Th>Detalhes</Th>
                <Th>IP</Th>
                <Th style={{ width: "120px" }}>Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {logs.map((log) => (
                <Tr key={log.id}>
                  <Td>{formatDate(log.createdAt)}</Td>
                  <Td>
                    <div>
                      <strong>{log.user?.fullName || "—"}</strong>
                    </div>
                    <div className="cell-sub">
                      {log.user?.email || "Usuário removido"}
                    </div>
                  </Td>
                  <Td>{getActionBadge(log.action)}</Td>
                  <Td>
                    <div className="details-preview">
                      {log.details
                        ? JSON.stringify(log.details).slice(0, 60)
                        : "—"}
                    </div>
                  </Td>
                  <Td>
                    <div className="ip-cell">{log.ipAddress || "—"}</div>
                  </Td>
                  <Td>
                    <ActionButton onClick={() => handleShowDetails(log)}>
                      Ver Detalhes
                    </ActionButton>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        {meta && meta.lastPage > 1 && (
          <Pagination className="fixed bottom-0 left-[var(--sidebar-width)] right-0 z-[90] !m-0 min-h-[72px] border-t border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-3 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] max-sm:px-3">
            <Button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1 || loading}
            >
              ← Anterior
            </Button>
            <span className="page-info">
              Página {meta.currentPage} de {meta.lastPage}
            </span>
            <Button
              onClick={() => setPage(page + 1)}
              disabled={page >= meta.lastPage || loading}
            >
              Próxima →
            </Button>
          </Pagination>
        )}
      </MainContent>

      {/* Modal de Detalhes */}
      {showDetailsModal && selectedLog && (
        <div className="modal-overlay" onClick={handleCloseDetailsModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalhes do Log</h2>
              <button className="modal-close" onClick={handleCloseDetailsModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-row">
                <strong>Ação</strong>
                <div>{getActionBadge(selectedLog.action)}</div>
              </div>

              <div className="detail-row">
                <strong>Data/Hora</strong>
                <div>{formatDate(selectedLog.createdAt)}</div>
              </div>

              <div className="detail-row">
                <strong>Usuário</strong>
                <div>
                  {selectedLog.user?.fullName || "Usuário removido"} (
                  {selectedLog.user?.email || "sem e-mail"})
                </div>
              </div>

              <div className="detail-row">
                <strong>IP</strong>
                <div>{selectedLog.ipAddress || "—"}</div>
              </div>

              <div className="detail-row">
                <strong>User-Agent</strong>
                <div className="message-box">
                  {selectedLog.userAgent || "—"}
                </div>
              </div>

              <div className="detail-row">
                <strong>Detalhes (JSON)</strong>
                <pre className="json-box">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
