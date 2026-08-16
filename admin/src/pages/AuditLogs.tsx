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
  const [page, setPage] = useState(1);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, periodFilter, search, page]);

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

      if (periodFilter !== "all") {
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
  }, [actionFilter, periodFilter, search, page]);

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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearch(searchInput.trim());
      setPage(1);
    }
  };

  const handlePeriodChange = (value: string) => {
    setPeriodFilter(value);
    setPage(1);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <MainContent>
        <PageTitle>Logs de Auditoria</PageTitle>

        {/* Filtros */}
        <FiltersSection>
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
                onKeyDown={handleSearchKeyDown}
                style={{ padding: "0.5rem", minWidth: "220px" }}
              />
            </label>
          </div>

          {meta && (
            <div className="total-info">
              {meta.total} registro(s)
            </div>
          )}
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