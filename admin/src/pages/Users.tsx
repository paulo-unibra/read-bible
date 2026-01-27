import React, { useEffect, useState } from "react";
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
    Table,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
} from "../components/ui/StyledComponents";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import "./Users.css";

interface Role {
  id: number;
  name: string;
  slug: string;
}

interface ReadingStatus {
  status: "no_plan" | "not_started" | "late" | "up_to_date";
  currentDay: number;
  totalDays: number;
  completedDays: number;
  daysLate: number;
  planName: string | null;
}

interface ConvertiblePlan {
  id: number;
  name: string;
  type: string;
  totalDays: number;
  currentDay: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  completedChapters: number;
}

interface User {
  id: number;
  email: string;
  fullName: string | null;
  roles: Role[];
  createdAt: string;
  readingStatus: ReadingStatus;
}

interface UserStats {
  all: number;
  up_to_date: number;
  late: number;
  not_started: number;
  no_plan: number;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats>({
    all: 0,
    up_to_date: 0,
    late: 0,
    not_started: 0,
    no_plan: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [convertiblePlans, setConvertiblePlans] = useState<ConvertiblePlan[]>(
    [],
  );
  const [selectedPlan, setSelectedPlan] = useState<ConvertiblePlan | null>(
    null,
  );
  const [converting, setConverting] = useState(false);
  const [showRecalculateModal, setShowRecalculateModal] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const { hasPermission, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPermission("gerenciar_usuarios")) {
      navigate("/dashboard");
      return;
    }

    loadUsers();
    loadStats();
  }, [statusFilter]);

