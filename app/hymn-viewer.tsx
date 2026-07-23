import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    BackHandler,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AdBanner from "../components/AdBanner";
import HymnAudioMixer from "../components/HymnAudioMixer";
import HymnDownloadButton from "../components/HymnDownloadButton";
import DatabaseService from "../services/DatabaseService";
import harpaOfflineService, { HymnData } from "../services/HarpaOfflineService";
import hymnAudioService, { HymnAudioTrack } from "../services/HymnAudioService";
import hymnCacheService, { CacheStatus } from "../services/HymnCacheService";

interface HymnVerse {
  name: string;
  type: "verse" | "chorus";
  lines: string[];
}

interface Hymn extends HymnData {}

export default function HymnViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const hymnNumber = parseInt(params.hymnNumber as string);

  const [hymn, setHymn] = useState<Hymn | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [fontSizePref, setFontSizePref] = useState<
    "small" | "medium" | "large"
  >("medium");
  const [hymnFontSize, setHymnFontSize] = useState<
    "small" | "medium" | "large"
  >("medium");

  // Estados do player de áudio
  const [audioTracks, setAudioTracks] = useState<HymnAudioTrack[]>([]);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showMixer, setShowMixer] = useState(false);
  const playbackInterval = useRef<NodeJS.Timeout | null>(null);
  const masterTimerStart = useRef<number>(0); // Timer mestre para sincronização
  const lastSyncTime = useRef<number>(0); // Última vez que sincronizou

  // Estados de cache e download
  const [cacheStatuses, setCacheStatuses] = useState<Map<string, CacheStatus>>(
    new Map(),
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showPlayer, setShowPlayer] = useState(false); // Controla expansão do player
  const [playbackRate, setPlaybackRate] = useState(1.0); // Velocidade de reprodução (0.5x a 1.5x)

  // Carregar tema ANTES de qualquer renderização
  useEffect(() => {
    const initTheme = async () => {
      try {
        const settings = await DatabaseService.getMultipleSettings(["theme"]);
        const userTheme = settings.theme as "light" | "dark" | null;
        setTheme(userTheme || "light");
      } catch (error) {
        console.error("Erro ao carregar tema:", error);
        setTheme("light");
      }
    };
    initTheme();
  }, []);

  useEffect(() => {
    // Só carregar conteúdo depois que o tema foi definido
    if (theme !== null) {
      loadSettings();
      loadHymn();
      loadAudio();

      // Configurar modo de áudio
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
    }

    // Cleanup ao desmontar - SEMPRE executar para parar áudio
    return () => {
      console.log("🧹 [HymnViewer] Limpando áudio ao sair da tela...");
      cleanupAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // Interceptar botão de voltar (Android hardware back button)
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        console.log(
          "⬅️ [HymnViewer] Botão voltar pressionado, limpando áudio...",
        );
        cleanupAudio();
        return false; // Permite a navegação para trás continuar
      },
    );

    return () => backHandler.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioTracks]);

  // Verificar cache quando audioTracks mudar
  useEffect(() => {
    if (audioTracks.length > 0) {
      checkCacheStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioTracks]);

  // Gerenciar intervalo de atualização de posição com TIMER MESTRE
  useEffect(() => {
    if (isPlaying && audioTracks.length > 0 && audioTracks[0].isLoaded) {
      console.log(`🔄 [HymnViewer] Iniciando timer mestre`);

      // Inicializar timer mestre
      if (masterTimerStart.current === 0) {
        masterTimerStart.current = Date.now() - position;
      }

      const interval = setInterval(() => {
        // Calcular posição baseado no timer mestre
        const elapsed = Date.now() - masterTimerStart.current;
        setPosition(elapsed);

        // Verificar fim do áudio
        if (duration > 0 && elapsed >= duration - 100) {
          console.log(`⏹️ [HymnViewer] Fim do áudio, parando...`);
          handleStop();
        }
      }, 100);

      playbackInterval.current = interval;

      return () => {
        console.log(`🛑 [HymnViewer] Limpando timer mestre`);
        clearInterval(interval);
      };
    } else {
      // Limpar intervalo quando não está tocando
      if (playbackInterval.current) {
        console.log(`🛑 [HymnViewer] Pausado, limpando intervalo`);
        clearInterval(playbackInterval.current);
        playbackInterval.current = null;
      }
    }
  }, [isPlaying, audioTracks, duration]);

  const loadSettings = async () => {
    try {
      const settings = await DatabaseService.getMultipleSettings([
        "fontSize",
        "hymnFontSize",
      ]);
      const userFont = settings.fontSize as "small" | "medium" | "large" | null;
      const userHymnFont = settings.hymnFontSize as
        | "small"
        | "medium"
        | "large"
        | null;
      if (userFont) setFontSizePref(userFont);
      if (userHymnFont) setHymnFontSize(userHymnFont);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    }
  };

  const changeHymnFontSize = async (size: "small" | "medium" | "large") => {
    setHymnFontSize(size);
    try {
      await DatabaseService.saveSetting("hymnFontSize", size);
    } catch (error) {
      console.error("Erro ao salvar tamanho da fonte:", error);
    }
  };

  const loadHymn = async () => {
    try {
      setLoading(true);
      console.log(`📖 [HymnViewer] Carregando hino ${hymnNumber}...`);
      const loadedHymn = await harpaOfflineService.getHymnByNumber(hymnNumber);
      console.log(`📖 [HymnViewer] Hino carregado:`, {
        number: loadedHymn.number,
        title: loadedHymn.title,
        versesCount: loadedHymn.verses.length,
        verses: loadedHymn.verses.map((v) => ({
          name: v.name,
          type: v.type,
          linesCount: v.lines.length,
        })),
      });
      setHymn(loadedHymn);
    } catch (error) {
      console.error("❌ [HymnViewer] Erro ao carregar hino:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAudio = async () => {
    try {
      console.log(`🎵 [HymnViewer] Buscando áudios do hino ${hymnNumber}...`);

      const tracks = await hymnAudioService.searchHymnAudios(hymnNumber);

      if (tracks.length > 0) {
        console.log(`✅ [HymnViewer] ${tracks.length} áudios encontrados`);
        // Apenas armazenar metadados - NÃO carregar áudio ainda
        setAudioTracks(tracks);
      } else {
        console.log(
          `ℹ️ [HymnViewer] Nenhum áudio disponível para o hino ${hymnNumber}`,
        );
      }
    } catch (error) {
      console.error("❌ [HymnViewer] Erro ao buscar áudios:", error);
    }
  };

  const checkCacheStatus = async () => {
    try {
      if (audioTracks.length === 0) return;

      console.log(`💾 [HymnViewer] Verificando cache dos áudios...`);

      const instruments = audioTracks.map((t) => t.instrument);
      const statuses = await hymnCacheService.checkMultipleTracks(
        hymnNumber,
        instruments,
      );

      setCacheStatuses(statuses);

      const cachedCount = Array.from(statuses.values()).filter(
        (s) => s.isCached,
      ).length;
      console.log(
        `✅ [HymnViewer] ${cachedCount}/${instruments.length} áudios em cache`,
      );
    } catch (error) {
      console.error("❌ [HymnViewer] Erro ao verificar cache:", error);
    }
  };

  const handleDownloadTracks = async () => {
    try {
      if (audioTracks.length === 0) {
        alert("Nenhum áudio disponível para download");
        return;
      }

      setIsDownloading(true);
      setDownloadProgress(0);

      console.log(
        `📥 [HymnViewer] Iniciando download de ${audioTracks.length} faixas...`,
      );

      // Filtrar apenas as que não estão em cache
      const tracksToDownload = audioTracks.filter((track) => {
        const status = cacheStatuses.get(track.instrument);
        return !status?.isCached;
      });

      if (tracksToDownload.length === 0) {
        alert("Todas as faixas já estão baixadas!");
        setIsDownloading(false);
        return;
      }

      const downloadData = tracksToDownload.map((track) => ({
        instrument: track.instrument,
        fileId: track.fileId,
      }));

      await hymnCacheService.downloadAllTracks(
        hymnNumber,
        downloadData,
        (overall, trackProgress) => {
          setDownloadProgress(overall);
          console.log(
            `📊 [HymnViewer] Progresso: ${Math.round(overall * 100)}% - ${trackProgress.instrument}`,
          );
        },
      );

      console.log(`✅ [HymnViewer] Download concluído!`);

      // SEMPRE descarregar áudios após download para forçar reload limpo do cache
      console.log(
        `🔄 [HymnViewer] Descarregando áudios para forçar reload do cache...`,
      );

      // Parar e descarregar qualquer áudio que possa estar carregado
      if (audioTracks.length > 0) {
        // Verificar se algum tem sound object
        const hasLoadedSounds = audioTracks.some((t) => t.sound);

        if (hasLoadedSounds) {
          await hymnAudioService.stopAll(audioTracks);
          await hymnAudioService.unloadAll(audioTracks);
        }

        // Resetar estado completamente para forçar novo carregamento
        setAudioTracks(
          audioTracks.map((t) => ({
            ...t,
            sound: undefined,
            isLoaded: false,
          })),
        );
        setIsPlaying(false);
        setPosition(0);
        setDuration(0);
      }

      // Atualizar status do cache
      await checkCacheStatus();

      alert("Áudios baixados com sucesso! Agora você pode ouvi-los offline.");
    } catch (error: any) {
      console.error("❌ [HymnViewer] Erro ao baixar:", error);
      alert(`Erro ao baixar áudios: ${error?.message || "Erro desconhecido"}`);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleRemoveDownloads = async () => {
    try {
      // Parar e descarregar áudios se estiverem tocando
      if (audioTracks.length > 0 && audioTracks[0].isLoaded) {
        console.log(
          `⏹️ [HymnViewer] Parando áudios antes de remover downloads...`,
        );
        await hymnAudioService.stopAll(audioTracks);
        await hymnAudioService.unloadAll(audioTracks);
        // Atualizar estado
        setAudioTracks(audioTracks.map((t) => ({ ...t, isLoaded: false })));
        setIsPlaying(false);
        setPosition(0);
      }

      // Remover arquivos do cache
      await hymnCacheService.removeHymnFromCache(hymnNumber);
      await checkCacheStatus();
      alert("Downloads removidos com sucesso!");
    } catch (error: any) {
      console.error("❌ [HymnViewer] Erro ao remover downloads:", error);
      alert(
        `Erro ao remover downloads: ${error?.message || "Erro desconhecido"}`,
      );
    }
  };

  const cleanupAudio = async () => {
    if (playbackInterval.current) {
      clearInterval(playbackInterval.current);
    }

    if (audioTracks.length > 0) {
      await hymnAudioService.stopAll(audioTracks);
      await hymnAudioService.unloadAll(audioTracks);
    }
  };

  const handlePlayPause = async () => {
    const startTime = Date.now();
    console.log(`⏱️ [TIMER] Início do handlePlayPause: ${startTime}`);

    try {
      if (audioTracks.length === 0) {
        alert("Nenhum áudio disponível para este hino");
        return;
      }

      // Verificar se precisa carregar os áudios
      const needsLoading = !audioTracks[0].isLoaded;

      if (needsLoading) {
        console.log(`⏱️ [TIMER] Detectado que precisa carregar áudios`);
        const loadStartTime = Date.now();
        console.log("📥 Carregando áudios com streaming...");
        setIsLoadingAudio(true);

        try {
          // Carregar com streaming
          console.log(`⏱️ [TIMER] Iniciando loadAllTracks...`);
          const loadedTracks =
            await hymnAudioService.loadAllTracks(audioTracks);
          const loadEndTime = Date.now();
          console.log(
            `⏱️ [TIMER] loadAllTracks concluído em ${loadEndTime - loadStartTime}ms`,
          );

          if (loadedTracks.length === 0) {
            throw new Error("Não foi possível carregar os áudios");
          }

          setAudioTracks(loadedTracks);

          // Obter duração
          console.log(`⏱️ [TIMER] Obtendo duração...`);
          const durationStartTime = Date.now();
          const firstDuration =
            await hymnAudioService.getDuration(loadedTracks);
          console.log(
            `⏱️ [TIMER] Duração obtida em ${Date.now() - durationStartTime}ms`,
          );
          setDuration(firstDuration);

          // Aplicar velocidade de reprodução se não for 1.0x
          if (playbackRate !== 1.0) {
            await hymnAudioService.setPlaybackRateAll(
              loadedTracks,
              playbackRate,
            );
          }

          // Tocar imediatamente DO INÍCIO (fromStart=true)
          console.log(`⏱️ [TIMER] Iniciando playback...`);
          const playStartTime = Date.now();
          await hymnAudioService.playAll(loadedTracks, true);
          console.log(
            `⏱️ [TIMER] Playback iniciado em ${Date.now() - playStartTime}ms`,
          );

          setIsPlaying(true);

          const totalTime = Date.now() - startTime;
          console.log(
            `⏱️ [TIMER] ✅ TOTAL desde clique até tocar: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`,
          );
        } finally {
          setIsLoadingAudio(false);
        }
        return;
      }

      // Já está carregado - tocar/pausar
      console.log(`⏱️ [TIMER] Áudio já carregado, apenas tocando/pausando`);
      if (isPlaying) {
        await hymnAudioService.pauseAll(audioTracks);
        setIsPlaying(false);
        // Resetar timer mestre ao pausar (será reiniciado ao retomar)
        masterTimerStart.current = 0;
        lastSyncTime.current = 0;
      } else {
        // Retomar da posição atual - inicializar timer mestre
        masterTimerStart.current = Date.now() - position;
        lastSyncTime.current = Date.now();
        await hymnAudioService.playAll(audioTracks, false);
        setIsPlaying(true);
      }

      const totalTime = Date.now() - startTime;
      console.log(`⏱️ [TIMER] ✅ TOTAL play/pause: ${totalTime}ms`);
    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error(`⏱️ [TIMER] ❌ ERRO após ${totalTime}ms:`, error);
      alert(error?.message || "Erro ao reproduzir áudio");
      setIsPlaying(false);
      setIsLoadingAudio(false);
    }
  };

  const handleStop = async () => {
    try {
      await hymnAudioService.stopAll(audioTracks);
      setIsPlaying(false);
      setPosition(0);
      // Resetar timer mestre
      masterTimerStart.current = 0;
      lastSyncTime.current = 0;
    } catch (error) {
      console.error("Erro ao parar:", error);
    }
  };

  const handleSeek = async (value: number) => {
    try {
      // Sincronizar todos os áudios para a nova posição
      await hymnAudioService.syncAllToPosition(audioTracks, value);
      setPosition(value);
      // Atualizar timer mestre para a nova posição
      if (isPlaying) {
        masterTimerStart.current = Date.now() - value;
        lastSyncTime.current = Date.now();
      }
    } catch (error) {
      console.error("Erro ao buscar posição:", error);
    }
  };

  const handlePlaybackRateChange = async () => {
    const rates = [0.5, 0.75, 1.0, 1.25, 1.5];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];

    try {
      await hymnAudioService.setPlaybackRateAll(audioTracks, nextRate);
      setPlaybackRate(nextRate);
    } catch (error) {
      console.error("Erro ao alterar velocidade:", error);
    }
  };

  const handleVolumeChange = async (trackIndex: number, volume: number) => {
    try {
      const updatedTracks = [...audioTracks];
      updatedTracks[trackIndex].volume = volume;

      if (!updatedTracks[trackIndex].isMuted) {
        await hymnAudioService.setTrackVolume(
          updatedTracks[trackIndex],
          volume,
        );
      }

      setAudioTracks(updatedTracks);
    } catch (error) {
      console.error("Erro ao ajustar volume:", error);
    }
  };

  const handleMuteToggle = async (trackIndex: number) => {
    try {
      const updatedTracks = [...audioTracks];
      const track = updatedTracks[trackIndex];

      // Inverter o estado de mute
      track.isMuted = !track.isMuted;

      // Aplicar o novo volume baseado no novo estado
      if (track.sound && track.isLoaded) {
        const newVolume = track.isMuted ? 0 : track.volume;
        await track.sound.setVolumeAsync(newVolume);
      }

      setAudioTracks(updatedTracks);
    } catch (error) {
      console.error("Erro ao mutar/desmutar:", error);
    }
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleBackButton = async () => {
    console.log("⬅️ [HymnViewer] Botão voltar clicado, parando áudio...");
    await cleanupAudio();
    router.back();
  };

  const applyFontScale = (base: number) => {
    switch (fontSizePref) {
      case "small":
        return base * 0.9;
      case "large":
        return base * 1.2;
      default:
        return base;
    }
  };

  const applyHymnFontScale = (base: number) => {
    switch (hymnFontSize) {
      case "small":
        return base * 0.85;
      case "large":
        return base * 1.3;
      default:
        return base;
    }
  };

  const isDark = theme === "dark";
  const colors = {
    bg: isDark ? "#121212" : "#f5f5f5",
    headerBg: isDark ? "#1d1d1d" : "#fff",
    border: isDark ? "#2b2b2b" : "#e0e0e0",
    card: isDark ? "#1e1e1e" : "#fff",
    textPrimary: isDark ? "#e0e0e0" : "#333",
    textSecondary: isDark ? "#b0b0b0" : "#666",
    accent: isDark ? "#81c784" : "#4CAF50",
    chorusBg: isDark ? "#2b3d2b" : "#e8f5e9",
  };

  // Não renderizar nada até o tema estar carregado
  if (theme === null) {
    return null;
  }

  const renderVerse = (verse: HymnVerse, index: number) => {
    const isChorus = verse.type === "chorus";

    return (
      <View
        key={`${verse.name}-${index}`}
        style={[
          styles.verseContainer,
          isChorus && {
            backgroundColor: colors.chorusBg,
            padding: 16,
            borderRadius: 8,
          },
        ]}
      >
        {isChorus && (
          <Text
            style={[
              styles.verseLabel,
              { color: colors.accent, fontSize: applyHymnFontScale(14) },
            ]}
          >
            Coro
          </Text>
        )}
        {verse.lines.map((line, lineIndex) => (
          <Text
            key={lineIndex}
            style={[
              styles.verseLine,
              {
                color: colors.textPrimary,
                fontSize: applyHymnFontScale(16),
                fontStyle: isChorus ? "italic" : "normal",
              },
            ]}
          >
            {line}
          </Text>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={colors.headerBg}
        />
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.headerBg,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.textPrimary, fontSize: applyFontScale(20) },
            ]}
          >
            Hino {hymnNumber}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text
            style={[
              styles.loadingText,
              { color: colors.textSecondary, fontSize: applyFontScale(16) },
            ]}
          >
            Carregando hino...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hymn) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={colors.headerBg}
        />
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.headerBg,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleBackButton}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.textPrimary, fontSize: applyFontScale(20) },
            ]}
          >
            Harpa Cristã
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={colors.textSecondary}
          />
          <Text
            style={[
              styles.errorTitle,
              { color: colors.textPrimary, fontSize: applyFontScale(18) },
            ]}
          >
            Hino não encontrado
          </Text>
          <Text
            style={[
              styles.errorText,
              { color: colors.textSecondary, fontSize: applyFontScale(14) },
            ]}
          >
            O hino {hymnNumber} não pôde ser carregado
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.headerBg}
      />
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.headerBg,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={handleBackButton} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.textPrimary, fontSize: applyFontScale(20) },
          ]}
          numberOfLines={1}
        >
          Hino {hymn.number}
        </Text>
        <View style={styles.fontControls}>
          <TouchableOpacity
            onPress={() => changeHymnFontSize("small")}
            style={[
              styles.fontButton,
              hymnFontSize === "small" && { backgroundColor: colors.accent },
            ]}
          >
            <Text
              style={[
                styles.fontButtonText,
                {
                  color: hymnFontSize === "small" ? "#fff" : colors.textPrimary,
                },
              ]}
            >
              A
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => changeHymnFontSize("medium")}
            style={[
              styles.fontButton,
              hymnFontSize === "medium" && { backgroundColor: colors.accent },
            ]}
          >
            <Text
              style={[
                styles.fontButtonText,
                styles.fontButtonMedium,
                {
                  color:
                    hymnFontSize === "medium" ? "#fff" : colors.textPrimary,
                },
              ]}
            >
              A
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => changeHymnFontSize("large")}
            style={[
              styles.fontButton,
              hymnFontSize === "large" && { backgroundColor: colors.accent },
            ]}
          >
            <Text
              style={[
                styles.fontButtonText,
                styles.fontButtonLarge,
                {
                  color: hymnFontSize === "large" ? "#fff" : colors.textPrimary,
                },
              ]}
            >
              A
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Ad Banner */}
        <AdBanner />

        {/* Header Card */}
        <View style={[styles.headerCard, { backgroundColor: colors.card }]}>
          <View
            style={[styles.hymnNumberBadge, { backgroundColor: colors.accent }]}
          >
            <Text
              style={[
                styles.hymnNumberText,
                { fontSize: applyHymnFontScale(24) },
              ]}
            >
              {hymn.number}
            </Text>
          </View>
          <Text
            style={[
              styles.hymnTitle,
              { color: colors.textPrimary, fontSize: applyHymnFontScale(22) },
            ]}
          >
            {hymn.title}
          </Text>
          {hymn.author && hymn.author !== "Autor Desconhecido" && (
            <Text
              style={[
                styles.hymnAuthor,
                {
                  color: colors.textSecondary,
                  fontSize: applyHymnFontScale(14),
                },
              ]}
            >
              {hymn.author}
            </Text>
          )}
          {hymn.copyright && (
            <Text
              style={[
                styles.hymnCopyright,
                {
                  color: colors.textSecondary,
                  fontSize: applyHymnFontScale(12),
                },
              ]}
            >
              {hymn.copyright}
            </Text>
          )}
        </View>

        {/* Player de Áudio Compacto/Expansível */}
        {audioTracks.length > 0 && (
          <>
            {/* Verificar se todos os áudios estão em cache */}
            {(() => {
              const allCached = Array.from(cacheStatuses.values()).every(
                (s) => s.isCached,
              );

              return (
                <View
                  style={[
                    styles.audioPlayer,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {/* Botão compacto - sempre visível */}
                  <TouchableOpacity
                    style={styles.compactPlayerButton}
                    onPress={() => setShowPlayer(!showPlayer)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.compactPlayerLeft}>
                      <Ionicons
                        name={showPlayer ? "chevron-up" : "musical-notes"}
                        size={24}
                        color={colors.accent}
                      />
                      <View style={styles.compactPlayerInfo}>
                        <Text
                          style={[
                            styles.compactPlayerTitle,
                            { color: colors.textPrimary },
                          ]}
                        >
                          {allCached ? "Áudio do Hino" : "Download Áudio"}
                        </Text>
                        <Text
                          style={[
                            styles.compactPlayerStatus,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {allCached
                            ? isPlaying
                              ? "▶ Tocando..."
                              : "Toque para abrir player"
                            : `${Array.from(cacheStatuses.values()).filter((s) => s.isCached).length}/${audioTracks.length} faixas baixadas`}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={showPlayer ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>

                  {/* Conteúdo expandido */}
                  {showPlayer && (
                    <View style={styles.expandedPlayerContent}>
                      {/* Botão de download integrado */}
                      {!allCached && (
                        <View style={styles.downloadSection}>
                          <HymnDownloadButton
                            hymnNumber={hymnNumber}
                            cacheStatuses={cacheStatuses}
                            isDownloading={isDownloading}
                            downloadProgress={downloadProgress}
                            onDownload={handleDownloadTracks}
                            onRemove={handleRemoveDownloads}
                            isDark={isDark}
                            compact={true}
                          />
                        </View>
                      )}

                      {/* Player completo - só se todos estiverem baixados */}
                      {allCached && (
                        <>
                          <View style={styles.playerHeader}>
                            <Ionicons
                              name="musical-notes"
                              size={24}
                              color={colors.accent}
                            />
                            <Text
                              style={[
                                styles.playerTitle,
                                { color: colors.textPrimary },
                              ]}
                            >
                              Áudio do Hino
                            </Text>
                            {isLoadingAudio && (
                              <ActivityIndicator
                                size="small"
                                color={colors.accent}
                              />
                            )}
                          </View>

                          {/* Controles principais */}
                          <View style={styles.playerControls}>
                            <TouchableOpacity
                              onPress={handleStop}
                              style={styles.controlButton}
                              disabled={!isPlaying && position === 0}
                            >
                              <Ionicons
                                name="stop"
                                size={32}
                                color={
                                  !isPlaying && position === 0
                                    ? colors.textSecondary
                                    : colors.accent
                                }
                              />
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={handlePlayPause}
                              style={[
                                styles.playButton,
                                { backgroundColor: colors.accent },
                              ]}
                            >
                              <Ionicons
                                name={isPlaying ? "pause" : "play"}
                                size={36}
                                color="#fff"
                              />
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => setShowMixer(!showMixer)}
                              style={styles.controlButton}
                            >
                              <Ionicons
                                name={showMixer ? "options" : "options-outline"}
                                size={32}
                                color={colors.accent}
                              />
                            </TouchableOpacity>
                          </View>

                          {/* Controle de velocidade */}
                          <View style={styles.speedControl}>
                            <Ionicons
                              name="speedometer-outline"
                              size={16}
                              color={colors.textSecondary}
                            />
                            <Text
                              style={[
                                styles.speedLabel,
                                { color: colors.textSecondary },
                              ]}
                            >
                              Velocidade:
                            </Text>
                            <TouchableOpacity
                              onPress={handlePlaybackRateChange}
                              style={[
                                styles.speedButton,
                                { backgroundColor: colors.accent },
                              ]}
                            >
                              <Text style={styles.speedButtonText}>
                                {playbackRate}x
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Barra de progresso */}
                          <View style={styles.progressContainer}>
                            <Text
                              style={[
                                styles.timeText,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {formatTime(position)}
                            </Text>
                            <Slider
                              style={styles.progressSlider}
                              minimumValue={0}
                              maximumValue={duration}
                              value={position}
                              onSlidingComplete={handleSeek}
                              minimumTrackTintColor={colors.accent}
                              maximumTrackTintColor={colors.border}
                              thumbTintColor={colors.accent}
                            />
                            <Text
                              style={[
                                styles.timeText,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {formatTime(duration)}
                            </Text>
                          </View>

                          {/* Mixer de áudio */}
                          {showMixer && (
                            <HymnAudioMixer
                              tracks={audioTracks}
                              onVolumeChange={handleVolumeChange}
                              onMuteToggle={handleMuteToggle}
                              isDark={isDark}
                            />
                          )}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })()}
          </>
        )}

        <TouchableOpacity
          style={[
            styles.studioButton,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() =>
            router.push({
              pathname: "/hymn-studio",
              params: { hymnNumber: hymn.number },
            })
          }
          activeOpacity={0.85}
        >
          <View style={styles.studioButtonLeft}>
            <Ionicons name="radio" size={24} color={colors.accent} />
            <View>
              <Text style={[styles.studioButtonTitle, { color: colors.textPrimary }]}>
                Estudio
              </Text>
              <Text
                style={[
                  styles.studioButtonSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                Gravacao, bases e mixagem em uma tela dedicada
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Verses */}
        <View style={styles.versesContent}>
          {hymn.verses.map((verse, index) => renderVerse(verse, index))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  fontControls: {
    flexDirection: "row",
    gap: 4,
  },
  fontButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  fontButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  fontButtonMedium: {
    fontSize: 16,
  },
  fontButtonLarge: {
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  hymnNumberBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  hymnNumberText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  hymnTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  hymnAuthor: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 4,
  },
  hymnCopyright: {
    fontSize: 12,
    textAlign: "center",
  },
  versesContent: {
    gap: 20,
  },
  verseContainer: {
    marginBottom: 8,
  },
  verseLabel: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
  },
  verseLine: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 4,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  audioPlayer: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  compactPlayerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  compactPlayerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  compactPlayerInfo: {
    flex: 1,
  },
  compactPlayerTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  compactPlayerStatus: {
    fontSize: 13,
  },
  expandedPlayerContent: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  downloadSection: {
    padding: 16,
    paddingTop: 12,
  },
  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  playerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  playerControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  controlButton: {
    padding: 8,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
    elevation: 5,
  },
  speedControl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  speedLabel: {
    fontSize: 14,
  },
  speedButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
  },
  speedButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressSlider: {
    flex: 1,
    height: 40,
  },
  timeText: {
    fontSize: 12,
    minWidth: 40,
    textAlign: "center",
  },
  studioButton: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  studioButtonLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  studioButtonTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  studioButtonSubtitle: {
    fontSize: 13,
  },
});
