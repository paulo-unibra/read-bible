import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getFocusColors } from "../constants/design";
import AudioService from "../services/AudioService";
import AdBanner from "./AdBanner";
import { FOCUS_BOTTOM_NAV_HEIGHT } from "./FocusBottomNav";
interface AudioPlayerProps {
  bookId: number;
  chapterNumber: number;
  bookName: string;
  isDark?: boolean;
  onRequestNext?: () => void;
}

interface AudioPlayerModalProps {
  visible: boolean;
  onClose: () => void;
  bookName: string;
  chapterNumber: number;
  isDark?: boolean;
}

const AudioPlayerModal: React.FC<AudioPlayerModalProps> = ({
  visible,
  onClose,
  bookName,
  chapterNumber,
  isDark = false,
}) => {
  const insets = useSafeAreaInsets();
  const [audioState, setAudioState] = useState(AudioService.getState());
  const [, setCurrentTime] = useState(audioState.currentTime);

  useEffect(() => {
    console.log("[AudioPlayerModal] Visibility changed:", visible);
    if (visible) {
      const currentState = AudioService.getState();
      console.log("[AudioPlayerModal] Modal opened with state:", {
        isLoading: currentState.isLoading,
        isPlaying: currentState.isPlaying,
        downloadProgress: currentState.downloadProgress,
        currentBookId: currentState.currentBookId,
        currentChapter: currentState.currentChapter,
      });
    }
  }, [visible]);

  useEffect(() => {
    const updateState = (newState: any) => {
      console.log("[AudioPlayerModal] State updated:", {
        isLoading: newState.isLoading,
        isPlaying: newState.isPlaying,
        downloadProgress: newState.downloadProgress,
      });
      setAudioState(newState);
      setCurrentTime(newState.currentTime);
    };
    const unsubscribe = AudioService.addListener(updateState);
    return () => {
      unsubscribe();
    };
  }, []);

  const handleSeek = (value: number) => {
    const positionMillis = (value / 100) * audioState.duration;
    AudioService.seekTo(positionMillis);
  };

  const progress =
    audioState.duration > 0
      ? (audioState.currentTime / audioState.duration) * 100
      : 0;

  const focus = getFocusColors(isDark);

  // Só considera loading se não estiver tocando (evita mostrar loading durante prefetch)
  const isActuallyLoading = audioState.isLoading && !audioState.isPlaying;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalOverlay,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: FOCUS_BOTTOM_NAV_HEIGHT + insets.bottom + 12,
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
        />
        <View
          style={[styles.audioModal, { backgroundColor: focus.screen }]}
          accessibilityViewIsModal
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalHeading}>
              <Text
                style={[styles.chapterName, { color: focus.text }]}
                numberOfLines={1}
              >
                {bookName} {chapterNumber}
              </Text>
              <Text style={[styles.modalStatus, { color: focus.muted }]}>
                {isActuallyLoading
                  ? "Preparando áudio..."
                  : audioState.isPlaying
                    ? "Reproduzindo"
                    : "Pausado"}
              </Text>
            </View>
            {!isActuallyLoading && (
              <TouchableOpacity
                style={styles.headerAction}
                onPress={() => {
                  AudioService.stop();
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel="Parar áudio"
              >
                <Ionicons name="stop-outline" size={20} color={focus.muted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.headerAction}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar reprodutor"
            >
              <Ionicons name="close" size={22} color={focus.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={{
              paddingBottom: 12,
            }}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {isActuallyLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={focus.blueDark} />
                <Text style={[styles.loadingText, { color: focus.muted }]}>
                  O áudio começará em instantes.
                </Text>
              </View>
            ) : (
              <View style={styles.audioContent}>
                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={100}
                    value={progress}
                    onSlidingComplete={handleSeek}
                    minimumTrackTintColor={focus.blueDark}
                    maximumTrackTintColor={focus.line}
                    thumbTintColor={focus.blueDark}
                    accessibilityLabel="Progresso do áudio"
                  />
                  <View style={styles.timeContainer}>
                    <Text style={[styles.timeText, { color: focus.muted }]}>
                      {AudioService.formatTime(audioState.currentTime)}
                    </Text>
                    <Text style={[styles.timeText, { color: focus.muted }]}>
                      {AudioService.formatTime(audioState.duration)}
                    </Text>
                  </View>
                </View>

                {/* Controls */}
                <View style={styles.controlsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      { backgroundColor: focus.surface },
                    ]}
                    onPress={() =>
                      AudioService.seekTo(
                        Math.max(0, audioState.currentTime - 10000),
                      )
                    }
                    disabled={isActuallyLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Voltar 10 segundos"
                  >
                    <Ionicons
                      name="play-back"
                      size={18}
                      color={focus.blueDark}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.playButton,
                      { backgroundColor: focus.blueDark },
                    ]}
                    onPress={async () => {
                      try {
                        if (
                          audioState.currentTime === 0 &&
                          audioState.currentBookId !== null &&
                          audioState.currentChapter !== null
                        ) {
                          await AudioService.loadAndPlay(
                            audioState.currentBookId,
                            audioState.currentChapter,
                          );
                        } else {
                          if (audioState.isPlaying) {
                            await AudioService.pause();
                          } else {
                            await AudioService.play();
                          }
                        }
                      } catch (error: any) {
                        const errorMessage =
                          error?.message || "Erro desconhecido";
                        Alert.alert("Erro no Áudio", errorMessage);
                      }
                    }}
                    disabled={isActuallyLoading}
                    accessibilityRole="button"
                    accessibilityLabel={
                      audioState.isPlaying ? "Pausar áudio" : "Reproduzir áudio"
                    }
                  >
                    {isActuallyLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={isDark ? focus.screen : "#fff"}
                      />
                    ) : (
                      <Ionicons
                        name={audioState.isPlaying ? "pause" : "play"}
                        size={24}
                        color={isDark ? focus.screen : "#fff"}
                      />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      { backgroundColor: focus.surface },
                    ]}
                    onPress={() =>
                      AudioService.seekTo(
                        Math.min(
                          audioState.duration,
                          audioState.currentTime + 10000,
                        ),
                      )
                    }
                    disabled={isActuallyLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Avançar 10 segundos"
                  >
                    <Ionicons
                      name="play-forward"
                      size={18}
                      color={focus.blueDark}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {!isActuallyLoading && (
              <View
                style={[styles.adContainer, { borderTopColor: focus.line }]}
              >
                <AdBanner size="BANNER" />
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  bookId,
  chapterNumber,
  bookName,
  isDark = false,
  onRequestNext,
}) => {
  const [audioState, setAudioState] = useState(AudioService.getState());
  const [modalVisible, setModalVisible] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const updateState = (newState: typeof audioState) => {
      setAudioState(newState);

      // Se o áudio parou completamente, resetar estados locais
      if (!newState.isPlaying && !newState.isLoading && !newState.sound) {
        setLocalLoading(false);
        setIsProcessing(false);
      }
    };

    const unsubscribe = AudioService.addListener(updateState);

    const unEnd = AudioService.onEnded(() => {
      console.log("[AudioPlayer] onEnded callback triggered", {
        bookId,
        chapterNumber,
        isCurrentChapter: AudioService.isCurrentChapter(bookId, chapterNumber),
      });
      if (AudioService.isCurrentChapter(bookId, chapterNumber)) {
        console.log("[AudioPlayer] Calling onRequestNext");
        onRequestNext?.();
      } else {
        console.log(
          "[AudioPlayer] Not calling onRequestNext - not current chapter",
        );
      }
    });
    return () => {
      unsubscribe();
      unEnd();
    };
  }, [bookId, chapterNumber, onRequestNext]);

  const handleAudioPress = async () => {
    if (isProcessing) {
      console.log("[AudioPlayer] Already processing, ignoring click");
      return;
    }

    try {
      console.log("[AudioPlayer] handleAudioPress called", {
        bookId,
        chapterNumber,
        isCurrentChapter: AudioService.isCurrentChapter(bookId, chapterNumber),
      });

      if (AudioService.isCurrentChapter(bookId, chapterNumber)) {
        // Se é o capítulo atual, abrir o modal diretamente
        console.log("[AudioPlayer] Opening modal for current chapter");
        setModalVisible(true);
      } else {
        console.log("[AudioPlayer] Starting new audio load");
        setIsProcessing(true);
        // Mostrar loading local durante o download/carregamento
        setLocalLoading(true);

        try {
          console.log("[AudioPlayer] Calling AudioService.loadAndPlay...");
          // Carregar e reproduzir o áudio (download + preparação)
          await AudioService.loadAndPlay(bookId, chapterNumber, { bookName });
          console.log(
            "[AudioPlayer] AudioService.loadAndPlay completed successfully",
          );

          // Aguardar um momento para garantir que o estado foi atualizado
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Verificar se realmente está tocando antes de abrir o modal
          const currentState = AudioService.getState();
          console.log("[AudioPlayer] Current state before opening modal:", {
            isLoading: currentState.isLoading,
            isPlaying: currentState.isPlaying,
          });

          if (currentState.isPlaying) {
            console.log("[AudioPlayer] Opening modal after successful load");
            setModalVisible(true);
          } else {
            console.warn("[AudioPlayer] Audio not playing, not opening modal");
          }
        } finally {
          console.log("[AudioPlayer] Resetting localLoading and isProcessing");
          setLocalLoading(false);
          setIsProcessing(false);
        }
      }
    } catch (error) {
      console.error("[AudioPlayer] Error in handleAudioPress:", error);
      setLocalLoading(false);
      setIsProcessing(false);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao reproduzir áudio";

      // Se o erro for de arquivo não encontrado, mostrar mensagem mais amigável
      if (
        errorMessage.includes("not found") ||
        errorMessage.includes("não disponível")
      ) {
        Alert.alert(
          "Áudio Indisponível",
          `O áudio para ${bookName} ${chapterNumber} não está disponível.`,
        );
      } else {
        Alert.alert("Erro no Áudio", errorMessage);
      }
    }
  };

  const isCurrentChapter = AudioService.isCurrentChapter(bookId, chapterNumber);
  const isLoading = localLoading || (audioState.isLoading && isCurrentChapter);
  const downloadProgress = audioState.downloadProgress || 0;
  const showProgress =
    isLoading && downloadProgress > 0 && downloadProgress < 100;
  const focus = getFocusColors(isDark);
  const isPlaying = isCurrentChapter && audioState.isPlaying && !isLoading;
  const buttonColor = isPlaying
    ? isDark
      ? focus.screen
      : "#fff"
    : focus.blueDark;

  return (
    <>
      <TouchableOpacity
        style={[
          styles.audioButton,
          { backgroundColor: isPlaying ? focus.blueDark : focus.blueSoft },
        ]}
        onPress={handleAudioPress}
        disabled={isLoading || isProcessing}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={
          isLoading
            ? "Carregando áudio"
            : isPlaying
              ? "Abrir controles de áudio"
              : `Ouvir ${bookName} ${chapterNumber}`
        }
        accessibilityState={{
          disabled: isLoading || isProcessing,
          busy: isLoading || isProcessing,
        }}
      >
        <View style={styles.audioButtonIcon}>
          {isLoading ? (
            <ActivityIndicator size="small" color={buttonColor} />
          ) : (
            <Ionicons
              name={isPlaying ? "volume-high" : "headset-outline"}
              size={20}
              color={buttonColor}
            />
          )}
        </View>
        <Text style={[styles.audioButtonText, { color: buttonColor }]}>
          {showProgress
            ? `${downloadProgress}%`
            : isPlaying
              ? "Ouvindo"
              : "Ouvir"}
        </Text>
      </TouchableOpacity>

      <AudioPlayerModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        bookName={bookName}
        chapterNumber={chapterNumber}
        isDark={isDark}
      />
    </>
  );
};

const styles = StyleSheet.create({
  audioButton: {
    minWidth: 120,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  audioButtonIcon: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  audioButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    includeFontPadding: false,
  },
  modalOverlay: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: "rgba(15,23,42,0.25)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  audioModal: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  modalHeading: {
    flex: 1,
    gap: 2,
    paddingRight: 8,
  },
  modalStatus: {
    fontSize: 12,
  },
  headerAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  loadingContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    textAlign: "center",
  },
  audioContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: "center",
  },
  chapterName: {
    fontSize: 18,
    fontWeight: "600",
  },
  progressContainer: {
    width: "100%",
    marginBottom: 8,
  },
  slider: {
    height: 32,
    width: "100%",
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  adContainer: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
});

export default AudioPlayer;