  const loadUsers = async () => {
    setLoading(true);
    setError("");

    try {
      const params =
        statusFilter !== "all" ? { readingStatus: statusFilter } : {};
      const response = await api.get("/admin/users", { params });
      setUsers(response.data);
    } catch (err: any) {
      setError("Erro ao carregar usuários");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get("/admin/users/stats");
      setStats(response.data);
    } catch (err: any) {
      console.error("Erro ao carregar estatísticas:", err);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleOpenConvertModal = async (user: User) => {
    setSelectedUser(user);
    setError("");

    try {
      const response = await api.get(
        `/admin/users/${user.id}/convertible-plans`,
      );
      setConvertiblePlans(response.data.convertiblePlans);

      if (response.data.convertiblePlans.length === 0) {
        setError("Este usuário não possui planos com mais de 365 dias.");
        return;
      }

      setShowConvertModal(true);
    } catch (err: any) {
      setError("Erro ao buscar planos convertíveis");
      console.error(err);
    }
  };

  const handleCloseConvertModal = () => {
    setShowConvertModal(false);
    setSelectedUser(null);
    setConvertiblePlans([]);
    setSelectedPlan(null);
    setConverting(false);
  };

  const handleConfirmConvert = async () => {
    if (!selectedUser || !selectedPlan) return;

    setConverting(true);
    setError("");

    try {
      const response = await api.post(
        `/admin/users/${selectedUser.id}/convert-plan`,
        {
          planId: selectedPlan.id,
        },
      );

      if (response.data.success) {
        alert(
          `✅ Plano convertido com sucesso!\n\n` +
            `• Dias anteriores: ${response.data.oldTotalDays}\n` +
            `• Novos dias: ${response.data.newTotalDays}\n` +
            `• Progresso mantido: ${response.data.progressMaintained} leituras`,
        );

        handleCloseConvertModal();
        loadUsers();
        loadStats();
      } else {
        setError(response.data.message || "Erro ao converter plano");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Erro ao converter plano");
      console.error(err);
    } finally {
      setConverting(false);
    }
  };

  const handleOpenRecalculateModal = async (user: User) => {
    setSelectedUser(user);
    setError("");

    // Para recalcular, usamos o plano ativo do usuário
    if (!user.readingStatus.planName) {
      setError("Este usuário não possui um plano ativo.");
      return;
    }

    setShowRecalculateModal(true);
  };

  const handleCloseRecalculateModal = () => {
    setShowRecalculateModal(false);
    setSelectedUser(null);
    setRecalculating(false);
  };

  const handleConfirmRecalculate = async () => {
    if (!selectedUser) return;

    setRecalculating(true);
    setError("");

    try {
      // O backend busca automaticamente o plano ativo se não enviarmos planId
      const response = await api.post(
        `/admin/users/${selectedUser.id}/recalculate-plan`,
      );

      if (response.data.success) {
        alert(
          `✅ Plano recalculado com sucesso!\n\n` +
            `• Leituras corrigidas: ${response.data.correctedReadings}\n` +
            `• Progresso mantido: ${response.data.progressMaintained} dias`,
        );

        handleCloseRecalculateModal();
        loadUsers();
        loadStats();
      } else {
        setError(response.data.message || "Erro ao recalcular plano");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Erro ao recalcular plano");
      console.error(err);
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <>
      <Sidebar />
      <MainContent>
        <PageTitle>Gerenciamento de Usuários</PageTitle>

        <FiltersSection>
          <Button
            className={statusFilter === "all" ? "active" : ""}
            onClick={() => setStatusFilter("all")}
          >
            📊 Todos ({stats.all})
          </Button>
          <Button
            className={statusFilter === "up_to_date" ? "active" : ""}
            onClick={() => setStatusFilter("up_to_date")}
          >
            ✅ Em dia ({stats.up_to_date})
          </Button>
          <Button
            className={statusFilter === "late" ? "active" : ""}
            onClick={() => setStatusFilter("late")}
          >
            ⚠️ Atrasados ({stats.late})
          </Button>
          <Button
            className={statusFilter === "not_started" ? "active" : ""}
            onClick={() => setStatusFilter("not_started")}
          >
            ⏸️ Não iniciaram ({stats.not_started})
          </Button>
          <Button
            className={statusFilter === "no_plan" ? "active" : ""}
            onClick={() => setStatusFilter("no_plan")}
          >
            📝 Sem plano ({stats.no_plan})
          </Button>
        </FiltersSection>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        {loading ? (
          <EmptyState>Carregando usuários...</EmptyState>
        ) : users.length === 0 ? (
          <EmptyState>Nenhum usuário encontrado</EmptyState>
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>ID</Th>
                <Th>Nome</Th>
                <Th>E-mail</Th>
                <Th>Roles</Th>
                <Th>Status de Leitura</Th>
                <Th>Criado em</Th>
                <Th>Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {users.map((user) => (
                <Tr key={user.id}>
                  <Td>{user.id}</Td>
                  <Td>{user.fullName || "-"}</Td>
                  <Td>{user.email}</Td>
                  <Td>
                    <div className="roles-cell">
                      {user.roles.map((role) => (
                        <Badge key={role.id} type="info">
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    {user.readingStatus.status === "up_to_date" && (
                      <Badge type="success">
                        ✅ Em dia ({user.readingStatus.currentDay}/
                        {user.readingStatus.totalDays})
                      </Badge>
                    )}
                    {user.readingStatus.status === "late" && (
                      <Badge type="warning">
                        ⚠️ Atrasado ({user.readingStatus.daysLate}{" "}
                        {user.readingStatus.daysLate === 1 ? "dia" : "dias"})
                      </Badge>
                    )}
                    {user.readingStatus.status === "not_started" && (
                      <Badge type="info">⏸️ Não iniciou</Badge>
                    )}
                    {user.readingStatus.status === "no_plan" && (
                      <Badge>📝 Sem plano</Badge>
                    )}
                  </Td>
                  <Td>{formatDate(user.createdAt)}</Td>
                  <Td>
                    <div className="action-buttons">
                      {user.readingStatus.planName && (
                        <ActionButton
                          onClick={() => handleOpenRecalculateModal(user)}
                          title="Recalcular livros do plano"
                        >
                          📚
                        </ActionButton>
                      )}
                      {user.readingStatus.totalDays > 365 && (
                        <ActionButton
                          onClick={() => handleOpenConvertModal(user)}
                          title="Converter plano para 365 dias"
                        >
                          🔄
                        </ActionButton>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <div className="info-box">
          <p>
            <strong>ℹ️ Funcionalidade em desenvolvimento</strong>
          </p>
          <p>As seguintes ações serão implementadas em breve:</p>
          <ul>
            <li>Criar novos usuários</li>
            <li>Editar informações de usuários</li>
            <li>Excluir usuários</li>
            <li>Atribuir/remover roles</li>
            <li>Buscar e filtrar usuários</li>
            <li>Paginação</li>
          </ul>
        </div>

        {/* Modal de Conversão */}
        {showConvertModal && (
          <div className="modal-overlay" onClick={handleCloseConvertModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🔄 Converter Plano para 365 Dias</h2>
                <button
                  className="modal-close"
                  onClick={handleCloseConvertModal}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <p className="modal-user-info">
                  <strong>Usuário:</strong>{" "}
                  {selectedUser?.fullName || selectedUser?.email}
                </p>

                {error && <div className="error-message">{error}</div>}

                {convertiblePlans.length === 0 ? (
                  <p>Carregando planos...</p>
                ) : (
                  <>
                    <p className="modal-description">
                      Este usuário possui {convertiblePlans.length} plano(s) com
                      mais de 365 dias. Selecione qual plano deseja converter:
                    </p>

                    <div className="plans-list">
                      {convertiblePlans.map((plan) => (
                        <div
                          key={plan.id}
                          className={`plan-item ${selectedPlan?.id === plan.id ? "selected" : ""}`}
                          onClick={() => setSelectedPlan(plan)}
                        >
                          <div className="plan-info">
                            <h3>{plan.name}</h3>
                            <p className="plan-stats">
                              📊 {plan.totalDays} dias (será convertido para
                              365)
                            </p>
                            <p className="plan-stats">
                              📖 Dia atual: {plan.currentDay} | Capítulos lidos:{" "}
                              {plan.completedChapters}
                            </p>
                            <p className="plan-dates">
                              📅 {formatDate(plan.startDate)} →{" "}
                              {formatDate(plan.endDate)}
                            </p>
                            {plan.isActive && (
                              <span className="plan-badge">Ativo</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedPlan && (
                      <div className="warning-box">
                        <h4>⚠️ Atenção!</h4>
                        <p>
                          Esta ação irá redistribuir as leituras do plano "
                          <strong>{selectedPlan.name}</strong>" para caber em
                          365 dias, mantendo todo o progresso já realizado.
                        </p>
                        <p>
                          <strong>O que será feito:</strong>
                        </p>
                        <ul>
                          <li>
                            ✅ Progresso mantido (leituras completadas não serão
                            perdidas)
                          </li>
                          <li>
                            🔄 Leituras redistribuídas proporcionalmente em 365
                            dias
                          </li>
                          <li>
                            📅 Data de início ajustada para 1º de janeiro do ano
                            atual
                          </li>
                          <li>
                            📅 Data de término ajustada para 31 de dezembro do
                            ano atual
                          </li>
                        </ul>
                        <p className="warning-text">
                          <strong>Esta ação não pode ser desfeita!</strong>
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button
                  className="btn-secondary"
                  onClick={handleCloseConvertModal}
                  disabled={converting}
                >
                  Cancelar
                </button>
                <button
                  className="btn-danger"
                  onClick={handleConfirmConvert}
                  disabled={!selectedPlan || converting}
                >
                  {converting ? "Convertendo..." : "Confirmar Conversão"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Recálculo */}
        {showRecalculateModal && (
          <div className="modal-overlay" onClick={handleCloseRecalculateModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📚 Recalcular Livros do Plano</h2>
                <button
                  className="modal-close"
                  onClick={handleCloseRecalculateModal}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <p className="modal-user-info">
                  <strong>Usuário:</strong>{" "}
                  {selectedUser?.fullName || selectedUser?.email}
                </p>
                <p className="modal-user-info">
                  <strong>Plano:</strong> {selectedUser?.readingStatus.planName}
                </p>

                {error && <div className="error-message">{error}</div>}

                <div className="info-box-modal">
                  <h4>ℹ️ Sobre esta operação</h4>
                  <p>
                    Esta funcionalidade corrige um erro antigo onde o mesmo
                    livro aparecia múltiplas vezes no mesmo dia (exemplo:
                    Gênesis 49-50 e Gênesis 1-2 em vez de Gênesis 49-50 e Êxodo
                    1-2).
                  </p>
                  <p>
                    <strong>O que será feito:</strong>
                  </p>
                  <ul>
                    <li>
                      ✅ Recalcula todas as leituras do plano sequencialmente
                    </li>
                    <li>
                      ✅ Mantém o progresso (dias já lidos permanecem marcados)
                    </li>
                    <li>✅ Corrige os nomes dos livros nas leituras</li>
                    <li>
                      📖 Distribui os capítulos corretamente entre os livros
                    </li>
                  </ul>
                </div>

                <div className="warning-box">
                  <h4>⚠️ Atenção!</h4>
                  <p>
                    Esta ação recalculará todos os livros do plano ativo do
                    usuário.
                  </p>
                  <p className="warning-text">
                    <strong>
                      O progresso será mantido, mas a distribuição dos livros
                      será refeita!
                    </strong>
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn-secondary"
                  onClick={handleCloseRecalculateModal}
                  disabled={recalculating}
                >
                  Cancelar
                </button>
                <button
                  className="btn-danger"
                  onClick={handleConfirmRecalculate}
                  disabled={recalculating}
                >
                  {recalculating ? "Recalculando..." : "Confirmar Recálculo"}
                </button>
              </div>
            </div>
          </div>
        )}
      </MainContent>
    </>
  );
};

export default Users;
