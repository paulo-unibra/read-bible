import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Toast from "../components/Toast";
import {
    ActionButton,
    Badge,
    Button,
    EmptyState,
    ErrorMessage,
    FiltersSection,
    MainContent,
    PageTitle,
    Table,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
} from "../components/ui/StyledComponents";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import "./EmailLogs.css";

interface EmailLog {
  id: number;
  userId: number | null;
  email: string;
  subject: string;
  message: string;
  status: "success" | "failed";
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  user: {
    id: number;
    fullName: string;
    email: string;
  } | null;
}

interface EmailStats {
  success: number;
  failed: number;
  total: number;
}

const EmailLogs: React.FC = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState<EmailStats>({
    success: 0,
    failed: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLogs, setSelectedLogs] = useState<Set<number>>(new Set());
  const [retrying, setRetrying] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPermission("gerenciar_usuarios")) {
      navigate("/dashboard");
      return;
    }

    loadLogs();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const loadLogs = async () => {
    setLoading(true);
    setError("");

    try {
      const params = statusFilter !== "all" ? { status: statusFilter } : {};
      const response = await api.get("/admin/email-logs", { params });
      setLogs(response.data.data);
    } catch (err) {
      setError("Erro ao carregar logs de e-mail");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get("/admin/email-logs/stats");
      setStats(response.data);
    } catch (err) {
      console.error("Erro ao carregar estatísticas:", err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleLogSelection = (logId: number) => {
    const newSelected = new Set(selectedLogs);
    if (newSelected.has(logId)) {
      newSelected.delete(logId);
    } else {
      newSelected.add(logId);
    }
    setSelectedLogs(newSelected);
  };

  const toggleSelectAll = () => {
    if (
      selectedLogs.size === logs.filter((l) => l.status === "failed").length
    ) {
      setSelectedLogs(new Set());
    } else {
      setSelectedLogs(
        new Set(logs.filter((l) => l.status === "failed").map((l) => l.id)),
      );
    }
  };

  const handleRetry = async () => {
    if (selectedLogs.size === 0) {
      setError("Selecione pelo menos um e-mail falhado para reenviar");
      return;
    }

    if (
      !window.confirm(
        `Deseja reenviar ${selectedLogs.size} e-mail(s) falhado(s)?`,
      )
    ) {
      return;
    }

    setRetrying(true);
    setError("");

    try {
      const response = await api.post("/admin/email-logs/retry", {
        logIds: Array.from(selectedLogs),
      });

      if (response.data.success) {
        const successMessage = response.data.message ||
          `${response.data.queued} e-mail(s) adicionado(s) à fila de reenvio`;

        setToast({
          message: `${successMessage}. Os e-mails serão reenviados gradualmente. Atualize a página em alguns instantes para ver o resultado.`,
          type: "success",
        });

        setSelectedLogs(new Set());
        // Aguardar um pouco antes de recarregar para dar tempo da fila processar
        setTimeout(() => {
          loadLogs();
          loadStats();
        }, 2000);
      } else {
        setError(response.data.message || "Erro ao reenviar e-mails");
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || "Erro ao reenviar e-mails");
      console.error(err);
    } finally {
      setRetrying(false);
    }
  };

  const handleShowDetails = (log: EmailLog) => {
    setSelectedLog(log);
    setShowDetailsModal(true);
  };

  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedLog(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge type="success">✓ Enviado</Badge>;
      case "failed":
        return <Badge type="error">✗ Falhou</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const failedLogs = logs.filter((l) => l.status === "failed");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <MainContent>
        <PageTitle>Logs de E-mails</PageTitle>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        {/* Estatísticas */}
        <div className="email-stats">
          <div className="stat-card">
            <div className="stat-label">Total</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card stat-success">
            <div className="stat-label">Enviados</div>
            <div className="stat-value">{stats.success}</div>
          </div>
          <div className="stat-card stat-failed">
            <div className="stat-label">Falhados</div>
            <div className="stat-value">{stats.failed}</div>
          </div>
        </div>

        {/* Filtros */}
        <FiltersSection>
          <div className="filters-group">
            <label>
              Status:
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos ({stats.total})</option>
                <option value="success">Enviados ({stats.success})</option>
                <option value="failed">Falhados ({stats.failed})</option>
              </select>
            </label>
          </div>

          {failedLogs.length > 0 && (
            <div className="actions-group">
              <Button
                onClick={toggleSelectAll}
                disabled={retrying || failedLogs.length === 0}
              >
                {selectedLogs.size === failedLogs.length
                  ? "Desmarcar Todos"
                  : "Selecionar Todos"}
              </Button>

              <Button
                onClick={handleRetry}
                disabled={retrying || selectedLogs.size === 0}
                style={{ backgroundColor: "#4ecca3", color: "white" }}
              >
                {retrying ? "Reenviando..." : `Reenviar (${selectedLogs.size})`}
              </Button>
            </div>
          )}
        </FiltersSection>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            Carregando logs...
          </div>
        ) : logs.length === 0 ? (
          <EmptyState>Nenhum log de e-mail encontrado</EmptyState>
        ) : (
          <Table>
            <Thead>
              <Tr>
                {failedLogs.length > 0 && statusFilter !== "success" && (
                  <Th style={{ width: "50px" }}>
                    <input
                      type="checkbox"
                      checked={
                        selectedLogs.size > 0 &&
                        selectedLogs.size === failedLogs.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </Th>
                )}
                <Th>Status</Th>
                <Th>Destinatário</Th>
                <Th>Assunto</Th>
                <Th>Data/Hora</Th>
                <Th style={{ width: "150px" }}>Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {logs.map((log) => (
                <Tr key={log.id}>
                  {failedLogs.length > 0 && statusFilter !== "success" && (
                    <Td>
                      {log.status === "failed" && (
                        <input
                          type="checkbox"
                          checked={selectedLogs.has(log.id)}
                          onChange={() => toggleLogSelection(log.id)}
                        />
                      )}
                    </Td>
                  )}
                  <Td>{getStatusBadge(log.status)}</Td>
                  <Td>
                    <div>
                      <strong>
                        {log.user?.fullName || "Usuário removido"}
                      </strong>
                    </div>
                    <div style={{ fontSize: "0.9em", color: "#666" }}>
                      {log.email}
                    </div>
                  </Td>
                  <Td>
                    <div className="subject-cell">{log.subject}</div>
                  </Td>
                  <Td>
                    {log.sentAt
                      ? formatDate(log.sentAt)
                      : formatDate(log.createdAt)}
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
      </MainContent>

      {/* Modal de Detalhes */}
      {showDetailsModal && selectedLog && (
        <div className="modal-overlay" onClick={handleCloseDetailsModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalhes do E-mail</h2>
              <button className="modal-close" onClick={handleCloseDetailsModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-row">
                <strong>Status:</strong>
                {getStatusBadge(selectedLog.status)}
              </div>

              <div className="detail-row">
                <strong>Destinatário:</strong>
                <div>
                  {selectedLog.user?.fullName || "Usuário removido"} (
                  {selectedLog.email})
                </div>
              </div>

              <div className="detail-row">
                <strong>Assunto:</strong>
                <div>{selectedLog.subject}</div>
              </div>

              <div className="detail-row">
                <strong>Mensagem:</strong>
                <div className="message-box">{selectedLog.message}</div>
              </div>

              {selectedLog.errorMessage && (
                <div className="detail-row error-box">
                  <strong>Erro:</strong>
                  <div>{selectedLog.errorMessage}</div>
                </div>
              )}

              <div className="detail-row">
                <strong>Data/Hora:</strong>
                <div>
                  {selectedLog.sentAt
                    ? formatDate(selectedLog.sentAt)
                    : formatDate(selectedLog.createdAt)}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <Button onClick={handleCloseDetailsModal}>Fechar</Button>
              {selectedLog.status === "failed" && (
                <Button
                  onClick={() => {
                    handleCloseDetailsModal();
                    setSelectedLogs(new Set([selectedLog.id]));
                    setTimeout(() => handleRetry(), 100);
                  }}
                  disabled={retrying}
                  style={{ backgroundColor: "#4ecca3", color: "white" }}
                >
                  Reenviar Este E-mail
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailLogs;
