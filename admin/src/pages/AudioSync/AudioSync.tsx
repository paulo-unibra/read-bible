import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import "./AudioSync.css";

interface Verse {
  verseNumber: number;
  text: string;
  timestampMs?: number;
}

interface SyncedChapter {
  bookId: number;
  chapterNumber: number;
  totalVerses: number;
}

const AudioSync: React.FC = () => {
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [bookId, setBookId] = useState<number>(66); // Apocalipse por padrão
  const [chapterNumber, setChapterNumber] = useState<number>(1);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedVerseIndex, setSelectedVerseIndex] = useState<number | null>(
    null,
  );
  const [syncedChapters, setSyncedChapters] = useState<SyncedChapter[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>("");

  // Mapeamento de IDs de livros para nomes de arquivo
  const bookNameMapping: { [key: number]: string } = {
    66: "apocalipse",
    40: "mateus",
    41: "marcos",
    42: "lucas",
    43: "joao",
    // Adicionar mais conforme necessário
  };

  // Carregar lista de capítulos sincronizados
  useEffect(() => {
    loadSyncedChapters();
  }, []);

  // Carregar versículos quando mudar livro/capítulo
  useEffect(() => {
    loadChapterData();
  }, [bookId, chapterNumber]);

  const loadSyncedChapters = async () => {
    try {
      const response = await api.get("/admin/audio-sync/list");
      if (response.data.success) {
        setSyncedChapters(response.data.data);
      }
    } catch (error) {
      console.error("Error loading synced chapters:", error);
    }
  };

  const loadChapterData = async () => {
    try {
      setLoading(true);

      // Carregar timestamps existentes
      const syncResponse = await api.get(
        `/admin/audio-sync/${bookId}/${chapterNumber}`,
      );
      const existingTimestamps = syncResponse.data.success
        ? syncResponse.data.data
        : [];

      // Gerar versículos mock (idealmente buscar de uma API real)
      const mockVerses: Verse[] = Array.from({ length: 20 }, (_, i) => ({
        verseNumber: i + 1,
        text: `Versículo ${i + 1} - Texto exemplo...`,
        timestampMs: existingTimestamps.find(
          (t: any) => t.verseNumber === i + 1,
        )?.timestampMs,
      }));

      setVerses(mockVerses);

      // Configurar URL do áudio
      const bookName = bookNameMapping[bookId] || "apocalipse";
      // Você pode ajustar para o caminho correto do Google Drive
      setAudioUrl(`/path/to/audio/${bookName}-${chapterNumber}.mp3`);
    } catch (error) {
      console.error("Error loading chapter data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime * 1000); // Converter para ms
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration * 1000); // Converter para ms
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime / 1000; // Converter de ms para s
      setCurrentTime(newTime);
    }
  };

  const markCurrentTime = (verseIndex: number) => {
    const updatedVerses = [...verses];
    updatedVerses[verseIndex].timestampMs = Math.round(currentTime);
    setVerses(updatedVerses);
    setSelectedVerseIndex(verseIndex);

    // Auto-avançar para próximo versículo
    if (verseIndex < verses.length - 1) {
      setTimeout(() => setSelectedVerseIndex(verseIndex + 1), 300);
    }
  };

  const jumpToTimestamp = (timestampMs?: number) => {
    if (timestampMs && audioRef.current) {
      audioRef.current.currentTime = timestampMs / 1000;
      setCurrentTime(timestampMs);
    }
  };

  const clearTimestamp = (verseIndex: number) => {
    const updatedVerses = [...verses];
    updatedVerses[verseIndex].timestampMs = undefined;
    setVerses(updatedVerses);
  };

  const saveTimestamps = async () => {
    try {
      setLoading(true);
      setSaveMessage("");

      const timestamps = verses
        .filter((v) => v.timestampMs !== undefined)
        .map((v) => ({
          verseNumber: v.verseNumber,
          timestampMs: v.timestampMs!,
        }));

      const response = await api.post("/admin/audio-sync", {
        bookId,
        chapterNumber,
        timestamps,
      });

      if (response.data.success) {
        setSaveMessage("✅ Timestamps salvos com sucesso!");
        await loadSyncedChapters();
        setTimeout(() => setSaveMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error saving timestamps:", error);
      setSaveMessage("❌ Erro ao salvar timestamps");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const syncedCount = verses.filter((v) => v.timestampMs !== undefined).length;
  const isSynced = syncedChapters.some(
    (s) => s.bookId === bookId && s.chapterNumber === chapterNumber,
  );

  return (
    <div className="audio-sync-container">
      <div className="audio-sync-header">
        <button className="back-button" onClick={() => navigate("/dashboard")}>
          ← Voltar
        </button>
        <h1>Sincronização de Áudio Bíblico</h1>
      </div>

      <div className="sync-layout">
        {/* Painel de controle */}
        <div className="control-panel">
          <div className="chapter-selector">
            <div className="input-group">
              <label>Livro (ID):</label>
              <input
                type="number"
                value={bookId}
                onChange={(e) => setBookId(parseInt(e.target.value))}
                min="1"
                max="66"
              />
            </div>
            <div className="input-group">
              <label>Capítulo:</label>
              <input
                type="number"
                value={chapterNumber}
                onChange={(e) => setChapterNumber(parseInt(e.target.value))}
                min="1"
              />
            </div>
            {isSynced && <span className="synced-badge">✓ Sincronizado</span>}
          </div>

          <div className="audio-player">
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
            />

            <div className="player-controls">
              <button onClick={togglePlayPause} className="play-button">
                {isPlaying ? "⏸" : "▶"}
              </button>
              <span className="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              className="seek-bar"
            />
          </div>

          <div className="sync-info">
            <p>
              <strong>Progresso:</strong> {syncedCount} / {verses.length}{" "}
              versículos
            </p>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(syncedCount / verses.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="action-buttons">
            <button
              onClick={saveTimestamps}
              disabled={loading || syncedCount === 0}
              className="save-button"
            >
              {loading ? "Salvando..." : "Salvar Sincronização"}
            </button>
            {saveMessage && <p className="save-message">{saveMessage}</p>}
          </div>

          <div className="instructions">
            <h3>Instruções:</h3>
            <ol>
              <li>Reproduza o áudio</li>
              <li>
                Quando ouvir um versículo, clique em "Marcar" ao lado dele
              </li>
              <li>O timestamp atual será gravado</li>
              <li>Repita para todos os versículos</li>
              <li>Clique em "Salvar Sincronização"</li>
            </ol>
          </div>
        </div>

        {/* Lista de versículos */}
        <div className="verses-panel">
          <h2>Versículos</h2>
          {loading ? (
            <p>Carregando...</p>
          ) : (
            <div className="verses-list">
              {verses.map((verse, index) => (
                <div
                  key={verse.verseNumber}
                  className={`verse-item ${selectedVerseIndex === index ? "selected" : ""} ${verse.timestampMs ? "synced" : ""}`}
                >
                  <div className="verse-number">{verse.verseNumber}</div>
                  <div className="verse-content">
                    <div className="verse-text">{verse.text}</div>
                    {verse.timestampMs !== undefined && (
                      <div className="verse-timestamp">
                        {formatTime(verse.timestampMs)}
                      </div>
                    )}
                  </div>
                  <div className="verse-actions">
                    {verse.timestampMs === undefined ? (
                      <button
                        onClick={() => markCurrentTime(index)}
                        className="mark-button"
                      >
                        Marcar
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => jumpToTimestamp(verse.timestampMs)}
                          className="jump-button"
                        >
                          Ir
                        </button>
                        <button
                          onClick={() => clearTimestamp(index)}
                          className="clear-button"
                        >
                          Limpar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lista de capítulos sincronizados */}
      <div className="synced-chapters-panel">
        <h2>Capítulos Sincronizados ({syncedChapters.length})</h2>
        <div className="synced-chapters-list">
          {syncedChapters.map((chapter) => (
            <div
              key={`${chapter.bookId}-${chapter.chapterNumber}`}
              className="synced-chapter-item"
              onClick={() => {
                setBookId(chapter.bookId);
                setChapterNumber(chapter.chapterNumber);
              }}
            >
              Livro {chapter.bookId}, Cap. {chapter.chapterNumber} (
              {chapter.totalVerses} versículos)
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AudioSync;
