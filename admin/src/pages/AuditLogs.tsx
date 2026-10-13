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
    setSearch(searchInput.trim());
    setIpFilter(ipInput.trim());
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

      <MainContent>
        <PageTitle>Logs de Auditoria</PageTitle>

        {/* Filtros */}
        <FiltersSection className="audit-filter-panel">
          <div className="filter-panel-heading">
            <div className="filter-panel-title">
              <span className="filter-panel-icon" aria-hidden="true">☷</span>
              <div>
                <h2>Filtros</h2>
                <p>Encontre registros por ação, usuário, IP ou período</p>
              </div>
              {activeFilterCount > 0 && (
                <span className="active-filter-count">
                  {activeFilterCount} ativo{activeFilterCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <button
              type="button"
              className="filter-toggle"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersOpen ? "Recolher" : "Abrir filtros"}
              <span className={filtersOpen ? "filter-chevron is-open" : "filter-chevron"} aria-hidden="true">⌄</span>
            </button>
          </div>

          {!filtersOpen && activeFilterCount > 0 && (
            <div className="filter-summary" aria-label="Filtros aplicados">
              {actionFilter !== "all" && <span>{getActionLabel(actionFilter)}</span>}
              {search && <span>Usuário: {search}</span>}
              {ipFilter && <span>IP: {ipFilter}</span>}
              {(dateFrom || dateTo) && <span>{dateFrom || "…"} — {dateTo || "…"}</span>}
              {!dateFrom && !dateTo && periodFilter !== "all" && (
                <span>{PERIODS.find((period) => period.value === periodFilter)?.label}</span>
              )}
            </div>
          )}

          {filtersOpen && <div className="filter-panel-content">
          <div className="filters-group">
            <label>
              Ação:
              <select
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

            <label>
              Período:
              <select
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

            <label>
              Usuário (nome ou e-mail):
              <input
                type="text"
                value={searchInput}
                placeholder="Digite e pressione Enter"
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyTextFilters();
                }}
                className="filter-input"
              />
            </label>

            <label>
              IP:
              <input
                type="text"
                value={ipInput}
                placeholder="Ex.: 192.168.0.1"
                onChange={(e) => setIpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyTextFilters();
                }}
                className="filter-input filter-ip"
              />
            </label>

            <label>
              De:
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPeriodFilter("all"); setPage(1); }} />
            </label>
            <label>
              Até:
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPeriodFilter("all"); setPage(1); }} />
            </label>
            <div className="filter-actions">
              <Button onClick={applyTextFilters} disabled={loading}>Aplicar filtros</Button>
              {activeFilterCount > 0 && (
                <button type="button" className="clear-filters" onClick={clearFilters}>
                  Limpar
                </button>
              )}
            </div>
          </div>

          <div className="filter-panel-footer">
          {meta && (
            <div className="total-info">
              <strong>{meta.total}</strong> registro(s) encontrado(s)
            </div>
          )}
          <div className="copy-logs-control">
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
          <Pagination>
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
