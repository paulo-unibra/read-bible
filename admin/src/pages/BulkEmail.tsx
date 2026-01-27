import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import "./BulkEmail.css";

interface UserWithPlan {
  id: number;
  email: string;
  fullName: string;
  plan: {
    id: number;
    name: string;
    totalDays: number;
    daysCompleted: number;
    expectedDays: number;
    percentComplete: number;
  };
}

type EmailStatus = "em_dia" | "adiantado" | "atrasado";

const statusOptions = [
  { value: "em_dia" as EmailStatus, label: "✅ Em Dia", color: "#4CAF50" },
  {
    value: "adiantado" as EmailStatus,
    label: "🌟 Adiantado",
    color: "#2196F3",
  },
  { value: "atrasado" as EmailStatus, label: "📖 Atrasado", color: "#FF9800" },
];

function BulkEmail() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedStatus, setSelectedStatus] = useState<EmailStatus>("em_dia");
  const [users, setUsers] = useState<UserWithPlan[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [selectedStatus, user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/bulk-email/users`, {
        params: { status: selectedStatus },
      });

      if (response.data.success) {
        setUsers(response.data.users);
        setSelectedUsers(new Set()); // Limpar seleção ao mudar filtro
      }
    } catch (error: any) {
      console.error("Erro ao buscar usuários:", error);
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Erro ao carregar usuários",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: number) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map((u) => u.id)));
    }
  };

  const sendEmails = async () => {
    if (selectedUsers.size === 0) {
      setMessage({ type: "error", text: "Selecione pelo menos um usuário" });
      return;
    }

    const confirm = window.confirm(
      `Deseja enviar e-mails para ${selectedUsers.size} usuário(s)?\n\n` +
        `${
          import.meta.env.MODE === "development"
            ? "⚠️ MODO DESENVOLVIMENTO: Todos os e-mails serão enviados para o e-mail de teste configurado no backend."
            : "✓ MODO PRODUÇÃO: Os e-mails serão enviados para os e-mails reais dos usuários."
        }`,
    );

    if (!confirm) return;

    try {
      setSending(true);
      setSendProgress({ current: 0, total: selectedUsers.size });

      const response = await api.post("/admin/bulk-email/send", {
        userIds: Array.from(selectedUsers),
        status: selectedStatus,
      });

      if (response.data.success) {
        const { results } = response.data;
        setMessage({
          type: "success",
          text: `E-mails enviados! ✓ Sucesso: ${results.success} | ✗ Falhas: ${results.failed}`,
        });

        if (results.failed > 0) {
          console.error("Erros no envio:", results.errors);
        }

        // Limpar seleção
        setSelectedUsers(new Set());
      }
    } catch (error: any) {
      console.error("Erro ao enviar e-mails:", error);
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Erro ao enviar e-mails",
      });
    } finally {
      setSending(false);
      setSendProgress({ current: 0, total: 0 });
    }
  };

  const currentStatus = statusOptions.find((s) => s.value === selectedStatus)!;

  return (
    <>
      <Sidebar />
      <div className="bulk-email-page">
        <div className="bulk-email-header">
          <div>
            <button
              onClick={() => navigate("/dashboard")}
              className="back-button"
            >
              ← Voltar
            </button>
            <h1>📧 Envio de E-mails em Lote</h1>
            <p className="subtitle">
              Envie e-mails personalizados baseados no status de leitura dos
              usuários
            </p>
          </div>
        </div>

        {/* Modo de desenvolvimento aviso */}
        {import.meta.env.MODE === "development" && (
          <div className="dev-warning">
            ⚠️ <strong>Modo Desenvolvimento:</strong> Todos os e-mails serão
            enviados para o e-mail de teste configurado
          </div>
        )}

        {/* Filtros de Status */}
        <div className="filter-section">
          <h2>Selecione o Público-Alvo</h2>
          <div className="status-filters">
            {statusOptions.map((status) => (
              <button
                key={status.value}
                className={`status-filter ${selectedStatus === status.value ? "active" : ""}`}
                style={
                  selectedStatus === status.value
                    ? {
                        borderColor: status.color,
                        backgroundColor: `${status.color}15`,
                      }
                    : {}
                }
                onClick={() => setSelectedStatus(status.value)}
              >
                <span
                  style={{
                    color: status.color,
                    fontSize: "24px",
                    marginRight: "8px",
                  }}
                >
                  {status.label.split(" ")[0]}
                </span>
                <span>
                  {status.label.substring(status.label.indexOf(" ") + 1)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Mensagens */}
        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
            <button onClick={() => setMessage({ type: "", text: "" })}>
              ×
            </button>
          </div>
        )}

        {/* Lista de Usuários */}
        <div className="users-section">
          <div className="users-header">
            <h2 style={{ color: currentStatus.color }}>
              {currentStatus.label} ({users.length} usuários)
            </h2>
            {users.length > 0 && (
              <div className="bulk-actions">
                <button onClick={toggleSelectAll} className="select-all-btn">
                  {selectedUsers.size === users.length
                    ? "☐ Desmarcar Todos"
                    : "☑ Selecionar Todos"}
                </button>
                <button
                  onClick={sendEmails}
                  disabled={selectedUsers.size === 0 || sending}
                  className="send-btn"
                  style={{ backgroundColor: currentStatus.color }}
                >
                  {sending
                    ? `Enviando... (${sendProgress.current}/${sendProgress.total})`
                    : `✉️ Enviar para ${selectedUsers.size} selecionados`}
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="loading">Carregando usuários...</div>
          ) : users.length === 0 ? (
            <div className="no-users">
              <p>
                Nenhum usuário encontrado com status "{currentStatus.label}"
              </p>
            </div>
          ) : (
            <div className="users-grid">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={`user-card ${selectedUsers.has(user.id) ? "selected" : ""}`}
                  onClick={() => toggleUserSelection(user.id)}
                >
                  <div className="user-card-header">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="user-info">
                      <h3>{user.fullName}</h3>
                      <p className="user-email">{user.email}</p>
                    </div>
                  </div>

                  <div className="plan-info">
                    <h4>{user.plan.name}</h4>
                    <div className="progress-stats">
                      <div className="stat">
                        <span className="stat-label">Lidos:</span>
                        <span className="stat-value">
                          {user.plan.daysCompleted}
                        </span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Esperados:</span>
                        <span className="stat-value">
                          {user.plan.expectedDays}
                        </span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Total:</span>
                        <span className="stat-value">
                          {user.plan.totalDays}
                        </span>
                      </div>
                    </div>

                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(user.plan.percentComplete, 100)}%`,
                          backgroundColor: currentStatus.color,
                        }}
                      >
                        {Math.round(user.plan.percentComplete)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default BulkEmail;
