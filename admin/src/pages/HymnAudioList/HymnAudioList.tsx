import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import hymnAudioService from '../../services/hymnAudioService';
import './HymnAudioList.css';

export default function HymnAudioList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [hymnsWithAudio, setHymnsWithAudio] = useState<number[]>([]);
  const [searchHymnNumber, setSearchHymnNumber] = useState('');

  useEffect(() => {
    loadHymnsWithAudio();
  }, []);

  const loadHymnsWithAudio = async () => {
    try {
      setLoading(true);
      const hymns = await hymnAudioService.listHymnsWithAudio();
      setHymnsWithAudio(hymns);
    } catch (error) {
      console.error('Erro ao carregar hinos:', error);
      alert('Erro ao carregar lista de hinos');
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
    <div className="hymn-audio-list">
      <div className="header">
        <h1>Gerenciar Áudios de Hinos</h1>
        <p className="subtitle">
          Configure a sincronização de áudios para os hinos da Harpa Cristã
        </p>
      </div>

      <div className="search-section">
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
            Buscar Hino
          </button>
        </form>
      </div>

      {loading && (
        <div className="loading">Carregando hinos com áudio...</div>
      )}

      {!loading && (
        <div className="stats-section">
          <div className="stat-card">
            <h3>{hymnsWithAudio.length}</h3>
            <p>Hinos com Áudio Sincronizado</p>
          </div>
          <div className="stat-card">
            <h3>{640 - hymnsWithAudio.length}</h3>
            <p>Hinos Sem Áudio</p>
          </div>
        </div>
      )}

      {!loading && hymnsWithAudio.length > 0 && (
        <div className="hymns-list-section">
          <h2>Hinos com Áudio Configurado</h2>
          <div className="hymns-grid">
            {hymnsWithAudio.map((hymnNumber) => (
              <div
                key={hymnNumber}
                className="hymn-card"
                onClick={() => navigate(`/admin/hymn-audios/${hymnNumber}`)}
              >
                <div className="hymn-number">#{hymnNumber}</div>
                <div className="hymn-title">Hino {hymnNumber}</div>
                <div className="hymn-action">
                  <span>Editar Sincronização →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && hymnsWithAudio.length === 0 && (
        <div className="empty-state">
          <h3>Nenhum hino com áudio configurado</h3>
          <p>Use o campo de busca acima para adicionar áudios a um hino</p>
        </div>
      )}
    </div>
  );
}
