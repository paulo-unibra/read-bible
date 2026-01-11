import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DriveAudioFile, HymnAudioSync } from '../../services/hymnAudioService';
import hymnAudioService from '../../services/hymnAudioService';
import './HymnAudioManager.css';

export default function HymnAudioManager() {
  const { hymnNumber } = useParams<{ hymnNumber: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [driveAudios, setDriveAudios] = useState<DriveAudioFile[]>([]);
  const [syncedAudios, setSyncedAudios] = useState<HymnAudioSync[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  
  // Estados do player
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Refs dos elementos de áudio
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (hymnNumber) {
      loadAudios();
    }
    
    return () => {
      // Limpar áudios ao desmontar
      audioRefs.current.forEach(audio => {
        audio.pause();
        audio.src = '';
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
      console.log('[HymnAudioManager] Carregando áudios do hino:', hymnNumber);
      
      const [drive, synced] = await Promise.all([
        hymnAudioService.searchInDrive(parseInt(hymnNumber!)),
        hymnAudioService.getByHymnNumber(parseInt(hymnNumber!)),
      ]);
      
      console.log('[HymnAudioManager] Áudios do Drive:', drive);
      console.log('[HymnAudioManager] Áudios sincronizados:', synced);
      
      setDriveAudios(drive);
      setSyncedAudios(synced);
      
      // Criar elementos de áudio para cada faixa
      drive.forEach(audio => {
        console.log(`[HymnAudioManager] Criando elemento de áudio para ${audio.instrument}`);
        console.log(`[HymnAudioManager] URL: ${audio.downloadUrl}`);
        
        if (!audioRefs.current.has(audio.instrument)) {
          const audioElement = new Audio(audio.downloadUrl);
          audioElement.preload = 'metadata';
          
          audioElement.addEventListener('loadedmetadata', () => {
            console.log(`[HymnAudioManager] Metadata carregada para ${audio.instrument}:`, {
              duration: audioElement.duration,
              readyState: audioElement.readyState,
            });
            if (duration === 0) {
              setDuration(audioElement.duration);
            }
          });
          
          audioElement.addEventListener('error', (e) => {
            console.error(`[HymnAudioManager] Erro ao carregar ${audio.instrument}:`, {
              error: audioElement.error,
              src: audioElement.src,
              networkState: audioElement.networkState,
            });
          });
          
          audioElement.addEventListener('canplay', () => {
            console.log(`[HymnAudioManager] ${audio.instrument} pronto para tocar`);
          });
          
          audioRefs.current.set(audio.instrument, audioElement);
        }
      });
      
      console.log('[HymnAudioManager] Total de elementos de áudio criados:', audioRefs.current.size);
      
    } catch (error) {
      console.error('[HymnAudioManager] Erro ao carregar áudios:', error);
      alert('Erro ao carregar áudios');
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
    console.log('[HymnAudioManager] handlePlayPause called, isPlaying:', isPlaying);
    console.log('[HymnAudioManager] audioRefs.current.size:', audioRefs.current.size);
    console.log('[HymnAudioManager] driveAudios:', driveAudios);
    
    if (isPlaying) {
      console.log('[HymnAudioManager] Pausando áudios...');
      audioRefs.current.forEach(audio => audio.pause());
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      console.log('[HymnAudioManager] Iniciando playback...');
      
      // Aplicar offsets e tocar
      const promises: Promise<void>[] = [];
      
      audioRefs.current.forEach((audio, instrument) => {
        console.log(`[HymnAudioManager] Processando ${instrument}:`, {
          src: audio.src,
          readyState: audio.readyState,
          networkState: audio.networkState,
          error: audio.error,
        });
        
        const sync = syncedAudios.find(s => s.instrument === instrument);
        const offsetMs = sync?.offsetMs || 0;
        
        console.log(`[HymnAudioManager] ${instrument} - offset: ${offsetMs}ms`);
        
        if (offsetMs > 0) {
          // Offset positivo: atrasar início
          console.log(`[HymnAudioManager] ${instrument} - agendando play em ${offsetMs}ms`);
          setTimeout(() => {
            console.log(`[HymnAudioManager] ${instrument} - executando play atrasado`);
            audio.play().catch(err => {
              console.error(`[HymnAudioManager] Erro ao tocar ${instrument}:`, err);
            });
          }, offsetMs);
        } else if (offsetMs < 0) {
          // Offset negativo: adiantar (começar de uma posição mais à frente)
          console.log(`[HymnAudioManager] ${instrument} - adiantando ${Math.abs(offsetMs)}ms`);
          audio.currentTime = Math.abs(offsetMs) / 1000;
          promises.push(audio.play().catch(err => {
            console.error(`[HymnAudioManager] Erro ao tocar ${instrument}:`, err);
            throw err;
          }));
        } else {
          console.log(`[HymnAudioManager] ${instrument} - tocando sem offset`);
          promises.push(audio.play().catch(err => {
            console.error(`[HymnAudioManager] Erro ao tocar ${instrument}:`, err);
            throw err;
          }));
        }
      });
      
      Promise.all(promises).then(() => {
        console.log('[HymnAudioManager] Todos os áudios iniciados com sucesso');
        setIsPlaying(true);
        updateTime();
      }).catch(err => {
        console.error('[HymnAudioManager] Erro ao iniciar playback:', err);
        alert('Erro ao iniciar áudio: ' + err.message);
      });
    }
  };

  const handleStop = () => {
    audioRefs.current.forEach(audio => {
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
    audioRefs.current.forEach(audio => {
      audio.currentTime = newTime;
    });
    setCurrentTime(newTime);
  };

  const handleOffsetChange = async (instrument: string, offsetMs: number) => {
    try {
      const existing = syncedAudios.find(s => s.instrument === instrument);
      const driveAudio = driveAudios.find(a => a.instrument === instrument);
      
      if (!driveAudio) return;
      
      if (existing) {
        // Atualizar offset existente
        await hymnAudioService.updateOffset(existing.id, offsetMs);
      } else {
        // Criar nova sincronização
        await hymnAudioService.upsert({
          hymnNumber: parseInt(hymnNumber!),
          instrument,
          fileId: driveAudio.fileId,
          fileName: driveAudio.fileName,
          offsetMs,
          defaultVolume: 1.0,
          defaultMuted: false,
          displayOrder: 0,
        });
      }
      
      // Recarregar dados
      await loadAudios();
      
    } catch (error) {
      console.error('Erro ao atualizar offset:', error);
      alert('Erro ao salvar sincronização');
    }
  };

  const handleVolumeChange = (instrument: string, volume: number) => {
    const audio = audioRefs.current.get(instrument);
    if (audio) {
      audio.volume = volume;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSyncForInstrument = (instrument: string): HymnAudioSync | undefined => {
    return syncedAudios.find(s => s.instrument === instrument);
  };

  return (
    <div className="hymn-audio-manager">
      <div className="header">
        <button onClick={() => navigate('/admin/hymn-audios')} className="back-button">
          ← Voltar
        </button>
        <h1>Gerenciar Áudios - Hino {hymnNumber}</h1>
      </div>

      {loading && <div className="loading">Carregando áudios...</div>}

      {!loading && driveAudios.length === 0 && (
        <div className="no-audios">
          <p>Nenhum áudio encontrado para este hino no Google Drive.</p>
          <p>Faça upload dos áudios no formato: hino-{hymnNumber}-[instrumento].mp3</p>
        </div>
      )}

      {!loading && driveAudios.length > 0 && (
        <>
          {/* Player Global */}
          <div className="global-player">
            <div className="player-controls">
              <button onClick={handleStop} disabled={!isPlaying && currentTime === 0}>
                ⏹ Stop
              </button>
              <button onClick={handlePlayPause}>
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
            </div>

            <div className="player-progress">
              <span>{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="seek-bar"
              />
              <span>{formatTime(duration)}</span>
            </div>

            <div className="player-info">
              <p>🎵 Tocando {audioRefs.current.size} faixas simultaneamente</p>
              <p>💡 Use os controles abaixo para ajustar a sincronização de cada faixa</p>
            </div>
          </div>

          {/* Lista de Faixas */}
          <div className="tracks-list">
            <h2>Faixas de Áudio</h2>
            
            {driveAudios.map((audio) => {
              const sync = getSyncForInstrument(audio.instrument);
              const offsetMs = sync?.offsetMs || 0;
              
              return (
                <div 
                  key={audio.instrument} 
                  className={`track-item ${selectedTrack === audio.instrument ? 'selected' : ''}`}
                  onClick={() => setSelectedTrack(audio.instrument)}
                >
                  <div className="track-header">
                    <h3>{audio.instrument}</h3>
                    <span className="track-status">
                      {sync ? '✓ Sincronizado' : '○ Não sincronizado'}
                    </span>
                  </div>

                  <div className="track-info">
                    <p><strong>Arquivo:</strong> {audio.fileName}</p>
                    {audio.size && <p><strong>Tamanho:</strong> {(audio.size / 1024 / 1024).toFixed(2)} MB</p>}
                  </div>

                  <div className="track-controls">
                    <div className="control-group">
                      <label>Volume:</label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        defaultValue={sync?.defaultVolume || 1.0}
                        onChange={(e) => handleVolumeChange(audio.instrument, parseFloat(e.target.value))}
                      />
                    </div>

                    <div className="control-group">
                      <label>
                        Offset de Sincronização (ms):
                        <span className="offset-help">
                          Positivo = atrasa | Negativo = adianta
                        </span>
                      </label>
                      <div className="offset-controls">
                        <button onClick={() => handleOffsetChange(audio.instrument, offsetMs - 100)}>
                          -100ms
                        </button>
                        <button onClick={() => handleOffsetChange(audio.instrument, offsetMs - 10)}>
                          -10ms
                        </button>
                        <input
                          type="number"
                          value={offsetMs}
                          onChange={(e) => handleOffsetChange(audio.instrument, parseInt(e.target.value) || 0)}
                          className="offset-input"
                        />
                        <button onClick={() => handleOffsetChange(audio.instrument, offsetMs + 10)}>
                          +10ms
                        </button>
                        <button onClick={() => handleOffsetChange(audio.instrument, offsetMs + 100)}>
                          +100ms
                        </button>
                        {offsetMs !== 0 && (
                          <button onClick={() => handleOffsetChange(audio.instrument, 0)} className="reset-button">
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {sync && sync.notes && (
                    <div className="track-notes">
                      <p><strong>Notas:</strong> {sync.notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
