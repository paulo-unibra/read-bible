import { useEffect, useRef, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Toast from "../../components/Toast";
import {
    ActionButton,
    Badge,
    Button,
    EmptyState,
    Input,
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
import bibleBrainService from "../../services/bibleBrainService";
import type { BibleBrainBible } from "../../services/bibleBrainService";
import "./BibleBrainManager.css";

export default function BibleBrainManager() {
  const [loading, setLoading] = useState(true);
  const [bibles, setBibles] = useState<BibleBrainBible[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [languageIso, setLanguageIso] = useState("");
  const [enabledFilter, setEnabledFilter] = useState("all");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [languages, setLanguages] = useState<{ iso: string; name: string }[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadLanguages();
  }, []);

  useEffect(() => {
    loadBibles();
  }, [currentPage, enabledFilter, mediaFilter]);

  const loadLanguages = async () => {
    try {
      const data = await bibleBrainService.languages();
      setLanguages(data);
    } catch (error) {
      console.error("Erro ao carregar idiomas:", error);
    }
  };

  const loadBibles = async () => {
    try {
      setLoading(true);
      const params: any = { page: currentPage, perPage: 20 };
      if (enabledFilter !== "all") params.enabled = enabledFilter;
      if (mediaFilter !== "all") params.media = mediaFilter;
      if (search.trim()) params.search = search.trim();
      if (languageIso) params.languageIso = languageIso;

      const data = await bibleBrainService.listAll(params);
      setBibles(data.data);
      setTotalPages(data.meta.lastPage);
    } catch (error) {
      console.error("Erro ao carregar bíblias:", error);
      setToast({ message: "Erro ao carregar bíblias", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setCurrentPage(1);
      loadBibles();
    }, 400);
  };

  const handleToggle = async (id: number, currentStatus: boolean) => {
    const action = currentStatus ? "desabilitar" : "habilitar";
    if (!confirm(`Tem certeza que deseja ${action} esta bíblia?`)) return;

    try {
      setActionLoading(id);
      await bibleBrainService.toggle(id);
      setToast({ message: `Bíblia ${currentStatus ? "desabilitada" : "habilitada"} com sucesso!`, type: "success" });
      await loadBibles();
    } catch (error: any) {
      setToast({ message: `Erro ao ${action} bíblia: ${error.message}`, type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSync = async () => {
    if (!confirm("Iniciar sincronização do catálogo BibleBrain? Pode levar alguns minutos.")) return;

    try {
      setSyncing(true);
      setSyncStatus("Iniciando sincronização...");
      await bibleBrainService.sync();

      const poll = setInterval(async () => {
        try {
          const status = await bibleBrainService.syncStatus();
          if (status.status === "completed") {
            clearInterval(poll);
            setSyncing(false);
            setSyncStatus("Sincronização concluída!");
            setToast({ message: "Catálogo sincronizado com sucesso!", type: "success" });
            await loadBibles();
            setTimeout(() => setSyncStatus(null), 3000);
            return;
          }
          if (status.status === "idle") {
            clearInterval(poll);
            setSyncing(false);
            setSyncStatus("Nenhuma sincronização em andamento.");
            setTimeout(() => setSyncStatus(null), 2000);
            return;
          }
          setSyncStatus(`Sincronizando... ${status.totalProcessed} bíblias processadas`);
        } catch {
          clearInterval(poll);
          setSyncing(false);
          setSyncStatus("Erro ao verificar status");
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(poll);
        setSyncing(false);
        setSyncStatus("Timeout ao sincronizar");
      }, 300000);
    } catch (error: any) {
      setSyncing(false);
      setSyncStatus("Erro na sincronização");
      setToast({ message: `Erro ao sincronizar: ${error.message}`, type: "error" });
    }
  };

  const handleRequestPackage = async (id: number, bibleId: string) => {
    try {
      setActionLoading(id);
      await bibleBrainService.requestPackage(id);
      setToast({ message: `Geração de pacote iniciada para ${bibleId}`, type: "info" });
      setTimeout(() => {
        loadBibles();
        setActionLoading(null);
      }, 3000);
    } catch (error: any) {
      setToast({ message: `Erro: ${error.message}`, type: "error" });
      setActionLoading(null);
    }
  };

  const renderProgressBar = (bible: BibleBrainBible) => {
    if (bible.packageStatus === "ready") {
      return <Badge type="success">Pronto</Badge>;
    }
    if (bible.packageStatus === "generating") {
      return (
        <div className="progress-bar-wrapper">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${bible.packageProgress}%` }} />
          </div>
          <span className="progress-text">{bible.packageProgress}%</span>
        </div>
      );
    }
    if (bible.packageStatus === "failed") {
      return (
        <div>
          <Badge type="error">Falha</Badge>
          {bible.packageError && (
            <div className="package-error" title={bible.packageError}>⚠️</div>
          )}
        </div>
      );
    }
    return (
      <ActionButton
        onClick={() => handleRequestPackage(bible.id, bible.bibleId)}
        disabled={actionLoading === bible.id}
        title="Gerar pacote"
      >
        {actionLoading === bible.id ? "..." : "📦 Gerar"}
      </ActionButton>
    );
  };

  return (
    <>
      <Sidebar />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <MainContent>
        <div className="header-row">
          <div>
            <PageTitle>🧠 BibleBrain</PageTitle>
            <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>
              Catálogo de bíblias sincronizadas da Digital Bible Platform
            </p>
          </div>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? "🔄 Sincronizando..." : "🔄 Sincronizar Catálogo"}
          </Button>
        </div>

        {syncStatus && <div className="sync-status">{syncStatus}</div>}

        <div className="filters">
          <div className="filter-group">
            <label>Busca:</label>
            <Input
              type="text"
              placeholder="Nome, idioma ou código..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Idioma:</label>
            <Select value={languageIso} onChange={(e) => { setLanguageIso(e.target.value); setCurrentPage(1); }}>
              <option value="">Todos</option>
              {languages.map((lang, idx) => (
                <option key={`${lang.iso}-${idx}`} value={lang.iso}>{lang.name} ({lang.iso})</option>
              ))}
            </Select>
          </div>

          <div className="filter-group">
            <label>Status:</label>
            <Select value={enabledFilter} onChange={(e) => { setEnabledFilter(e.target.value); setCurrentPage(1); }}>
              <option value="all">Todas</option>
              <option value="1">Habilitadas</option>
              <option value="0">Desabilitadas</option>
            </Select>
          </div>

          <div className="filter-group">
            <label>Mídia:</label>
            <Select value={mediaFilter} onChange={(e) => { setMediaFilter(e.target.value); setCurrentPage(1); }}>
              <option value="all">Todas</option>
              <option value="text">Com texto</option>
              <option value="audio">Com áudio</option>
            </Select>
          </div>
        </div>

        {loading && <EmptyState>Carregando bíblias...</EmptyState>}

        {!loading && bibles.length === 0 && (
          <div className="empty-state">
            <p>📭 Nenhuma bíblia encontrada</p>
            <p className="empty-hint">
              Clique em "Sincronizar Catálogo" para buscar bíblias da BibleBrain.
            </p>
          </div>
        )}

        {!loading && bibles.length > 0 && (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>ID</Th>
                  <Th>Nome</Th>
                  <Th>Idioma</Th>
                  <Th style={{ width: "80px" }}>Texto</Th>
                  <Th style={{ width: "80px" }}>Áudio</Th>
                  <Th style={{ width: "100px" }}>Status</Th>
                  <Th style={{ width: "180px" }}>Pacote</Th>
                  <Th style={{ width: "120px" }}>Ações</Th>
                </Tr>
              </Thead>
              <Tbody>
                {bibles.map((bible) => (
                  <Tr key={bible.id}>
                    <Td className="cell-id">{bible.bibleId}</Td>
                    <Td className="cell-name">{bible.name}</Td>
                    <Td>{bible.languageName}</Td>
                    <Td>{bible.hasText ? "📖" : "—"}</Td>
                    <Td>{bible.hasAudio ? "🔊" : "—"}</Td>
                    <Td>
                      <Badge type={bible.isEnabled ? "success" : "error"}>
                        {bible.isEnabled ? "Ativa" : "Inativa"}
                      </Badge>
                    </Td>
                    <Td>{renderProgressBar(bible)}</Td>
                    <Td>
                      <div className="actions">
                        <ActionButton
                          onClick={() => handleToggle(bible.id, bible.isEnabled)}
                          disabled={actionLoading === bible.id}
                          title={bible.isEnabled ? "Desabilitar" : "Habilitar"}
                        >
                          {actionLoading === bible.id ? "..." : bible.isEnabled ? "⏸️" : "▶️"}
                        </ActionButton>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            {totalPages > 1 && (
              <div className="pagination">
                <Button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  ← Anterior
                </Button>
                <span className="page-info">Página {currentPage} de {totalPages}</span>
                <Button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Próxima →
                </Button>
              </div>
            )}
          </>
        )}
      </MainContent>
    </>
  );
}
