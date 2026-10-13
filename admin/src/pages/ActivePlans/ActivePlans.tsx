import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import {
    ActionButton,
    Badge,
    Button,
    Container,
    EmptyState,
    ErrorMessage,
    FiltersSection,
    Input,
    MainContent,
    PageTitle,
    Pagination,
    Select,
    Table,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
} from "../../components/ui/StyledComponents";
import api from "../../services/api";

interface User {
  id: number;
  name: string;
  email: string;
}

interface Plan {
  id: number;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  currentDay: number;
  totalDays: number;
  completedChapters: number;
  totalChapters: number;
  createdAt: string;
  user: User;
  stats: {
    totalProgress: number;
    completedDays: number;
    completionPercentage: number;
  };
}

interface PaginationMeta {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  firstPage: number;
}

const ActivePlans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchPlans = async (page = 1) => {
    try {
      setLoading(true);
      setError("");

      const params: any = {
        page,
        limit: perPage,
      };

      if (search) params.search = search;
      if (statusFilter !== "all") params.isActive = statusFilter === "active";

      const response = await api.get("/admin/reading-plans/all", { params });

      if (response.data.success) {
        setPlans(response.data.data.plans);
        setMeta(response.data.data.meta);
        setCurrentPage(page);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao carregar planos");
      console.error("Erro ao buscar planos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans(1);
  }, [search, statusFilter, perPage]);

  const handleDisablePlan = async (planId: number) => {
    if (!confirm("Tem certeza que deseja desabilitar este plano?")) return;

    try {
      setActionLoading(planId);
      const response = await api.patch(
        `/admin/reading-plans/${planId}/disable`,
      );

      if (response.data.success) {
        alert("Plano desabilitado com sucesso!");
        fetchPlans(currentPage);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Erro ao desabilitar plano");
      console.error("Erro:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnablePlan = async (planId: number) => {
    if (!confirm("Tem certeza que deseja reativar este plano?")) return;

    try {
      setActionLoading(planId);
      const response = await api.patch(`/admin/reading-plans/${planId}/enable`);

      if (response.data.success) {
        alert("Plano reativado com sucesso!");
        fetchPlans(currentPage);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Erro ao reativar plano");
      console.error("Erro:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const getTypeBadge = (type: string) => {
    const types: Record<string, string> = {
      sequential: "Sequencial",
      interleaved: "Intercalado",
      "nt-100": "NT 100 Dias",
      yearly: "Anual",
      custom: "Personalizado",
    };
    return types[type] || type;
  };

  return (
    <Container>
      <Sidebar />
      <MainContent>
        <PageTitle>Gerenciar Planos de Leitura</PageTitle>

        <FiltersSection className="sticky top-3 z-40 rounded-2xl border border-white/80 bg-white/60 p-4 shadow-[0_8px_28px_rgba(110,69,135,0.08)] backdrop-blur-xl">
          <Input
            type="text"
            placeholder="Buscar por nome, email do usuário ou nome do plano..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </Select>
        </FiltersSection>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        {loading ? (
          <p>Carregando planos...</p>
        ) : plans.length === 0 ? (
          <EmptyState>Nenhum plano encontrado</EmptyState>
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>ID</Th>
                  <Th>Usuário</Th>
                  <Th>Nome do Plano</Th>
                  <Th>Tipo</Th>
                  <Th>Período</Th>
                  <Th>Progresso</Th>
                  <Th>Status</Th>
                  <Th>Ações</Th>
                </Tr>
              </Thead>
              <Tbody>
                {plans.map((plan) => (
                  <Tr key={plan.id}>
                    <Td>{plan.id}</Td>
                    <Td>
                      <div>
                        <strong>{plan.user.name}</strong>
                        <br />
                        <small style={{ color: "var(--color-text-secondary)" }}>
                          {plan.user.email}
                        </small>
                      </div>
                    </Td>
                    <Td>{plan.name}</Td>
                    <Td>
                      <Badge type="info">{getTypeBadge(plan.type)}</Badge>
                    </Td>
                    <Td>
                      {formatDate(plan.startDate)} até{" "}
                      {formatDate(plan.endDate)}
                      <br />
                      <small style={{ color: "var(--color-text-secondary)" }}>
                        Dia {plan.currentDay} de {plan.totalDays}
                      </small>
                    </Td>
                    <Td>
                      <div>
                        <strong>{plan.stats.completionPercentage}%</strong>
                        <br />
                        <small style={{ color: "var(--color-text-secondary)" }}>
                          {plan.stats.completedDays}/{plan.totalDays} dias
                        </small>
                        <br />
                        <small style={{ color: "var(--color-text-secondary)" }}>
                          {plan.completedChapters}/{plan.totalChapters} caps
                        </small>
                      </div>
                    </Td>
                    <Td>
                      {plan.isActive ? (
                        <Badge type="success">Ativo</Badge>
                      ) : (
                        <Badge type="error">Inativo</Badge>
                      )}
                    </Td>
                    <Td>
                      {plan.isActive ? (
                        <ActionButton
                          onClick={() => handleDisablePlan(plan.id)}
                          disabled={actionLoading === plan.id}
                          style={{ backgroundColor: "#dc3545" }}
                        >
                          {actionLoading === plan.id
                            ? "Desabilitando..."
                            : "Desabilitar"}
                        </ActionButton>
                      ) : (
                        <ActionButton
                          onClick={() => handleEnablePlan(plan.id)}
                          disabled={actionLoading === plan.id}
                          style={{ backgroundColor: "#28a745" }}
                        >
                          {actionLoading === plan.id
                            ? "Reativando..."
                            : "Reativar"}
                        </ActionButton>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            {meta && (
              <Pagination className="justify-between rounded-2xl border border-white/80 bg-white/60 px-5 py-3 shadow-[var(--shadow-sm)] backdrop-blur-xl">
                <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
                  Itens por página
                  <select
                    aria-label="Itens por página"
                    value={perPage}
                    onChange={(event) => {
                      setPerPage(Number(event.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-[var(--color-border-strong)] bg-white/75 px-3 py-2 text-xs"
                  >
                    {[10, 20, 50, 100].map((count) => (
                      <option key={count} value={count}>{count}</option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-4">
                  <Button onClick={() => fetchPlans(currentPage - 1)} disabled={currentPage === 1}>
                    Anterior
                  </Button>
                  <span>Página {currentPage} de {meta.lastPage}</span>
                  <Button onClick={() => fetchPlans(currentPage + 1)} disabled={currentPage === meta.lastPage}>
                    Próxima
                  </Button>
                </div>
              </Pagination>
            )}
          </>
        )}
      </MainContent>
    </Container>
  );
};

export default ActivePlans;
