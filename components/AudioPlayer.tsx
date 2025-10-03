import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AudioService from '../services/AudioService';

interface AudioPlayerProps {
  bookId: number;
  chapterNumber: number;
  bookName: string;
  isDark?: boolean;
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

  useEffect(() => {
    const unsubscribe = AudioService.addListener(setAudioState);
    return () => {
      unsubscribe();
    };
  }, []);

  const handleSeek = (value: number) => {
    const positionMillis = (value / 100) * audioState.duration;
    AudioService.seekTo(positionMillis);
  };

  const progress = audioState.duration > 0 ? (audioState.currentTime / audioState.duration) * 100 : 0;

  const modalBg = isDark ? '#1e1e1e' : '#fff';
  const textColor = isDark ? '#e0e0e0' : '#333';
  const iconColor = isDark ? '#90caf9' : '#2196F3';

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
              Reproduzindo Áudio
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={iconColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.audioContent}>
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
                maximumTrackTintColor={isDark ? '#555' : '#ddd'}
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
                onPress={() => AudioService.seekTo(Math.max(0, audioState.currentTime - 10000))}
                disabled={audioState.isLoading}
              >
                <Ionicons name="play-back" size={24} color={iconColor} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.playButton, { backgroundColor: iconColor }]}
                onPress={audioState.isPlaying ? AudioService.pause : AudioService.play}
                disabled={audioState.isLoading}
              >
                {audioState.isLoading ? (
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
                onPress={() => AudioService.seekTo(Math.min(audioState.duration, audioState.currentTime + 10000))}
                disabled={audioState.isLoading}
              >
                <Ionicons name="play-forward" size={24} color={iconColor} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.stopButton, { borderColor: isDark ? '#666' : '#ccc' }]}
              onPress={() => AudioService.stop()}
            >
              <Ionicons name="stop" size={20} color={isDark ? '#ccc' : '#666'} />
              <Text style={[styles.stopButtonText, { color: isDark ? '#ccc' : '#666' }]}>
                Parar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  bookId, 
  chapterNumber, 
  bookName,
  isDark = false 
}) => {
  const [audioState, setAudioState] = useState(AudioService.getState());
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = AudioService.addListener(setAudioState);
    return () => {
      unsubscribe();
    };
  }, []);

  const handleAudioPress = async () => {
    try {
      if (AudioService.isCurrentChapter(bookId, chapterNumber)) {
        // Se é o capítulo atual, abrir o modal
        setModalVisible(true);
      } else {
        // Se é um capítulo diferente, carregar e reproduzir
        await AudioService.loadAndPlay(bookId, chapterNumber);
        setModalVisible(true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao reproduzir áudio';
      
      // Se o erro for de arquivo não encontrado, mostrar mensagem mais amigável
      if (errorMessage.includes('not found') || errorMessage.includes('não disponível')) {
        Alert.alert(
          'Áudio Indisponível',
          `O áudio para ${bookName} ${chapterNumber} não está disponível.`
        );
      } else {
        Alert.alert('Erro no Áudio', errorMessage);
      }
    }
  };

  const isCurrentChapter = AudioService.isCurrentChapter(bookId, chapterNumber);
  const iconColor = isDark ? '#90caf9' : '#2196F3';
  const iconBg = isDark ? '#2a2a2a' : '#f8f9fa';

  return (
    <>
      <TouchableOpacity
        style={[
          styles.audioButton,
          { backgroundColor: iconBg, borderColor: iconColor },
          isCurrentChapter && audioState.isPlaying && styles.audioButtonPlaying
        ]}
        onPress={handleAudioPress}
        disabled={audioState.isLoading && !isCurrentChapter}
      >
        {audioState.isLoading && isCurrentChapter ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Ionicons 
            name={
              isCurrentChapter && audioState.isPlaying 
                ? "volume-high" 
                : "headset"
            } 
            size={20} 
            color={iconColor} 
          />
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  audioButtonPlaying: {
    shadowColor: '#2196F3',
    shadowOpacity: 0.3,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  audioContent: {
    padding: 24,
    alignItems: 'center',
  },
  chapterInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  chapterName: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 32,
  },
  slider: {
    height: 40,
    width: '100%',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 24,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  playButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  stopButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default AudioPlayer;