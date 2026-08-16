import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const FILTERS_KEY = "biblebrain_filters";

function loadSavedFilters() {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveFilters(filters: Record<string, string>) {
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  } catch {}
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function LanguageSearchSelect({
  languages,
  value,
  onChange,
}: {
  languages: { iso: string; name: string }[];
  value: string;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = languages.find((l) => l.iso === value);

  const filtered = useMemo(
    () =>
      filterText
        ? languages.filter(
            (l) =>
              (l.name || "").toLowerCase().includes(filterText.toLowerCase()) ||
              (l.iso || "").toLowerCase().includes(filterText.toLowerCase()),
          )
        : languages,
    [filterText, languages],
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilterText("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(iso: string) {
    onChange(iso);
    setOpen(false);
    setFilterText("");
  }

  return (
    <div ref={wrapperRef} className="language-select-wrapper">
      {open ? (
        <input
          ref={inputRef}
          type="text"
          className="language-select-input"
          placeholder="Digite para filtrar idiomas..."
          value={filterText}
          onChange={(e) => { setFilterText(e.target.value); }}
          autoComplete="off"
          autoFocus
        />
      ) : (
        <div className="language-select-display" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}>
          {selected ? `${selected.name} (${selected.iso})` : "Todos"}
          <span className="language-select-arrow">▾</span>
        </div>
      )}
      {open && (
        <div className="language-select-dropdown">
          <div
            className={`language-select-option ${!value ? "active" : ""}`}
            onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); handleSelect(""); }}
          >
            Todos
          </div>
          {filtered.map((lang) => (
            <div
              key={lang.iso}
              className={`language-select-option ${value === lang.iso ? "active" : ""}`}
              onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); handleSelect(lang.iso); }}
            >
              {lang.name} <span className="language-select-code">{lang.iso}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="language-select-empty">Nenhum idioma encontrado</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BibleBrainManager() {
  const saved = loadSavedFilters();
  const [loading, setLoading] = useState(true);
  const [bibles, setBibles] = useState<BibleBrainBible[]>([]);
  const [currentPage, setCurrentPage] = useState(Number(saved?.page) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const savedSearch = saved?.search || "";
  const [searchInput, setSearchInput] = useState(savedSearch);
  const search = useDebouncedValue(searchInput, 400);
  const [languageIso, setLanguageIso] = useState(saved?.languageIso || "");
  const [enabledFilter, setEnabledFilter] = useState(saved?.enabledFilter || "all");
  const [mediaFilter, setMediaFilter] = useState(saved?.mediaFilter || "all");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [languages, setLanguages] = useState<{ iso: string; name: string }[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const filtersLoaded = useRef(false);
  const prevSearch = useRef(search);

  // Quando o search debounced mudar, reseta página
  useEffect(() => {
    if (search !== prevSearch.current) {
      prevSearch.current = search;
      setCurrentPage(1);
    }
  }, [search]);

  useEffect(() => {
    loadLanguages();
  }, []);

  useEffect(() => {
    loadBibles();
  }, [currentPage, search, languageIso, enabledFilter, mediaFilter]);

  useEffect(() => {
    if (filtersLoaded.current === false) {
      filtersLoaded.current = true;
      return;
    }
    saveFilters({
      page: String(currentPage),
      search,
      languageIso,
      enabledFilter,
      mediaFilter,
    });
  }, [currentPage, search, languageIso, enabledFilter, mediaFilter]);

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

  const handleSearch = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

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

  const renderAudioProgress = (bible: BibleBrainBible) => {
    if (!bible.hasAudio) {
      return <span className="no-audio">—</span>;
    }
    if (bible.audioPackageStatus === "ready") {
      return <Badge type="success">Pronto</Badge>;
    }
    if (bible.audioPackageStatus === "generating") {
      return (
        <div className="progress-bar-wrapper">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${bible.audioPackageProgress}%` }} />
          </div>
          <span className="progress-text">{bible.audioPackageProgress}%</span>
        </div>
      );
    }
    if (bible.audioPackageStatus === "failed") {
      return (
        <div>
          <Badge type="error">Falha</Badge>
          {bible.audioPackageError && (
            <div className="package-error" title={bible.audioPackageError}>⚠️</div>
          )}
        </div>
      );
    }
    return <Badge type="info">Pendente</Badge>;
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
              value={searchInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Idioma:</label>
            <LanguageSearchSelect
              languages={languages}
              value={languageIso}
              onChange={(iso) => { setLanguageIso(iso); setCurrentPage(1); }}
            />
          </div>

          <div className="filter-group">
            <label>Status:</label>
            <Select value={enabledFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setEnabledFilter(e.target.value); setCurrentPage(1); }}>
              <option value="all">Todas</option>
              <option value="true">Habilitadas</option>
              <option value="false">Desabilitadas</option>
            </Select>
          </div>

          <div className="filter-group">
            <label>Mídia:</label>
            <Select value={mediaFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setMediaFilter(e.target.value); setCurrentPage(1); }}>
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
                  <Th style={{ width: "180px" }}>Áudio Pkg</Th>
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
                    <Td>{renderAudioProgress(bible)}</Td>
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
