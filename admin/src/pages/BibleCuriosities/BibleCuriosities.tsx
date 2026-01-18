import { useEffect, useState } from "react";
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
    if (
      !confirm(
        "Gerar uma nova curiosidade bíblica com IA?\n\nA curiosidade será criada INATIVA e precisará ser revisada e ativada manualmente.",
      )
    ) {
      return;
    }

    try {
      setGenerating(true);
      await bibleCuriositiesService.generate();
      alert(
        "✅ Curiosidade gerada com sucesso!\n\nA curiosidade foi criada como INATIVA. Revise o conteúdo e ative quando estiver pronta.",
      );
      // Recarregar mostrando inativas para ver a nova
      setFilter("inactive");
      setCurrentPage(1);
      await loadCuriosities();
    } catch (error: any) {
      console.error("Erro ao gerar:", error);
      alert(`Erro ao gerar curiosidade: ${error.message}`);
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

  return (
    <div className="bible-curiosities">
      <header className="bible-curiosities-header">
        <div className="header-content">
          <div className="header-title">
            <div>
              <h1>📖 Curiosidades Bíblicas</h1>
              <p className="subtitle">
                Gerenciar curiosidades geradas por IA e controlar publicação
              </p>
            </div>
            <button
              className="btn btn-primary btn-generate"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? "🔄 Gerando..." : "✨ Gerar com IA"}
            </button>
          </div>
        </div>
      </header>

      <div className="content">
        {/* Filtros */}
        <div className="filters">
          <div className="filter-group">
            <label>Status:</label>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as FilterStatus);
                setCurrentPage(1);
              }}
            >
              <option value="all">Todas</option>
              <option value="active">Ativas</option>
              <option value="inactive">Inativas</option>
            </select>
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
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  style={{ marginLeft: "10px" }}
                >
                  {bulkDeleting ? "🔄 Deletando..." : "🗑️ Deletar Selecionadas"}
                </button>
              </>
            )}
          </div>
        </div>

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Carregando curiosidades...</p>
          </div>
        )}

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
            <div className="table-container">
              <table className="curiosities-table">
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.length === curiosities.length &&
                          curiosities.length > 0
                        }
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        disabled={curiosities.length === 0}
                      />
                    </th>
                    <th style={{ width: "80px" }}>ID</th>
                    <th style={{ width: "120px" }}>Data</th>
                    <th style={{ width: "150px" }}>Tema</th>
                    <th>Conteúdo</th>
                    <th style={{ width: "100px" }}>Status</th>
                    <th style={{ width: "200px" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {curiosities.map((curiosity) => (
                    <tr key={curiosity.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(curiosity.id)}
                          onChange={(e) =>
                            handleSelectOne(curiosity.id, e.target.checked)
                          }
                          disabled={editingId === curiosity.id}
                        />
                      </td>
                      <td>{curiosity.id}</td>
                      <td>
                        {new Date(curiosity.date).toLocaleDateString("pt-BR")}
                      </td>
                      <td>
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
                      </td>
                      <td className="content-cell">
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
                      </td>
                      <td>
                        <span
                          className={`status-badge ${curiosity.isActive ? "active" : "inactive"}`}
                        >
                          {curiosity.isActive ? "✅ Ativa" : "❌ Inativa"}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          {editingId === curiosity.id ? (
                            <>
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleSaveEdit(curiosity.id)}
                                disabled={actionLoading === curiosity.id}
                              >
                                {actionLoading === curiosity.id
                                  ? "..."
                                  : "💾 Salvar"}
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={handleCancelEdit}
                                disabled={actionLoading === curiosity.id}
                              >
                                ✖️ Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleEdit(curiosity)}
                                disabled={actionLoading === curiosity.id}
                                title="Editar"
                              >
                                ✏️
                              </button>
                              <button
                                className={`btn ${curiosity.isActive ? "btn-warning" : "btn-success"} btn-sm`}
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
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() =>
                                  handleDelete(curiosity.id, curiosity.content)
                                }
                                disabled={actionLoading === curiosity.id}
                                title="Deletar"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ← Anterior
                </button>
                <span className="page-info">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Próxima →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
