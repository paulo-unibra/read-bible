import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import hymnAudioService from "../../services/hymnAudioService";
import "./HymnAudioList.css";

export default function HymnAudioList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [hymnsWithAudio, setHymnsWithAudio] = useState<number[]>([]);
  const [searchHymnNumber, setSearchHymnNumber] = useState("");

  useEffect(() => {
    loadHymnsWithAudio();
  }, []);

  const loadHymnsWithAudio = async () => {
    try {
      setLoading(true);
      const hymns = await hymnAudioService.listHymnsWithAudio();
      setHymnsWithAudio(hymns);
    } catch (error) {
      console.error("Erro ao carregar hinos:", error);
      alert("Erro ao carregar lista de hinos");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchHymnNumber) {
      navigate(`/admin/hymn-audios/${searchHymnNumber}`);
    }
  };

  return (
    <>
      <Sidebar />
      <div className="hymn-audio-list">
        <header className="hymn-audio-list-header">
          <div className="header-content">
            <h1>🎵 Gerenciar Áudios de Hinos</h1>
            <p className="subtitle">
              Configure a sincronização de áudios para os hinos da Harpa Cristã
            </p>
          </div>
        </header>

        <div className="content">
          <div className="search-card">
            <h2 className="card-title">Buscar Hino</h2>
            <form onSubmit={handleSearchSubmit} className="search-form">
              <input
                type="number"
                placeholder="Digite o número do hino (1-640)"
                value={searchHymnNumber}
                onChange={(e) => setSearchHymnNumber(e.target.value)}
                min={1}
                max={640}
                className="search-input"
              />
              <button type="submit" className="search-button">
                🔍 Buscar
              </button>
            </form>
          </div>

          {loading && (
            <div className="loading-card">
              <div className="loading-spinner"></div>
              <p>Carregando hinos com áudio...</p>
            </div>
          )}

          {!loading && (
            <div className="stats-grid">
              <div className="stat-card stat-primary">
                <div className="stat-icon">🎵</div>
                <h3 className="stat-value">{hymnsWithAudio.length}</h3>
                <p className="stat-label">Hinos com Áudio Sincronizado</p>
              </div>
              <div className="stat-card stat-secondary">
                <div className="stat-icon">⏳</div>
                <h3 className="stat-value">{640 - hymnsWithAudio.length}</h3>
                <p className="stat-label">Hinos Sem Áudio</p>
              </div>
            </div>
          )}

          {!loading && hymnsWithAudio.length > 0 && (
            <div className="hymns-card">
              <h2 className="card-title">Hinos com Áudio Configurado</h2>
              <div className="hymns-grid">
                {hymnsWithAudio.map((hymnNumber) => (
                  <div
                    key={hymnNumber}
                    className="hymn-item"
                    onClick={() => navigate(`/admin/hymn-audios/${hymnNumber}`)}
                  >
                    <div className="hymn-number">#{hymnNumber}</div>
                    <div className="hymn-title">Hino {hymnNumber}</div>
                    <div className="hymn-action">
                      <span>Editar →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && hymnsWithAudio.length === 0 && (
            <div className="empty-card">
              <div className="empty-icon">🎼</div>
              <h3>Nenhum hino com áudio configurado</h3>
              <p>Use o campo de busca acima para adicionar áudios a um hino</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
