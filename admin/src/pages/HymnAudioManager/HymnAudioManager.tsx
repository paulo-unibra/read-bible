import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import type {
    DriveAudioFile,
    HymnAudioSync,
} from "../../services/hymnAudioService";
import hymnAudioService from "../../services/hymnAudioService";
import "./HymnAudioManager.css";

export default function HymnAudioManager() {
  const { hymnNumber } = useParams<{ hymnNumber: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [driveAudios, setDriveAudios] = useState<DriveAudioFile[]>([]);
  const [syncedAudios, setSyncedAudios] = useState<HymnAudioSync[]>([]);
  const [_selectedTrack, _setSelectedTrack] = useState<string | null>(null);

  // Estados de alterações pendentes
  const [pendingChanges, setPendingChanges] = useState<
    Map<string, Partial<HymnAudioSync>>
  >(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Estados do player
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Refs dos elementos de áudio
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const animationFrameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (hymnNumber) {
      loadAudios();
    }

    return () => {
      // Limpar áudios ao desmontar
      audioRefs.current.forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      audioRefs.current.clear();

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [hymnNumber]);

  const loadAudios = async () => {
    try {
      setLoading(true);
      console.log("[HymnAudioManager] Carregando áudios do hino:", hymnNumber);

      const [drive, synced] = await Promise.all([
        hymnAudioService.searchInDrive(parseInt(hymnNumber!)),
        hymnAudioService.getByHymnNumber(parseInt(hymnNumber!)),
      ]);

      console.log("[HymnAudioManager] Áudios do Drive:", drive);
      console.log("[HymnAudioManager] Áudios sincronizados:", synced);

      setDriveAudios(drive);
      setSyncedAudios(synced);

      // Criar elementos de áudio para cada faixa
      drive.forEach((audio) => {
        console.log(
          `[HymnAudioManager] Criando elemento de áudio para ${audio.instrument}`,
        );
        console.log(`[HymnAudioManager] URL: ${audio.downloadUrl}`);

        if (!audioRefs.current.has(audio.instrument)) {
          const audioElement = new Audio(audio.downloadUrl);
          audioElement.preload = "metadata";

          audioElement.addEventListener("loadedmetadata", () => {
            console.log(
              `[HymnAudioManager] Metadata carregada para ${audio.instrument}:`,
              {
                duration: audioElement.duration,
                readyState: audioElement.readyState,
              },
            );
            if (duration === 0) {
              setDuration(audioElement.duration);
            }
          });

          audioElement.addEventListener("error", (_e) => {
            console.error(
              `[HymnAudioManager] Erro ao carregar ${audio.instrument}:`,
              {
                error: audioElement.error,
                src: audioElement.src,
                networkState: audioElement.networkState,
              },
            );
          });

          audioElement.addEventListener("canplay", () => {
            console.log(
              `[HymnAudioManager] ${audio.instrument} pronto para tocar`,
            );
          });

          audioRefs.current.set(audio.instrument, audioElement);
        }
      });

      console.log(
        "[HymnAudioManager] Total de elementos de áudio criados:",
        audioRefs.current.size,
      );
    } catch (error) {
      console.error("[HymnAudioManager] Erro ao carregar áudios:", error);
      alert("Erro ao carregar áudios");
    } finally {
      setLoading(false);
    }
  };

  const updateTime = () => {
    const firstAudio = audioRefs.current.values().next().value;
    if (firstAudio) {
      setCurrentTime(firstAudio.currentTime);
    }

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTime);
    }
  };

  const handlePlayPause = () => {
    console.log(
      "[HymnAudioManager] handlePlayPause called, isPlaying:",
      isPlaying,
    );
    console.log(
      "[HymnAudioManager] audioRefs.current.size:",
      audioRefs.current.size,
    );
    console.log("[HymnAudioManager] driveAudios:", driveAudios);

    if (isPlaying) {
      console.log("[HymnAudioManager] Pausando áudios...");
      audioRefs.current.forEach((audio) => audio.pause());
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      console.log("[HymnAudioManager] Iniciando playback...");

      // Aplicar offsets e tocar
      const promises: Promise<void>[] = [];

      audioRefs.current.forEach((audio, instrument) => {
        console.log(`[HymnAudioManager] Processando ${instrument}:`, {
          src: audio.src,
          readyState: audio.readyState,
          networkState: audio.networkState,
          error: audio.error,
        });

        const offsetMs = getCurrentValue(instrument, "offsetMs");

        console.log(`[HymnAudioManager] ${instrument} - offset: ${offsetMs}ms`);

        if (offsetMs > 0) {
          // Offset positivo: atrasar início
          console.log(
            `[HymnAudioManager] ${instrument} - agendando play em ${offsetMs}ms`,
          );
          setTimeout(() => {
            console.log(
              `[HymnAudioManager] ${instrument} - executando play atrasado`,
            );
            audio.play().catch((err) => {
              console.error(
                `[HymnAudioManager] Erro ao tocar ${instrument}:`,
                err,
              );
            });
          }, offsetMs);
        } else if (offsetMs < 0) {
          // Offset negativo: adiantar (começar de uma posição mais à frente)
          console.log(
            `[HymnAudioManager] ${instrument} - adiantando ${Math.abs(offsetMs)}ms`,
          );
          audio.currentTime = Math.abs(offsetMs) / 1000;
          promises.push(
            audio.play().catch((err) => {
              console.error(
                `[HymnAudioManager] Erro ao tocar ${instrument}:`,
                err,
              );
              throw err;
            }),
          );
        } else {
          console.log(`[HymnAudioManager] ${instrument} - tocando sem offset`);
          promises.push(
            audio.play().catch((err) => {
              console.error(
                `[HymnAudioManager] Erro ao tocar ${instrument}:`,
                err,
              );
              throw err;
            }),
          );
        }
      });

      Promise.all(promises)
        .then(() => {
          console.log(
            "[HymnAudioManager] Todos os áudios iniciados com sucesso",
          );
          setIsPlaying(true);
          updateTime();
        })
        .catch((err) => {
          console.error("[HymnAudioManager] Erro ao iniciar playback:", err);
          alert("Erro ao iniciar áudio: " + err.message);
        });
    }
  };

  const handleStop = () => {
    audioRefs.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    setIsPlaying(false);
    setCurrentTime(0);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    audioRefs.current.forEach((audio) => {
      audio.currentTime = newTime;
    });
    setCurrentTime(newTime);
  };

  const handleOffsetChange = (instrument: string, offsetMs: number) => {
    const newPendingChanges = new Map(pendingChanges);
    const currentChanges = newPendingChanges.get(instrument) || {};

    newPendingChanges.set(instrument, {
      ...currentChanges,
      offsetMs,
    });

    setPendingChanges(newPendingChanges);
    setHasUnsavedChanges(true);
  };

  const handleVolumeChange = (instrument: string, volume: number) => {
    // Atualizar volume no player imediatamente
    const audio = audioRefs.current.get(instrument);
    if (audio) {
      audio.volume = volume;
    }

    // Adicionar às alterações pendentes
    const newPendingChanges = new Map(pendingChanges);
    const currentChanges = newPendingChanges.get(instrument) || {};

    newPendingChanges.set(instrument, {
      ...currentChanges,
      defaultVolume: volume,
    });

    setPendingChanges(newPendingChanges);
    setHasUnsavedChanges(true);
  };

  const handleMuteToggle = (instrument: string, muted: boolean) => {
    // Atualizar mute no player imediatamente
    const audio = audioRefs.current.get(instrument);
    if (audio) {
      audio.muted = muted;
    }

    // Adicionar às alterações pendentes
    const newPendingChanges = new Map(pendingChanges);
    const currentChanges = newPendingChanges.get(instrument) || {};

    newPendingChanges.set(instrument, {
      ...currentChanges,
      defaultMuted: muted,
    });

    setPendingChanges(newPendingChanges);
    setHasUnsavedChanges(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getSyncForInstrument = (
    instrument: string,
  ): HymnAudioSync | undefined => {
    return syncedAudios.find((s) => s.instrument === instrument);
  };

  const getCurrentValue = (
    instrument: string,
    field: keyof HymnAudioSync,
  ): any => {
    // Verificar se há alteração pendente
    const pending = pendingChanges.get(instrument);
    if (pending && field in pending) {
      return pending[field];
    }

    // Senão, retornar valor salvo
    const sync = getSyncForInstrument(instrument);
    if (sync && field in sync) {
      return sync[field];
    }

    // Valores padrão
    const defaults: Record<string, any> = {
      offsetMs: 0,
      defaultVolume: 1.0,
      defaultMuted: false,
    };

    return defaults[field] ?? null;
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);

      // Salvar cada alteração pendente
      for (const [instrument, changes] of pendingChanges.entries()) {
        const existing = syncedAudios.find((s) => s.instrument === instrument);
        const driveAudio = driveAudios.find((a) => a.instrument === instrument);

        if (!driveAudio) continue;

        if (existing) {
          // Atualizar existente
          await hymnAudioService.upsert({
            ...existing,
            ...changes,
          });
        } else {
          // Criar novo
          await hymnAudioService.upsert({
            hymnNumber: parseInt(hymnNumber!),
            instrument,
            fileId: driveAudio.fileId,
            fileName: driveAudio.fileName,
            offsetMs: 0,
            defaultVolume: 1.0,
            defaultMuted: false,
            displayOrder: 0,
            ...changes,
          });
        }
      }

      // Recarregar dados
      await loadAudios();

      // Limpar alterações pendentes
      setPendingChanges(new Map());
      setHasUnsavedChanges(false);

      alert("Alterações salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar alterações:", error);
      alert("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    if (window.confirm("Descartar todas as alterações não salvas?")) {
      // Reverter volumes e mutes no player
      pendingChanges.forEach((changes, instrument) => {
        const audio = audioRefs.current.get(instrument);
        const sync = getSyncForInstrument(instrument);

        if (audio) {
          if ("defaultVolume" in changes && sync) {
            audio.volume = sync.defaultVolume;
          }
          if ("defaultMuted" in changes && sync) {
            audio.muted = sync.defaultMuted;
          }
        }
      });

      setPendingChanges(new Map());
      setHasUnsavedChanges(false);
    }
  };

  return (
    <>
      <Sidebar />
      <div className="hymn-audio-manager-page">
        <header className="hymn-audio-header">
          <div className="header-content">
            <button
              onClick={() => navigate("/admin/hymn-audios")}
              className="back-button"
            >
              ← Voltar
            </button>
            <h1>Gerenciar Áudios - Hino {hymnNumber}</h1>
          </div>
          {hasUnsavedChanges && (
            <div className="header-actions">
              <button
                onClick={handleDiscardChanges}
                className="discard-button"
                disabled={saving}
              >
                Descartar
              </button>
              <button
                onClick={handleSaveChanges}
                className="save-button"
                disabled={saving}
              >
                {saving ? "Salvando..." : "💾 Salvar Alterações"}
              </button>
            </div>
          )}
        </header>

        <main className="hymn-audio-content">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Carregando áudios...</p>
            </div>
          )}

          {!loading && driveAudios.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🎵</div>
              <h2>Nenhum áudio encontrado</h2>
              <p>Nenhum áudio foi encontrado para este hino no Google Drive.</p>
              <p className="empty-hint">
                Faça upload dos áudios no formato:{" "}
                <strong>hino-{hymnNumber}-[instrumento].mp3</strong>
              </p>
            </div>
          )}

          {!loading && driveAudios.length > 0 && (
            <>
              {/* Player Global */}
              <div className="global-player-card">
                <h2 className="player-title">Controles de Reprodução</h2>

                <div className="player-controls">
                  <button
                    onClick={handleStop}
                    disabled={!isPlaying && currentTime === 0}
                    className="player-btn stop-btn"
                  >
                    ⏹ Parar
                  </button>
                  <button
                    onClick={handlePlayPause}
                    className="player-btn play-btn"
                  >
                    {isPlaying ? "⏸ Pausar" : "▶ Reproduzir"}
                  </button>
                </div>

                <div className="player-progress">
                  <span className="time-label">{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="seek-bar"
                  />
                  <span className="time-label">{formatTime(duration)}</span>
                </div>

                <div className="player-info">
                  <div className="info-item">
                    <span className="info-icon">🎵</span>
                    <span>
                      Tocando {audioRefs.current.size} faixas simultaneamente
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-icon">💡</span>
                    <span>
                      Use os controles abaixo para ajustar a sincronização de
                      cada faixa
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de Faixas */}
              <div className="tracks-section">
                <h2 className="section-title">
                  Faixas de Áudio ({driveAudios.length})
                </h2>

                <div className="tracks-grid">
                  {driveAudios.map((audio) => {
                    const sync = getSyncForInstrument(audio.instrument);
                    const offsetMs = getCurrentValue(
                      audio.instrument,
                      "offsetMs",
                    );
                    const defaultVolume = getCurrentValue(
                      audio.instrument,
                      "defaultVolume",
                    );
                    const defaultMuted = getCurrentValue(
                      audio.instrument,
                      "defaultMuted",
                    );
                    const hasPendingChanges = pendingChanges.has(
                      audio.instrument,
                    );

                    return (
                      <div key={audio.instrument} className="track-card">
                        <div className="track-header">
                          <div className="track-title-section">
                            <h3 className="track-name">
                              {audio.instrument}
                              {hasPendingChanges && (
                                <span className="pending-indicator">●</span>
                              )}
                            </h3>
                            <span
                              className={`sync-status ${sync ? "synced" : "not-synced"}`}
                            >
                              {sync ? "✓ Sincronizado" : "○ Não sincronizado"}
                            </span>
                          </div>
                        </div>

                        <div className="track-info-section">
                          <div className="info-row">
                            <strong>Arquivo:</strong>
                            <span className="file-name">{audio.fileName}</span>
                          </div>
                          {audio.size && (
                            <div className="info-row">
                              <strong>Tamanho:</strong>
                              <span className="file-size">
                                {(audio.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="track-controls-section">
                          <div className="control-group">
                            <label>
                              <strong>Volume Padrão:</strong>
                              <span className="volume-value">
                                {Math.round(defaultVolume * 100)}%
                              </span>
                            </label>
                            <div className="volume-controls">
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={defaultVolume}
                                onChange={(e) =>
                                  handleVolumeChange(
                                    audio.instrument,
                                    parseFloat(e.target.value),
                                  )
                                }
                                className="volume-slider"
                              />
                              <label className="mute-control">
                                <input
                                  type="checkbox"
                                  checked={defaultMuted}
                                  onChange={(e) =>
                                    handleMuteToggle(
                                      audio.instrument,
                                      e.target.checked,
                                    )
                                  }
                                />
                                <span>🔇 Mutado por padrão</span>
                              </label>
                            </div>
                            <p className="control-help">
                              Este volume será aplicado automaticamente no app
                            </p>
                          </div>

                          <div className="control-group">
                            <label>
                              <strong>Offset de Sincronização (ms):</strong>
                              <span className="offset-help">
                                Positivo = atrasa | Negativo = adianta
                              </span>
                            </label>
                            <div className="offset-controls">
                              <button
                                onClick={() =>
                                  handleOffsetChange(
                                    audio.instrument,
                                    offsetMs - 100,
                                  )
                                }
                                className="offset-btn decrease-btn"
                              >
                                -100ms
                              </button>
                              <button
                                onClick={() =>
                                  handleOffsetChange(
                                    audio.instrument,
                                    offsetMs - 10,
                                  )
                                }
                                className="offset-btn decrease-btn"
                              >
                                -10ms
                              </button>
                              <input
                                type="number"
                                value={offsetMs}
                                onChange={(e) =>
                                  handleOffsetChange(
                                    audio.instrument,
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                className="offset-input"
                              />
                              <button
                                onClick={() =>
                                  handleOffsetChange(
                                    audio.instrument,
                                    offsetMs + 10,
                                  )
                                }
                                className="offset-btn increase-btn"
                              >
                                +10ms
                              </button>
                              <button
                                onClick={() =>
                                  handleOffsetChange(
                                    audio.instrument,
                                    offsetMs + 100,
                                  )
                                }
                                className="offset-btn increase-btn"
                              >
                                +100ms
                              </button>
                              {offsetMs !== 0 && (
                                <button
                                  onClick={() =>
                                    handleOffsetChange(audio.instrument, 0)
                                  }
                                  className="offset-btn reset-btn"
                                >
                                  Resetar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {sync && sync.notes && (
                          <div className="track-notes">
                            <strong>Notas:</strong> {sync.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
