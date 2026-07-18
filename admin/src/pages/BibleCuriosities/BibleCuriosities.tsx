import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Toast from "../../components/Toast";
import {
    ActionButton,
    Badge,
    Button,
    EmptyState,
    MainContent,
    PageTitle,
    Select,
    Table,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
} from "../../components/ui/StyledComponents";
import bibleCuriositiesService from "../../services/bibleCuriositiesService";
import "./BibleCuriosities.css";

interface BibleCuriosity {
  id: number;
  content: string;
  theme: string | null;
  date: string;
  isActive: boolean;
  createdAt: string;
}

type FilterStatus = "all" | "active" | "inactive";

export default function BibleCuriosities() {
  const [loading, setLoading] = useState(true);
  const [curiosities, setCuriosities] = useState<BibleCuriosity[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    content: "",
    theme: "",
    date: "",
  });
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    content: "",
    theme: "",
    date: new Date().toISOString().split("T")[0],
    isActive: false,
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadCuriosities();
  }, [currentPage, filter]);

  const loadCuriosities = async () => {
    try {
      setLoading(true);
      const isActiveParam =
        filter === "all" ? undefined : filter === "active" ? "true" : "false";
      const data = await bibleCuriositiesService.listAll(
        currentPage,
        20,
        isActiveParam,
      );
      setCuriosities(data.data);
      setTotalPages(data.meta.lastPage);
    } catch (error) {
      console.error("Erro ao carregar curiosidades:", error);
      alert("Erro ao carregar curiosidades bíblicas");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (curiosity: BibleCuriosity) => {
    setEditingId(curiosity.id);
    setEditForm({
      content: curiosity.content,
      theme: curiosity.theme || "",
      date: curiosity.date,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ content: "", theme: "", date: "" });
  };

  const handleSaveEdit = async (id: number) => {
    try {
      setActionLoading(id);
      await bibleCuriositiesService.update(id, editForm);
      alert("✅ Curiosidade atualizada com sucesso!");
      setEditingId(null);
      await loadCuriosities();
    } catch (error: any) {
      console.error("Erro ao atualizar:", error);
      alert(`Erro ao atualizar curiosidade: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    const action = currentStatus ? "desativar" : "ativar";
    if (!confirm(`Tem certeza que deseja ${action} esta curiosidade?`)) {
      return;
    }

    try {
      setActionLoading(id);
      await bibleCuriositiesService.toggleActive(id);
      alert(
        `✅ Curiosidade ${currentStatus ? "desativada" : "ativada"} com sucesso!`,
      );
      await loadCuriosities();
    } catch (error: any) {
      console.error("Erro ao alternar status:", error);
      alert(`Erro ao ${action} curiosidade: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number, content: string) => {
    if (
      !confirm(
        `Tem certeza que deseja deletar esta curiosidade?\n\n"${content.substring(0, 100)}..."`,
      )
    ) {
      return;
    }

    try {
      setActionLoading(id);
      await bibleCuriositiesService.delete(id);
      alert("✅ Curiosidade deletada com sucesso!");
      await loadCuriosities();
    } catch (error: any) {
      console.error("Erro ao deletar:", error);
      alert(`Erro ao deletar curiosidade: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      await bibleCuriositiesService.generate();
      setToast({
        message:
          "Curiosidade gerada com sucesso! A curiosidade foi criada como INATIVA.",
        type: "success",
      });
      // Recarregar mostrando inativas para ver a nova
      setFilter("inactive");
      setCurrentPage(1);
      await loadCuriosities();
    } catch (error: any) {
      console.error("Erro ao gerar:", error);
      setToast({
        message: `Erro ao gerar curiosidade: ${error.message}`,
        type: "error",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(curiosities.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert("⚠️ Selecione pelo menos uma curiosidade para deletar");
      return;
    }

    if (
      !confirm(
        `Tem certeza que deseja deletar ${selectedIds.length} curiosidade(s) selecionada(s)?\n\nEsta ação não pode ser desfeita!`,
      )
    ) {
      return;
    }

    try {
      setBulkDeleting(true);
      const result = await bibleCuriositiesService.bulkDelete(selectedIds);
      alert(
        `✅ ${result.deletedCount} curiosidade(s) deletada(s) com sucesso!`,
      );
      setSelectedIds([]);
      await loadCuriosities();
    } catch (error: any) {
      console.error("Erro ao deletar em lote:", error);
      alert(`Erro ao deletar curiosidades: ${error.message}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleCreateManual = async () => {
    if (!createForm.content.trim()) {
      setToast({ message: "O conteúdo é obrigatório", type: "error" });
      return;
    }

    try {
      setCreating(true);
      await bibleCuriositiesService.create(createForm);
      setToast({
        message: "Curiosidade criada com sucesso!",
        type: "success",
      });
      setShowCreateModal(false);
      setCreateForm({
        content: "",
        theme: "",
        date: new Date().toISOString().split("T")[0],
        isActive: false,
      });
      await loadCuriosities();
    } catch (error: any) {
      console.error("Erro ao criar curiosidade:", error);
      setToast({
        message: `Erro ao criar curiosidade: ${error.message}`,
        type: "error",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Sidebar />
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <MainContent>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <div>
            <PageTitle>📖 Curiosidades Bíblicas</PageTitle>
            <p style={{ color: "var(--color-text-secondary)", margin: "0" }}>
              Gerenciar curiosidades geradas por IA e controlar publicação
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <Button onClick={() => setShowCreateModal(true)}>
              ➕ Criar Manual
            </Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? "🔄 Gerando..." : "✨ Gerar com IA"}
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="filters">
          <div className="filter-group">
            <label>Status:</label>
            <Select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as FilterStatus);
                setCurrentPage(1);
              }}
            >
              <option value="all">Todas</option>
              <option value="active">Ativas</option>
              <option value="inactive">Inativas</option>
            </Select>
          </div>

          <div className="filter-info">
            <span className="info-badge">Total: {curiosities.length}</span>
            {selectedIds.length > 0 && (
              <>
                <span
                  className="info-badge"
                  style={{ backgroundColor: "#ff9800" }}
                >
                  {selectedIds.length} selecionada(s)
                </span>
                <Button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  style={{ marginLeft: "10px" }}
                >
                  {bulkDeleting ? "🔄 Deletando..." : "🗑️ Deletar Selecionadas"}
                </Button>
              </>
            )}
          </div>
        </div>

        {loading && <EmptyState>Carregando curiosidades...</EmptyState>}

        {!loading && curiosities.length === 0 && (
          <div className="empty-state">
            <p>📭 Nenhuma curiosidade encontrada</p>
            <p className="empty-hint">
              {filter === "all"
                ? "Gere curiosidades usando o endpoint /curiosities/generate"
                : `Não há curiosidades ${filter === "active" ? "ativas" : "inativas"} no momento`}
            </p>
          </div>
        )}

        {!loading && curiosities.length > 0 && (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th style={{ width: "50px" }}>
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length === curiosities.length &&
                        curiosities.length > 0
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      disabled={curiosities.length === 0}
                    />
                  </Th>
                  <Th style={{ width: "80px" }}>ID</Th>
                  <Th style={{ width: "120px" }}>Data</Th>
                  <Th style={{ width: "150px" }}>Tema</Th>
                  <Th>Conteúdo</Th>
                  <Th style={{ width: "100px" }}>Status</Th>
                  <Th style={{ width: "200px" }}>Ações</Th>
                </Tr>
              </Thead>
              <Tbody>
                {curiosities.map((curiosity) => (
                  <Tr key={curiosity.id}>
                    <Td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(curiosity.id)}
                        onChange={(e) =>
                          handleSelectOne(curiosity.id, e.target.checked)
                        }
                        disabled={editingId === curiosity.id}
                      />
                    </Td>
                    <Td>{curiosity.id}</Td>
                    <Td>
                      {new Date(curiosity.date).toLocaleDateString("pt-BR")}
                    </Td>
                    <Td>
                      {editingId === curiosity.id ? (
                        <input
                          type="text"
                          value={editForm.theme}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              theme: e.target.value,
                            })
                          }
                          placeholder="Tema"
                        />
                      ) : (
                        curiosity.theme || "-"
                      )}
                    </Td>
                    <Td className="content-cell">
                      {editingId === curiosity.id ? (
                        <textarea
                          value={editForm.content}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              content: e.target.value,
                            })
                          }
                          rows={4}
                        />
                      ) : (
                        <div className="content-preview">
                          {curiosity.content}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <Badge type={curiosity.isActive ? "success" : "error"}>
                        {curiosity.isActive ? "✅ Ativa" : "❌ Inativa"}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="actions">
                        {editingId === curiosity.id ? (
                          <>
                            <ActionButton
                              onClick={() => handleSaveEdit(curiosity.id)}
                              disabled={actionLoading === curiosity.id}
                            >
                              {actionLoading === curiosity.id
                                ? "..."
                                : "💾 Salvar"}
                            </ActionButton>
                            <ActionButton
                              onClick={handleCancelEdit}
                              disabled={actionLoading === curiosity.id}
                            >
                              ✖️ Cancelar
                            </ActionButton>
                          </>
                        ) : (
                          <>
                            <ActionButton
                              onClick={() => handleEdit(curiosity)}
                              disabled={actionLoading === curiosity.id}
                              title="Editar"
                            >
                              ✏️
                            </ActionButton>
                            <ActionButton
                              onClick={() =>
                                handleToggleActive(
                                  curiosity.id,
                                  curiosity.isActive,
                                )
                              }
                              disabled={actionLoading === curiosity.id}
                              title={
                                curiosity.isActive ? "Desativar" : "Ativar"
                              }
                            >
                              {actionLoading === curiosity.id
                                ? "..."
                                : curiosity.isActive
                                  ? "⏸️"
                                  : "▶️"}
                            </ActionButton>
                            <ActionButton
                              onClick={() =>
                                handleDelete(curiosity.id, curiosity.content)
                              }
                              disabled={actionLoading === curiosity.id}
                              title="Deletar"
                            >
                              🗑️
                            </ActionButton>
                          </>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="pagination">
                <Button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ← Anterior
                </Button>
                <span className="page-info">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Próxima →
                </Button>
              </div>
            )}
          </>
        )}

        {/* Modal de Criação Manual */}
        {showCreateModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowCreateModal(false)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>➕ Criar Curiosidade Bíblica</h2>
                <button
                  className="close-button"
                  onClick={() => setShowCreateModal(false)}
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>Conteúdo *</label>
                  <textarea
                    value={createForm.content}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, content: e.target.value })
                    }
                    placeholder="Digite o conteúdo da curiosidade..."
                    rows={6}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "6px",
                      border: "1px solid #ddd",
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Tema</label>
                  <input
                    type="text"
                    value={createForm.theme}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, theme: e.target.value })
                    }
                    placeholder="Ex: Milagres, Parábolas, História..."
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "6px",
                      border: "1px solid #ddd",
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Data</label>
                  <input
                    type="date"
                    value={createForm.date}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, date: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "6px",
                      border: "1px solid #ddd",
                    }}
                  />
                </div>

                <div className="form-group">
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={createForm.isActive}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          isActive: e.target.checked,
                        })
                      }
                    />
                    Ativar imediatamente
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    justifyContent: "flex-end",
                    marginTop: "20px",
                  }}
                >
                  <Button
                    onClick={() => setShowCreateModal(false)}
                    disabled={creating}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateManual} disabled={creating}>
                    {creating ? "🔄 Criando..." : "✅ Criar Curiosidade"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </MainContent>
    </>
  );
}
