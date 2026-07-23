import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  LayoutChangeEvent,
  PanResponder,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import HymnAudioMixer from "../components/HymnAudioMixer";
import DatabaseService from "../services/DatabaseService";
import harpaOfflineService, { HymnData } from "../services/HarpaOfflineService";
import hymnAudioService, { HymnAudioTrack } from "../services/HymnAudioService";
import hymnRecordingService, {
  LocalHymnRecording,
} from "../services/HymnRecordingService";

interface StudioTrack extends HymnAudioTrack {
  id: string;
  sourceType: "base" | "recording";
  createdAt?: number;
  timingOffsetMs?: number;
}

const RECORDING_OFFSET_SETTING_KEY = "hymnRecordingOffsetMs";
const RECORDING_OFFSET_MIN_MS = -1000;
const RECORDING_OFFSET_MAX_MS = 1000;
const RECORDING_TRACK_OFFSETS_SETTING_PREFIX = "hymnRecordingTrackOffsets";
const DRAG_OFFSET_MIN_MS = -1200;
const DRAG_OFFSET_MAX_MS = 1200;
const DRAG_PX_PER_MS = 0.12;
const DRAG_WAVEFORM_WIDTH = 180;
const TRACK_OFFSET_ROUND_STEP = 10;

const PLAYBACK_AUDIO_MODE = {
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
};

const RECORDING_AUDIO_MODE = {
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
};

