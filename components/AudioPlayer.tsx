import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { getFocusColors } from "../constants/design";
import AudioService from "../services/AudioService";
import AdBanner from "./AdBanner";
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

  const modalBg = isDark ? "#1e1e1e" : "#fff";
  const textColor = isDark ? "#e0e0e0" : "#333";
  const iconColor = isDark ? "#90caf9" : "#2196F3";

  // Só considera loading se não estiver tocando (evita mostrar loading durante prefetch)
  const isActuallyLoading = audioState.isLoading && !audioState.isPlaying;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.audioModal, { backgroundColor: modalBg }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: textColor }]}>
              {isActuallyLoading ? "Carregando Áudio..." : "Reproduzindo Áudio"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={iconColor} />
            </TouchableOpacity>
          </View>

          {isActuallyLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={iconColor} />
              <Text style={[styles.loadingText, { color: textColor }]}>
                Preparando áudio para {bookName} {chapterNumber}...
              </Text>
            </View>
          ) : (
            <View style={styles.audioContent}>
              {/* Ad Banner */}
              <AdBanner />

              <View style={styles.chapterInfo}>
                <Text style={[styles.chapterName, { color: textColor }]}>
                  {bookName} {chapterNumber}
                </Text>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100}
                  value={progress}
                  onSlidingComplete={handleSeek}
                  minimumTrackTintColor={iconColor}
                  maximumTrackTintColor={isDark ? "#555" : "#ddd"}
                  thumbTintColor={iconColor}
                />
                <View style={styles.timeContainer}>
                  <Text style={[styles.timeText, { color: textColor }]}>
                    {AudioService.formatTime(audioState.currentTime)}
                  </Text>
                  <Text style={[styles.timeText, { color: textColor }]}>
                    {AudioService.formatTime(audioState.duration)}
                  </Text>
                </View>
              </View>

              {/* Controls */}
              <View style={styles.controlsContainer}>
                <TouchableOpacity
                  style={[styles.controlButton, { borderColor: iconColor }]}
                  onPress={() =>
                    AudioService.seekTo(
                      Math.max(0, audioState.currentTime - 10000),
                    )
                  }
                  disabled={isActuallyLoading}
                >
                  <Ionicons name="play-back" size={24} color={iconColor} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.playButton, { backgroundColor: iconColor }]}
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
                >
                  {isActuallyLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons
                      name={audioState.isPlaying ? "pause" : "play"}
                      size={32}
                      color="#fff"
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.controlButton, { borderColor: iconColor }]}
                  onPress={() =>
                    AudioService.seekTo(
                      Math.min(
                        audioState.duration,
                        audioState.currentTime + 10000,
                      ),
                    )
                  }
                  disabled={isActuallyLoading}
                >
                  <Ionicons name="play-forward" size={24} color={iconColor} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.stopButton,
                  { borderColor: isDark ? "#666" : "#ccc" },
                ]}
                onPress={() => {
                  AudioService.stop();
                  onClose(); // Fechar modal ao parar
                }}
              >
                <Ionicons
                  name="stop"
                  size={20}
                  color={isDark ? "#ccc" : "#666"}
                />
                <Text
                  style={[
                    styles.stopButtonText,
                    { color: isDark ? "#ccc" : "#666" },
                  ]}
                >
                  Parar
                </Text>
              </TouchableOpacity>
            </View>
          )}
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

  return (
    <>
      <TouchableOpacity
        style={[
          styles.audioButton,
          { backgroundColor: focus.blueSoft },
          isCurrentChapter && audioState.isPlaying && styles.audioButtonPlaying,
        ]}
        onPress={handleAudioPress}
        disabled={isLoading || isProcessing}
      >
        {isLoading ? (
          showProgress ? (
            <Text style={[styles.progressText, { color: focus.blue }]}>
              {downloadProgress}%
            </Text>
          ) : (
            <ActivityIndicator size="small" color={focus.blue} />
          )
        ) : (
          <>
            <Ionicons name="headset" size={17} color={focus.blue} />
            <Text style={[styles.audioButtonText, { color: focus.blue }]}>Ouvir</Text>
          </>
        )}
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
    minWidth: 76,
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    borderWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  audioButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  audioButtonPlaying: {
    shadowColor: "#2196F3",
    shadowOpacity: 0.3,
    elevation: 4,
  },
  progressText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  audioModal: {
    width: "100%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: "600",
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
    padding: 12,
    paddingTop: 8,
    alignItems: "center",
  },
  chapterInfo: {
    alignItems: "center",
    marginBottom: 12,
  },
  chapterName: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  progressContainer: {
    width: "100%",
    marginBottom: 12,
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
    fontSize: 10,
    fontWeight: "500",
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 12,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  playButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  stopButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
});

export default AudioPlayer;