const formatTime = (millis: number) => {
  const totalSeconds = Math.floor(Math.max(0, millis) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatDateTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFileSize = (bytes: number) => {
  if (bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
};

const buildWaveBars = (seedText: string, count: number = 36) => {
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) {
    seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  }

  const bars: number[] = [];
  let current = seed || 123456;

  for (let i = 0; i < count; i++) {
    current = (1103515245 * current + 12345) >>> 0;
    const unit = (current % 1000) / 1000;
    bars.push(0.2 + unit * 0.8);
  }

  return bars;
};

interface AlignmentWaveEditorProps {
  seed: string;
  offsetMs: number;
  disabled: boolean;
  colors: {
    border: string;
    cardAlt: string;
    accent: string;
    accentSoft: string;
    textSecondary: string;
    text: string;
  };
  onOffsetPreview: (offsetMs: number) => void;
  onOffsetCommit: (offsetMs: number) => void;
}

function AlignmentWaveEditor({
  seed,
  offsetMs,
  disabled,
  colors,
  onOffsetPreview,
  onOffsetCommit,
}: AlignmentWaveEditorProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const liveOffsetRef = useRef(offsetMs);
  const dragStartOffsetRef = useRef(offsetMs);

  const bars = useMemo(() => buildWaveBars(seed), [seed]);

  useEffect(() => {
    liveOffsetRef.current = offsetMs;
  }, [offsetMs]);

  const onTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const clampOffset = (value: number) =>
    Math.max(
      DRAG_OFFSET_MIN_MS,
      Math.min(
        DRAG_OFFSET_MAX_MS,
        Math.round(value / TRACK_OFFSET_ROUND_STEP) * TRACK_OFFSET_ROUND_STEP,
      ),
    );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: () => {
          dragStartOffsetRef.current = liveOffsetRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          if (disabled) return;

          const nextOffset = clampOffset(
            dragStartOffsetRef.current + gestureState.dx / DRAG_PX_PER_MS,
          );

          liveOffsetRef.current = nextOffset;
          onOffsetPreview(nextOffset);
        },
        onPanResponderRelease: () => {
          if (disabled) return;
          onOffsetCommit(liveOffsetRef.current);
        },
      }),
    [disabled, onOffsetCommit, onOffsetPreview],
  );

  const timelineCenterX = trackWidth / 2;
  const unclampedLeft =
    timelineCenterX + liveOffsetRef.current * DRAG_PX_PER_MS - DRAG_WAVEFORM_WIDTH / 2;
  const waveformLeft = Math.max(
    0,
    Math.min(Math.max(0, trackWidth - DRAG_WAVEFORM_WIDTH), unclampedLeft),
  );

  return (
    <View style={styles.waveEditorWrap}>
      <Text style={[styles.waveEditorLabel, { color: colors.textSecondary }]}> 
        Arraste a forma de onda para alinhar
      </Text>

      <View
        style={[
          styles.waveTrack,
          { borderColor: colors.border, backgroundColor: colors.cardAlt },
        ]}
        onLayout={onTrackLayout}
      >
        <View
          style={[styles.waveTrackCenterLine, { backgroundColor: colors.textSecondary }]}
        />

        <View
          style={[
            styles.waveBlock,
            {
              left: waveformLeft,
              borderColor: colors.accent,
              backgroundColor: colors.accentSoft,
              opacity: disabled ? 0.6 : 1,
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.waveBarsRow}>
            {bars.map((bar, index) => (
              <View
                key={`${seed}-bar-${index}`}
                style={[
                  styles.waveBar,
                  {
                    height: 10 + bar * 26,
                    backgroundColor: colors.accent,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>

      <Text style={[styles.waveOffsetReadout, { color: colors.text }]}> 
        {liveOffsetRef.current >= 0 ? "+" : ""}
        {liveOffsetRef.current} ms
      </Text>
    </View>
  );
}

export default function HymnStudioScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const hymnNumberParam = params.hymnNumber;
  const hymnNumber = Number.parseInt(
    Array.isArray(hymnNumberParam) ? hymnNumberParam[0] : hymnNumberParam || "",
    10,
  );

  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [hymn, setHymn] = useState<HymnData | null>(null);

  const [baseTracks, setBaseTracks] = useState<StudioTrack[]>([]);
  const [recordingTracks, setRecordingTracks] = useState<StudioTrack[]>([]);
  const [recordings, setRecordings] = useState<LocalHymnRecording[]>([]);
  const [selectedBaseTrackIds, setSelectedBaseTrackIds] = useState<string[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showMixer, setShowMixer] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingOffsetMs, setRecordingOffsetMs] = useState(0);
  const [recordingTrackOffsets, setRecordingTrackOffsets] = useState<
    Record<string, number>
  >({});

  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartedAtRef = useRef(0);
  const masterTimerStartRef = useRef(0);
  const stopPlaybackRef = useRef<(() => Promise<void>) | null>(null);
  const handleBackPressRef = useRef<() => void>(() => {});
  const selectedBaseTrackIdsRef = useRef<string[]>([]);
  const recordingTrackOffsetsRef = useRef<Record<string, number>>({});
  const delayedPlayTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const durationRef = useRef(0);
  const allTracksRef = useRef<StudioTrack[]>([]);
  const isStoppingRef = useRef(false);

  const allTracks = useMemo(
    () => [...baseTracks, ...recordingTracks],
    [baseTracks, recordingTracks],
  );

  useEffect(() => {
    allTracksRef.current = allTracks;
  }, [allTracks]);

  useEffect(() => {
    selectedBaseTrackIdsRef.current = selectedBaseTrackIds;
  }, [selectedBaseTrackIds]);

  useEffect(() => {
    recordingTrackOffsetsRef.current = recordingTrackOffsets;
  }, [recordingTrackOffsets]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const isDark = theme === "dark";
  const colors = {
    bg: isDark ? "#0f1419" : "#eef3f8",
    headerBg: isDark ? "#15202b" : "#ffffff",
    card: isDark ? "#1d2a36" : "#ffffff",
    cardAlt: isDark ? "#15202b" : "#f7fbff",
    border: isDark ? "#2c3d4f" : "#dbe6ef",
    text: isDark ? "#f4f7fb" : "#16324a",
    textSecondary: isDark ? "#9db3c7" : "#5e7388",
    accent: isDark ? "#43d0a3" : "#0b9f80",
    accentSoft: isDark ? "#24493f" : "#d8f4ec",
    danger: isDark ? "#ff7f7f" : "#d63636",
    dangerBg: isDark ? "#3f2424" : "#ffe5e5",
  };

  const setStudioAudioMode = async (recordingEnabled: boolean) => {
    await Audio.setAudioModeAsync(
      recordingEnabled ? RECORDING_AUDIO_MODE : PLAYBACK_AUDIO_MODE,
    );
  };

  const clearPlaybackInterval = () => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
  };

  const clearRecordingInterval = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const clearDelayedPlayTimeouts = () => {
    delayedPlayTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    delayedPlayTimeoutsRef.current = [];
  };

  const startPlaybackInterval = () => {
    clearPlaybackInterval();

    playbackIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - masterTimerStartRef.current;
      setPosition(elapsed);

      if (
        durationRef.current > 0 &&
        elapsed >= durationRef.current - 120 &&
        stopPlaybackRef.current
      ) {
        void stopPlaybackRef.current();
      }
    }, 120);
  };

  const startRecordingInterval = () => {
    clearRecordingInterval();

    recordingIntervalRef.current = setInterval(() => {
      setRecordingElapsed(Date.now() - recordingStartedAtRef.current);
    }, 120);
  };

  const mapBaseTracks = (tracks: HymnAudioTrack[]): StudioTrack[] => {
    return tracks.map((track, index) => ({
      ...track,
      id: `base-${track.fileId || track.instrument}-${index}`,
      sourceType: "base",
      isLoaded: false,
      sound: undefined,
    }));
  };

  const mapRecordingToTrack = (recording: LocalHymnRecording): StudioTrack => {
    const date = new Date(recording.createdAt);
    const timeLabel = `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    const timingOffsetMs = recording.timingOffsetMs || 0;

    return {
      id: `recording-${recording.id}`,
      sourceType: "recording",
      instrument: `voz gravada ${timeLabel}`,
      fileId: recording.id,
      downloadUrl: recording.uri,
      volume: 1,
      isMuted: false,
      isLoaded: false,
      sound: undefined,
      offsetMs: timingOffsetMs,
      displayOrder: 999,
      hymnNumber,
      createdAt: recording.createdAt,
      timingOffsetMs,
    };
  };

  const loadRecordingTrackOffsets = async (
    hymnNumberValue: number,
  ): Promise<Record<string, number>> => {
    try {
      const settingKey = `${RECORDING_TRACK_OFFSETS_SETTING_PREFIX}:${hymnNumberValue}`;
      const raw = await DatabaseService.getSetting(settingKey);

      if (!raw) {
        setRecordingTrackOffsets({});
        recordingTrackOffsetsRef.current = {};
        return {};
      }

      const parsed = JSON.parse(raw) as Record<string, number>;
      const sanitized: Record<string, number> = {};

      Object.entries(parsed || {}).forEach(([key, value]) => {
        if (!Number.isFinite(value)) return;
        sanitized[key] = Math.max(
          DRAG_OFFSET_MIN_MS,
          Math.min(DRAG_OFFSET_MAX_MS, Math.round(value)),
        );
      });

      setRecordingTrackOffsets(sanitized);
      recordingTrackOffsetsRef.current = sanitized;
      return sanitized;
    } catch {
      setRecordingTrackOffsets({});
      recordingTrackOffsetsRef.current = {};
      return {};
    }
  };

  const persistRecordingTrackOffsets = async (
    hymnNumberValue: number,
    offsets: Record<string, number>,
  ) => {
    try {
      const settingKey = `${RECORDING_TRACK_OFFSETS_SETTING_PREFIX}:${hymnNumberValue}`;
      await DatabaseService.saveSetting(settingKey, JSON.stringify(offsets));
    } catch {
      // Ignora falhas de persistencia
    }
  };

  const updateTrackById = (
    trackId: string,
    updater: (track: StudioTrack) => StudioTrack,
  ) => {
    setBaseTracks((prev) =>
      prev.map((track) => (track.id === trackId ? updater(track) : track)),
    );
    setRecordingTracks((prev) =>
      prev.map((track) => (track.id === trackId ? updater(track) : track)),
    );
  };

  const syncBaseSelectionToMuteState = async (nextSelectedIds: string[]) => {
    setBaseTracks((prev) =>
      prev.map((track) => {
        const shouldMute = !nextSelectedIds.includes(track.id);

        if (track.isMuted === shouldMute) {
          return track;
        }

        return {
          ...track,
          isMuted: shouldMute,
        };
      }),
    );

    const loadedBaseTracks = allTracksRef.current.filter(
      (track) => track.sourceType === "base" && track.sound && track.isLoaded,
    );

    await Promise.all(
      loadedBaseTracks.map(async (track) => {
        const shouldMute = !nextSelectedIds.includes(track.id);
        await track.sound!.setVolumeAsync(shouldMute ? 0 : track.volume).catch(() => {});
      }),
    );
  };

  const ensureTracksLoaded = async (trackIds: string[]): Promise<StudioTrack[]> => {
    if (trackIds.length === 0) return [];

    const targetTracks = allTracksRef.current.filter((track) =>
      trackIds.includes(track.id),
    );

    const loadedTracks = await Promise.all(
      targetTracks.map(async (track) => {
        if (track.isLoaded && track.sound) {
          return track;
        }

        const sound = await hymnAudioService.loadTrack(track);

        return {
          ...track,
          sound: sound || undefined,
          isLoaded: Boolean(sound),
        };
      }),
    );

    const updates = new Map(loadedTracks.map((track) => [track.id, track]));

    setBaseTracks((prev) => prev.map((track) => updates.get(track.id) || track));
    setRecordingTracks((prev) =>
      prev.map((track) => updates.get(track.id) || track),
    );

    return loadedTracks.filter((track) => track.isLoaded && track.sound);
  };

  const getMaxDuration = async (tracks: StudioTrack[]) => {
    const loadedTracks = tracks.filter((track) => track.isLoaded && track.sound);

    if (loadedTracks.length === 0) {
      return 0;
    }

    const durations = await Promise.all(
      loadedTracks.map(async (track) => {
        const status = await track.sound!.getStatusAsync();
        if (!status.isLoaded) return 0;
        return (status.durationMillis || 0) + Math.max(0, track.offsetMs || 0);
      }),
    );

    return Math.max(...durations, 0);
  };

  const playTracksWithOffsets = async (tracks: StudioTrack[]) => {
    if (tracks.length === 0) return;

    clearDelayedPlayTimeouts();

    await Promise.all(
      tracks.map(async (track) => {
        if (!track.sound) return;
        await track.sound.stopAsync().catch(() => {});
        await track.sound.setPositionAsync(0).catch(() => {});
      }),
    );

    const immediateTracks = tracks.filter(
      (track) => (track.offsetMs || 0) <= 0,
    );
    const delayedTracks = tracks.filter((track) => (track.offsetMs || 0) > 0);

    await Promise.all(
      immediateTracks.map(async (track) => {
        if (!track.sound) return;

        const offsetMs = track.offsetMs || 0;
        if (offsetMs < 0) {
          await track.sound
            .setPositionAsync(Math.abs(offsetMs))
            .catch(() => {});
        }

        await track.sound.playAsync().catch(() => {});
      }),
    );

      delayedTracks.forEach((track) => {
      if (!track.sound) return;

      const timeoutId = setTimeout(() => {
        void track.sound?.playAsync().catch(() => {});
      }, track.offsetMs || 0);

      delayedPlayTimeoutsRef.current.push(timeoutId);
    });
  };

  const playFromTimelinePosition = async (
    tracks: StudioTrack[],
    timelinePositionMs: number,
  ) => {
    if (tracks.length === 0) return;

    clearDelayedPlayTimeouts();

    const immediateTracks: StudioTrack[] = [];

    await Promise.all(
      tracks.map(async (track) => {
        if (!track.sound) return;

        const offsetMs = track.offsetMs || 0;
        const sourcePositionMs = timelinePositionMs - offsetMs;

        await track.sound.stopAsync().catch(() => {});

        if (sourcePositionMs <= 0) {
          await track.sound.setPositionAsync(0).catch(() => {});
          const delayMs = Math.abs(sourcePositionMs);
          const timeoutId = setTimeout(() => {
            void track.sound?.playAsync().catch(() => {});
          }, delayMs);
          delayedPlayTimeoutsRef.current.push(timeoutId);
          return;
        }

        await track.sound.setPositionAsync(sourcePositionMs).catch(() => {});
        immediateTracks.push(track);
      }),
    );

    await Promise.all(
      immediateTracks.map(async (track) => {
        await track.sound?.playAsync().catch(() => {});
      }),
    );
  };

  const stopPlayback = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      clearPlaybackInterval();
      clearDelayedPlayTimeouts();

      const tracks = allTracksRef.current;
      if (tracks.length > 0) {
        await hymnAudioService.stopAll(tracks);
      }

      setIsPlaying(false);
      setPosition(0);
      masterTimerStartRef.current = 0;
    } finally {
      isStoppingRef.current = false;
    }
  };

  stopPlaybackRef.current = stopPlayback;

  const stopRecording = async (showSavedMessage: boolean = true) => {
    const activeRecording = recordingRef.current;
    if (!activeRecording) return false;

    if (!Number.isFinite(hymnNumber)) {
      throw new Error("Numero do hino invalido para salvar a gravacao");
    }

    setIsBusy(true);

    try {
      const savedRecording = await hymnRecordingService.stopAndSaveRecording(
        activeRecording,
        hymnNumber,
        recordingOffsetMs,
      );

      recordingRef.current = null;
      clearRecordingInterval();
      setIsRecording(false);
      setRecordingElapsed(0);

      await stopPlayback();
      await setStudioAudioMode(false);

      setRecordings((prev) => [savedRecording, ...prev]);
      const persistedTrackOffset =
        recordingTrackOffsetsRef.current[savedRecording.id] ??
        savedRecording.timingOffsetMs ??
        0;

      setRecordingTracks((prev) => [
        {
          ...mapRecordingToTrack(savedRecording),
          offsetMs: persistedTrackOffset,
          timingOffsetMs: persistedTrackOffset,
        },
        ...prev,
      ]);

      if (showSavedMessage) {
        Alert.alert("Gravacao salva", "Sua faixa foi salva localmente no aparelho.");
      }

      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel finalizar a gravacao";
      Alert.alert("Erro na gravacao", message);
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const cleanupStudio = async () => {
    clearPlaybackInterval();
    clearRecordingInterval();
    clearDelayedPlayTimeouts();

    const tracks = allTracksRef.current;
    if (tracks.length > 0) {
      await hymnAudioService.stopAll(tracks).catch(() => {});
      await hymnAudioService.unloadAll(tracks).catch(() => {});
    }

    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }

    await setStudioAudioMode(false).catch(() => {});
  };

  const initializeStudio = async () => {
    if (!Number.isFinite(hymnNumber)) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      await setStudioAudioMode(false);
      const savedTrackOffsets = await loadRecordingTrackOffsets(hymnNumber);

      const [loadedHymn, loadedBaseTracks, loadedRecordings] =
        await Promise.all([
          harpaOfflineService.getHymnByNumber(hymnNumber),
          hymnAudioService.searchHymnAudios(hymnNumber),
          hymnRecordingService.listRecordings(hymnNumber),
        ]);

      setHymn(loadedHymn);

      const normalizedBaseTracks = mapBaseTracks(loadedBaseTracks).map((track) => ({
        ...track,
        isMuted: false,
      }));
      setBaseTracks(normalizedBaseTracks);
      const initialSelectedBaseTrackIds = normalizedBaseTracks.map(
        (track) => track.id,
      );
      setSelectedBaseTrackIds(initialSelectedBaseTrackIds);
      selectedBaseTrackIdsRef.current = initialSelectedBaseTrackIds;

      setRecordings(loadedRecordings);
      setRecordingTracks(
        loadedRecordings.map((recording) => {
          const mapped = mapRecordingToTrack(recording);
          const persisted = savedTrackOffsets[recording.id];
          if (Number.isFinite(persisted)) {
            return {
              ...mapped,
              offsetMs: persisted,
              timingOffsetMs: persisted,
            };
          }
          return mapped;
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar o estudio";
      Alert.alert("Erro", message);
    } finally {
      setLoading(false);
    }
  };

  const loadTheme = async () => {
    try {
      const settings = await DatabaseService.getMultipleSettings(["theme"]);
      const userTheme = settings.theme as "light" | "dark" | null;
      setTheme(userTheme || "light");
    } catch {
      setTheme("light");
    }
  };

  const loadRecordingOffset = async () => {
    try {
      const savedOffsetRaw = await DatabaseService.getSetting(
        RECORDING_OFFSET_SETTING_KEY,
      );

      if (!savedOffsetRaw) return;

      const parsedOffset = Number.parseInt(savedOffsetRaw, 10);
      if (!Number.isFinite(parsedOffset)) return;

      const normalizedOffset = Math.max(
        RECORDING_OFFSET_MIN_MS,
        Math.min(RECORDING_OFFSET_MAX_MS, parsedOffset),
      );
      setRecordingOffsetMs(normalizedOffset);
    } catch {
      // Ignora erros de preferencia e segue com padrao 0ms
    }
  };

  const persistRecordingOffset = async (offsetMs: number) => {
    try {
      await DatabaseService.saveSetting(
        RECORDING_OFFSET_SETTING_KEY,
        String(offsetMs),
      );
    } catch {
      // Ignora falha de persistencia para nao bloquear gravacao
    }
  };

  useEffect(() => {
    void loadTheme();
    void loadRecordingOffset();
  }, []);

  const handleRecordingOffsetChange = (nextOffsetMs: number) => {
    const normalizedOffset = Math.round(
      Math.max(RECORDING_OFFSET_MIN_MS, Math.min(RECORDING_OFFSET_MAX_MS, nextOffsetMs)),
    );

    setRecordingOffsetMs(normalizedOffset);
    void persistRecordingOffset(normalizedOffset);
  };

  const updateRecordingTrackOffset = (
    track: StudioTrack,
    nextOffsetMs: number,
    shouldPersist: boolean = true,
  ) => {
    if (!Number.isFinite(hymnNumber)) return;

    const normalizedOffset = Math.max(
      DRAG_OFFSET_MIN_MS,
      Math.min(
        DRAG_OFFSET_MAX_MS,
        Math.round(nextOffsetMs / TRACK_OFFSET_ROUND_STEP) *
          TRACK_OFFSET_ROUND_STEP,
      ),
    );

    updateTrackById(track.id, (current) => ({
      ...current,
      offsetMs: normalizedOffset,
      timingOffsetMs: normalizedOffset,
    }));

    const recordingFileId = track.fileId;
    if (!recordingFileId) return;

    const nextOffsets = {
      ...recordingTrackOffsetsRef.current,
      [recordingFileId]: normalizedOffset,
    };

    recordingTrackOffsetsRef.current = nextOffsets;
    setRecordingTrackOffsets(nextOffsets);
    if (shouldPersist) {
      void persistRecordingTrackOffsets(hymnNumber, nextOffsets);
    }
  };

  const offsetPresets = [
    { label: "-300ms", value: -300 },
    { label: "-200ms", value: -200 },
    { label: "-100ms", value: -100 },
    { label: "0ms", value: 0 },
    { label: "+80ms", value: 80 },
    { label: "+100ms", value: 100 },
    { label: "+160ms", value: 160 },
    { label: "+200ms", value: 200 },
    { label: "+300ms", value: 300 },
  ];

  useEffect(() => {
    if (theme === null) return;
    void initializeStudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, hymnNumber]);

  useEffect(() => {
    return () => {
      void cleanupStudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBackPress = () => {
    if (isRecording) {
      Alert.alert(
        "Gravacao em andamento",
        "Se sair agora, a gravacao atual sera interrompida. Deseja parar e salvar antes de sair?",
        [
          { text: "Continuar gravando", style: "cancel" },
          {
            text: "Parar e sair",
            style: "destructive",
            onPress: () => {
              void (async () => {
                const stopped = await stopRecording(false);
                if (!stopped) return;

                await cleanupStudio();
                router.back();
              })();
            },
          },
        ],
      );
      return;
    }

    void (async () => {
      await cleanupStudio();
      router.back();
    })();
  };

  handleBackPressRef.current = handleBackPress;

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleBackPressRef.current();
        return true;
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const handlePlayPause = async () => {
    if (isBusy || isRecording) return;

    const availableTrackIds = allTracksRef.current.map((track) => track.id);
    if (availableTrackIds.length === 0) {
      Alert.alert("Sem faixas", "Nao ha bases nem gravacoes para reproduzir.");
      return;
    }

    setIsBusy(true);

    try {
      if (isPlaying) {
        await hymnAudioService.pauseAll(allTracksRef.current);
        setIsPlaying(false);
        clearPlaybackInterval();
        masterTimerStartRef.current = 0;
        return;
      }

      await setStudioAudioMode(false);
      const loadedTracks = await ensureTracksLoaded(availableTrackIds);

      if (loadedTracks.length === 0) {
        throw new Error("Nenhuma faixa pode ser carregada no momento");
      }

      if (position > 0) {
        await playFromTimelinePosition(loadedTracks, position);
      } else {
        await playTracksWithOffsets(loadedTracks);
      }

      const calculatedDuration = await getMaxDuration(loadedTracks);
      setDuration(calculatedDuration);
      masterTimerStartRef.current = Date.now() - position;
      setIsPlaying(true);
      startPlaybackInterval();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao iniciar reproducao";
      Alert.alert("Falha no player", message);
      setIsPlaying(false);
      clearPlaybackInterval();
    } finally {
      setIsBusy(false);
    }
  };

  const handleSeek = async (nextPosition: number) => {
    const loadedTracks = allTracksRef.current.filter(
      (track) => track.isLoaded && track.sound,
    );

    setPosition(nextPosition);

    if (loadedTracks.length === 0) {
      return;
    }

    try {
      await Promise.all(
        loadedTracks.map(async (track) => {
          const desiredSourcePosition = Math.max(
            0,
            nextPosition - (track.offsetMs || 0),
          );
          await track.sound?.setPositionAsync(desiredSourcePosition).catch(() => {});
        }),
      );

      if (isPlaying) {
        await playFromTimelinePosition(loadedTracks, nextPosition);
        masterTimerStartRef.current = Date.now() - nextPosition;
      }
    } catch {
      // Ignora erro de seek para nao quebrar a sessao
    }
  };

  const handleRecordToggle = async () => {
    if (isBusy) return;

    if (isRecording) {
      await stopRecording();
      return;
    }

    setIsBusy(true);

    try {
      await stopPlayback();
      await setStudioAudioMode(true);

      const selectedIds = selectedBaseTrackIdsRef.current;
      let loadedSelectedBaseTracks: StudioTrack[] = [];

      if (selectedIds.length > 0) {
        loadedSelectedBaseTracks = await ensureTracksLoaded(selectedIds);

        if (loadedSelectedBaseTracks.length > 0) {
          await playTracksWithOffsets(loadedSelectedBaseTracks);
          const calculatedDuration = await getMaxDuration(loadedSelectedBaseTracks);
          setDuration(calculatedDuration);
          setPosition(0);
          masterTimerStartRef.current = Date.now();
          setIsPlaying(true);
          startPlaybackInterval();
        }
      }

      const recording = await hymnRecordingService.startRecording();
      recordingRef.current = recording;

      recordingStartedAtRef.current = Date.now();
      setRecordingElapsed(0);
      setIsRecording(true);
      startRecordingInterval();

      if (selectedIds.length > 0 && loadedSelectedBaseTracks.length === 0) {
        Alert.alert(
          "Bases indisponiveis",
          "As bases selecionadas nao puderam ser carregadas. A gravacao iniciou sem acompanhamento.",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel iniciar a gravacao";
      Alert.alert("Erro", message);

      setIsRecording(false);
      clearRecordingInterval();
      await stopPlayback();
      await setStudioAudioMode(false).catch(() => {});
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleBaseTrack = (trackId: string) => {
    if (isRecording) return;

    const currentSelectedIds = selectedBaseTrackIdsRef.current;
    const nextSelectedIds = currentSelectedIds.includes(trackId)
      ? currentSelectedIds.filter((id) => id !== trackId)
      : [...currentSelectedIds, trackId];

    setSelectedBaseTrackIds(nextSelectedIds);
    selectedBaseTrackIdsRef.current = nextSelectedIds;
    void syncBaseSelectionToMuteState(nextSelectedIds);
  };

  const handleVolumeChange = async (trackIndex: number, nextVolume: number) => {
    const track = allTracksRef.current[trackIndex];
    if (!track) return;

    if (track.sound && track.isLoaded && !track.isMuted) {
      await hymnAudioService.setTrackVolume(track, nextVolume);
    }

    updateTrackById(track.id, (current) => ({ ...current, volume: nextVolume }));
  };

  const handleMuteToggle = async (trackIndex: number) => {
    const track = allTracksRef.current[trackIndex];
    if (!track) return;

    const nextMuted = !track.isMuted;

    if (track.sound && track.isLoaded) {
      await track.sound.setVolumeAsync(nextMuted ? 0 : track.volume);
    }

    updateTrackById(track.id, (current) => ({ ...current, isMuted: nextMuted }));
  };

  const handleExportRecording = async (recording: LocalHymnRecording) => {
    try {
      await hymnRecordingService.exportRecording(recording);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao exportar gravacao";
      Alert.alert("Erro ao exportar", message);
    }
  };

  const deleteRecording = async (recording: LocalHymnRecording) => {
    const recordingTrackId = `recording-${recording.id}`;

    await stopPlayback();

    const track = allTracksRef.current.find((item) => item.id === recordingTrackId);
    if (track) {
      await hymnAudioService.unloadAll([track]).catch(() => {});
    }

    await hymnRecordingService.deleteRecording(recording);

    if (Number.isFinite(hymnNumber)) {
      const nextOffsets = { ...recordingTrackOffsetsRef.current };
      delete nextOffsets[recording.id];
      recordingTrackOffsetsRef.current = nextOffsets;
      setRecordingTrackOffsets(nextOffsets);
      void persistRecordingTrackOffsets(hymnNumber, nextOffsets);
    }

    setRecordings((prev) => prev.filter((item) => item.id !== recording.id));
    setRecordingTracks((prev) =>
      prev.filter((trackItem) => trackItem.id !== recordingTrackId),
    );
  };

  const handleDeleteRecording = (recording: LocalHymnRecording) => {
    Alert.alert("Excluir gravacao", "Deseja remover esta gravacao do aparelho?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteRecording(recording);
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Erro ao excluir gravacao";
              Alert.alert("Erro", message);
            }
          })();
        },
      },
    ]);
  };

  if (theme === null) {
    return null;
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}> 
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={colors.headerBg}
        />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}> 
            Preparando estudio...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!Number.isFinite(hymnNumber) || !hymn) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}> 
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={colors.headerBg}
        />
        <View style={[styles.header, { backgroundColor: colors.headerBg }]}> 
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Estudio</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Hino invalido</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}> 
            Nao foi possivel abrir o estudio para este hino.
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
          { backgroundColor: colors.headerBg, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Estudio</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}> 
            Hino {hymn.number} - {hymn.title}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setShowMixer((prev) => !prev)}
          style={styles.iconButton}
          disabled={allTracks.length === 0}
        >
          <Ionicons
            name={showMixer ? "options" : "options-outline"}
            size={22}
            color={allTracks.length === 0 ? colors.textSecondary : colors.accent}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.transportCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.transportTopRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Transporte</Text>

            <View
              style={[
                styles.recordingBadge,
                {
                  backgroundColor: isRecording ? colors.dangerBg : colors.cardAlt,
                  borderColor: isRecording ? colors.danger : colors.border,
                },
              ]}
            >
              <Ionicons
                name="radio-button-on"
                size={10}
                color={isRecording ? colors.danger : colors.textSecondary}
              />
              <Text
                style={[
                  styles.recordingBadgeText,
                  { color: isRecording ? colors.danger : colors.textSecondary },
                ]}
              >
                {isRecording ? `REC ${formatTime(recordingElapsed)}` : "Pronto"}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.headphoneNotice,
              { backgroundColor: colors.accentSoft, borderColor: colors.accent },
            ]}
          >
            <Ionicons name="headset-outline" size={14} color={colors.accent} />
            <Text style={[styles.headphoneNoticeText, { color: colors.text }]}> 
              Dica: use fone de ouvido para evitar que a base vaze na gravacao.
            </Text>
          </View>

          <View style={styles.timelineRow}>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}> 
              {formatTime(position)}
            </Text>
            <Slider
              style={styles.timelineSlider}
              minimumValue={0}
              maximumValue={duration > 0 ? duration : 1}
              value={Math.min(position, duration > 0 ? duration : 1)}
              onSlidingComplete={handleSeek}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.accent}
              disabled={allTracks.length === 0 || isRecording}
            />
            <Text style={[styles.timeText, { color: colors.textSecondary }]}> 
              {formatTime(duration)}
            </Text>
          </View>

          <View style={styles.transportControls}>
            <TouchableOpacity
              style={[
                styles.transportButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.cardAlt,
                },
              ]}
              onPress={() => void stopPlayback()}
              disabled={isBusy || (!isPlaying && position === 0)}
            >
              <Ionicons
                name="stop"
                size={20}
                color={
                  isBusy || (!isPlaying && position === 0)
                    ? colors.textSecondary
                    : colors.text
                }
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.playButton,
                {
                  backgroundColor:
                    allTracks.length === 0 || isBusy ? colors.border : colors.accent,
                },
              ]}
              onPress={() => void handlePlayPause()}
              disabled={allTracks.length === 0 || isBusy || isRecording}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={24}
                  color="#fff"
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.recordButton,
                {
                  backgroundColor: isRecording ? colors.danger : colors.dangerBg,
                  borderColor: colors.danger,
                },
              ]}
              onPress={() => void handleRecordToggle()}
              disabled={isBusy}
            >
              <Ionicons
                name={isRecording ? "square" : "radio-button-on"}
                size={20}
                color={isRecording ? "#fff" : colors.danger}
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.transportHint, { color: colors.textSecondary }]}> 
            Para melhor resultado na gravacao, use fone de ouvido e evite retorno no alto-falante.
          </Text>

          <View style={styles.offsetSection}>
            <Text style={[styles.offsetTitle, { color: colors.text }]}> 
              Compensacao Bluetooth da gravacao
            </Text>
            <Text style={[styles.offsetSubtitle, { color: colors.textSecondary }]}> 
              Ajuste para alinhar a voz gravada com a base quando usar fone Bluetooth.
            </Text>

            <View style={styles.offsetSliderRow}>
              <Text style={[styles.offsetLabel, { color: colors.textSecondary }]}> 
                -1.0s
              </Text>
              <Slider
                style={styles.offsetSlider}
                minimumValue={RECORDING_OFFSET_MIN_MS}
                maximumValue={RECORDING_OFFSET_MAX_MS}
                step={10}
                value={recordingOffsetMs}
                onValueChange={handleRecordingOffsetChange}
                minimumTrackTintColor={colors.accent}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.accent}
                disabled={isRecording}
              />
              <Text style={[styles.offsetLabel, { color: colors.textSecondary }]}> 
                +1.0s
              </Text>
            </View>

            <Text style={[styles.offsetValue, { color: colors.accent }]}> 
              Offset atual: {recordingOffsetMs >= 0 ? "+" : ""}
              {recordingOffsetMs} ms
            </Text>

            <View style={styles.offsetPresetWrap}>
              {offsetPresets.map((preset) => {
                const isActive = preset.value === recordingOffsetMs;

                return (
                  <TouchableOpacity
                    key={preset.value}
                    style={[
                      styles.offsetPresetChip,
                      {
                        borderColor: isActive ? colors.accent : colors.border,
                        backgroundColor: isActive ? colors.accentSoft : colors.cardAlt,
                      },
                    ]}
                    onPress={() => handleRecordingOffsetChange(preset.value)}
                    disabled={isRecording}
                  >
                    <Text
                      style={[
                        styles.offsetPresetChipText,
                        { color: isActive ? colors.text : colors.textSecondary },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="layers-outline" size={18} color={colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}> 
              Bases de monitoramento ({baseTracks.length})
            </Text>
          </View>

          {baseTracks.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}> 
              Nenhuma base encontrada para este hino.
            </Text>
          ) : (
            <View style={styles.baseSelectorWrap}>
              {baseTracks.map((track) => {
                const isSelected = selectedBaseTrackIds.includes(track.id);

                return (
                  <TouchableOpacity
                    key={track.id}
                    style={[
                      styles.baseChip,
                      {
                        borderColor: isSelected ? colors.accent : colors.border,
                        backgroundColor: isSelected ? colors.accentSoft : colors.cardAlt,
                      },
                    ]}
                    onPress={() => handleToggleBaseTrack(track.id)}
                    disabled={isRecording}
                  >
                    <Ionicons
                      name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                      size={16}
                      color={isSelected ? colors.accent : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.baseChipText,
                        {
                          color: isSelected ? colors.text : colors.textSecondary,
                        },
                      ]}
                    >
                      {track.instrument}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="stats-chart-outline" size={18} color={colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}> 
              Linhas da sessao ({allTracks.length})
            </Text>
          </View>

          {allTracks.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}> 
              Grave sua voz para criar a primeira faixa da sessao.
            </Text>
          ) : (
            <View style={styles.laneList}>
              {allTracks.map((track) => {
                const selectedAsBase =
                  track.sourceType === "base" &&
                  selectedBaseTrackIds.includes(track.id);

                return (
                  <View
                    key={track.id}
                    style={[
                      styles.laneRow,
                      {
                        backgroundColor: colors.cardAlt,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.laneInfo}>
                      <View
                        style={[
                          styles.sourceTag,
                          {
                            backgroundColor:
                              track.sourceType === "base"
                                ? colors.accentSoft
                                : colors.dangerBg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.sourceTagText,
                            {
                              color:
                                track.sourceType === "base"
                                  ? colors.accent
                                  : colors.danger,
                            },
                          ]}
                        >
                          {track.sourceType === "base" ? "BASE" : "VOZ"}
                        </Text>
                      </View>

                      <View style={styles.laneTextWrap}>
                        <Text
                          style={[styles.laneTitle, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {track.instrument}
                        </Text>
                        <Text
                          style={[styles.laneSubtitle, { color: colors.textSecondary }]}
                        >
                          {selectedAsBase
                            ? "Toca junto no REC"
                            : track.sourceType === "base"
                              ? "Base disponivel"
                              : "Gravacao local"}
                        </Text>
                      </View>

                      {selectedAsBase && (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={colors.accent}
                        />
                      )}
                    </View>

                    <View style={[styles.levelBar, { backgroundColor: colors.border }]}> 
                      <View
                        style={[
                          styles.levelFill,
                          {
                            width: `${Math.max(
                              track.isMuted ? 6 : 12,
                              Math.round(track.volume * 100),
                            )}%`,
                            backgroundColor: track.isMuted
                              ? colors.textSecondary
                              : track.sourceType === "base"
                                ? colors.accent
                                : colors.danger,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {recordingTracks.length > 0 && (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="move-outline" size={18} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}> 
                Alinhamento fino das vozes
              </Text>
            </View>

            <Text style={[styles.waveAlignHint, { color: colors.textSecondary }]}> 
              Arraste cada onda para esquerda/direita e ajuste o encaixe com a base.
            </Text>

            <View style={styles.waveEditorsList}>
              {recordingTracks.map((track) => (
                <View
                  key={`align-${track.id}`}
                  style={[
                    styles.waveEditorCard,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.cardAlt,
                    },
                  ]}
                >
                  <View style={styles.waveEditorHeader}>
                    <Text
                      style={[styles.waveEditorTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {track.instrument}
                    </Text>
                    <Text style={[styles.waveEditorMeta, { color: colors.textSecondary }]}> 
                      {(track.offsetMs || 0) >= 0 ? "+" : ""}
                      {Math.round(track.offsetMs || 0)}ms
                    </Text>
                  </View>

                  <AlignmentWaveEditor
                    seed={`${track.fileId}-${track.createdAt || 0}`}
                    offsetMs={Math.round(track.offsetMs || 0)}
                    disabled={isRecording}
                    colors={colors}
                    onOffsetPreview={(nextOffset) =>
                      updateRecordingTrackOffset(track, nextOffset, false)
                    }
                    onOffsetCommit={(nextOffset) =>
                      updateRecordingTrackOffset(track, nextOffset)
                    }
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {showMixer && allTracks.length > 0 && (
          <HymnAudioMixer
            tracks={allTracks}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            isDark={isDark}
          />
        )}

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="mic-outline" size={18} color={colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}> 
              Gravacoes locais ({recordings.length})
            </Text>
          </View>

          {recordings.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}> 
              Nenhuma gravacao ainda. Pressione REC para iniciar.
            </Text>
          ) : (
            recordings.map((recording) => (
              <View
                key={recording.id}
                style={[
                  styles.recordingRow,
                  { backgroundColor: colors.cardAlt, borderColor: colors.border },
                ]}
              >
                <View style={styles.recordingInfoWrap}>
                  <Text style={[styles.recordingTitle, { color: colors.text }]}> 
                    Gravacao {formatDateTime(recording.createdAt)}
                  </Text>
                  <Text style={[styles.recordingMeta, { color: colors.textSecondary }]}> 
                    {formatTime(recording.durationMs || 0)} - {formatFileSize(recording.fileSize)}
                    {typeof recording.timingOffsetMs === "number"
                      ? ` - offset ${recording.timingOffsetMs >= 0 ? "+" : ""}${recording.timingOffsetMs}ms`
                      : ""}
                  </Text>
                </View>

                <View style={styles.recordingActions}>
                  <TouchableOpacity
                    style={styles.smallActionButton}
                    onPress={() => void handleExportRecording(recording)}
                  >
                    <Ionicons name="share-social-outline" size={18} color={colors.accent} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.smallActionButton}
                    onPress={() => handleDeleteRecording(recording)}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  transportCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  transportTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  recordingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  recordingBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timelineSlider: {
    flex: 1,
    height: 34,
  },
  timeText: {
    fontSize: 12,
    minWidth: 40,
    textAlign: "center",
  },
  transportControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  transportButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  recordButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  transportHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  headphoneNotice: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headphoneNoticeText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    lineHeight: 17,
  },
  offsetSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
    paddingTop: 10,
    marginTop: 2,
    gap: 6,
  },
  offsetTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  offsetSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  offsetSliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  offsetLabel: {
    fontSize: 11,
    minWidth: 34,
    textAlign: "center",
  },
  offsetSlider: {
    flex: 1,
    height: 34,
  },
  offsetValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  offsetPresetWrap: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  offsetPresetChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  offsetPresetChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  waveAlignHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  waveEditorsList: {
    gap: 10,
  },
  waveEditorCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  waveEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  waveEditorTitle: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  waveEditorMeta: {
    fontSize: 12,
    fontWeight: "600",
  },
  waveEditorWrap: {
    gap: 6,
  },
  waveEditorLabel: {
    fontSize: 11,
  },
  waveTrack: {
    borderWidth: 1,
    borderRadius: 10,
    height: 70,
    overflow: "hidden",
    justifyContent: "center",
  },
  waveTrackCenterLine: {
    position: "absolute",
    width: 2,
    top: 6,
    bottom: 6,
    left: "50%",
    marginLeft: -1,
    opacity: 0.5,
  },
  waveBlock: {
    position: "absolute",
    top: 12,
    width: DRAG_WAVEFORM_WIDTH,
    height: 46,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  waveBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 2,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  waveOffsetReadout: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  baseSelectorWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  baseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  baseChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  laneList: {
    gap: 10,
  },
  laneRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  laneInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sourceTag: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourceTagText: {
    fontSize: 10,
    fontWeight: "700",
  },
  laneTextWrap: {
    flex: 1,
  },
  laneTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  laneSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  levelBar: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  levelFill: {
    height: "100%",
    borderRadius: 999,
  },
  recordingRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  recordingInfoWrap: {
    flex: 1,
    marginRight: 10,
  },
  recordingTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  recordingMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  recordingActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  smallActionButton: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 15,
  },
  errorTitle: {
    fontSize: 18,
    marginTop: 10,
    fontWeight: "700",
  },
  errorText: {
    marginTop: 6,
    fontSize: 13,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
