import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdBanner from '../components/AdBanner';
import HymnAudioMixer from '../components/HymnAudioMixer';
import DatabaseService from '../services/DatabaseService';
import harpaService, { Hymn, HymnVerse } from '../services/HarpaService';
import hymnAudioService, { HymnAudioTrack } from '../services/HymnAudioService';

export default function HymnViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const hymnNumber = parseInt(params.hymnNumber as string);

  const [hymn, setHymn] = useState<Hymn | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontSizePref, setFontSizePref] = useState<'small' | 'medium' | 'large'>('medium');
  const [hymnFontSize, setHymnFontSize] = useState<'small' | 'medium' | 'large'>('medium');

  // Estados do player de áudio
  const [audioTracks, setAudioTracks] = useState<HymnAudioTrack[]>([]);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showMixer, setShowMixer] = useState(false);
  const playbackInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
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

    // Cleanup ao desmontar
    return () => {
      cleanupAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await DatabaseService.getMultipleSettings(['fontSize', 'theme', 'hymnFontSize']);
      const userFont = settings.fontSize as 'small' | 'medium' | 'large' | null;
      const userTheme = settings.theme as 'light' | 'dark' | null;
      const userHymnFont = settings.hymnFontSize as 'small' | 'medium' | 'large' | null;
      if (userFont) setFontSizePref(userFont);
      if (userTheme) setTheme(userTheme);
      if (userHymnFont) setHymnFontSize(userHymnFont);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const changeHymnFontSize = async (size: 'small' | 'medium' | 'large') => {
    setHymnFontSize(size);
    try {
      await DatabaseService.saveSetting('hymnFontSize', size);
    } catch (error) {
      console.error('Erro ao salvar tamanho da fonte:', error);
    }
  };

  const loadHymn = async () => {
    try {
      setLoading(true);
      const loadedHymn = await harpaService.getHymnByNumber(hymnNumber);
      setHymn(loadedHymn);
    } catch (error) {
      console.error('Erro ao carregar hino:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAudio = async () => {
    try {
      setIsLoadingAudio(true);
      console.log(`🎵 Buscando áudios do hino ${hymnNumber}...`);
      
      const tracks = await hymnAudioService.searchHymnAudios(hymnNumber);
      
      if (tracks.length > 0) {
        console.log(`✅ ${tracks.length} áudios encontrados, carregando...`);
        const loadedTracks = await hymnAudioService.loadAllTracks(tracks);
        setAudioTracks(loadedTracks);
        
        // Obter duração do primeiro áudio
        const firstDuration = await hymnAudioService.getDuration(loadedTracks);
        setDuration(firstDuration);
        
        console.log(`✅ Áudios carregados com sucesso!`);
      } else {
        console.log(`ℹ️ Nenhum áudio disponível para o hino ${hymnNumber}`);
      }
    } catch (error) {
      console.error('Erro ao carregar áudios:', error);
    } finally {
      setIsLoadingAudio(false);
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

  const startPlaybackInterval = () => {
    if (playbackInterval.current) {
      clearInterval(playbackInterval.current);
    }
    
    playbackInterval.current = setInterval(async () => {
      const currentPosition = await hymnAudioService.getPosition(audioTracks);
      setPosition(currentPosition);
      
      // Se chegou ao fim, parar
      if (currentPosition >= duration - 100) {
        await handleStop();
      }
    }, 100);
  };

  const handlePlayPause = async () => {
    try {
      if (audioTracks.length === 0) {
        console.log('ℹ️ Nenhum áudio disponível');
        return;
      }

      if (isPlaying) {
        await hymnAudioService.pauseAll(audioTracks);
        setIsPlaying(false);
        if (playbackInterval.current) {
          clearInterval(playbackInterval.current);
        }
      } else {
        await hymnAudioService.playAll(audioTracks);
        setIsPlaying(true);
        startPlaybackInterval();
      }
    } catch (error) {
      console.error('Erro ao tocar/pausar:', error);
    }
  };

  const handleStop = async () => {
    try {
      await hymnAudioService.stopAll(audioTracks);
      setIsPlaying(false);
      setPosition(0);
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
      }
    } catch (error) {
      console.error('Erro ao parar:', error);
    }
  };

  const handleSeek = async (value: number) => {
    try {
      await hymnAudioService.seekAll(audioTracks, value);
      setPosition(value);
    } catch (error) {
      console.error('Erro ao buscar posição:', error);
    }
  };

  const handleVolumeChange = async (trackIndex: number, volume: number) => {
    try {
      const updatedTracks = [...audioTracks];
      updatedTracks[trackIndex].volume = volume;
      
      if (!updatedTracks[trackIndex].isMuted) {
        await hymnAudioService.setTrackVolume(updatedTracks[trackIndex], volume);
      }
      
      setAudioTracks(updatedTracks);
    } catch (error) {
      console.error('Erro ao ajustar volume:', error);
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
      console.error('Erro ao mutar/desmutar:', error);
    }
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const applyFontScale = (base: number) => {
    switch (fontSizePref) {
      case 'small':
        return base * 0.9;
      case 'large':
        return base * 1.2;
      default:
        return base;
    }
  };

  const applyHymnFontScale = (base: number) => {
    switch (hymnFontSize) {
      case 'small':
        return base * 0.85;
      case 'large':
        return base * 1.3;
      default:
        return base;
    }
  };

  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#121212' : '#f5f5f5',
    headerBg: isDark ? '#1d1d1d' : '#fff',
    border: isDark ? '#2b2b2b' : '#e0e0e0',
    card: isDark ? '#1e1e1e' : '#fff',
    textPrimary: isDark ? '#e0e0e0' : '#333',
    textSecondary: isDark ? '#b0b0b0' : '#666',
    accent: isDark ? '#81c784' : '#4CAF50',
    chorusBg: isDark ? '#2b3d2b' : '#e8f5e9',
  };

  const renderVerse = (verse: HymnVerse, index: number) => {
    const isChorus = verse.type === 'chorus';

    return (
      <View
        key={`${verse.name}-${index}`}
        style={[
          styles.verseContainer,
          isChorus && { backgroundColor: colors.chorusBg, padding: 16, borderRadius: 8 },
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
                fontStyle: isChorus ? 'italic' : 'normal',
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
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.headerBg}
        />
        <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: applyFontScale(20) }]}>
            Hino {hymnNumber}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, fontSize: applyFontScale(16) }]}>
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
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.headerBg}
        />
        <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: applyFontScale(20) }]}>
            Harpa Cristã
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.textSecondary} />
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
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.headerBg}
      />
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: applyFontScale(20) }]} numberOfLines={1}>
          Hino {hymn.number}
        </Text>
        <View style={styles.fontControls}>
          <TouchableOpacity 
            onPress={() => changeHymnFontSize('small')}
            style={[styles.fontButton, hymnFontSize === 'small' && { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.fontButtonText, { color: hymnFontSize === 'small' ? '#fff' : colors.textPrimary }]}>A</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => changeHymnFontSize('medium')}
            style={[styles.fontButton, hymnFontSize === 'medium' && { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.fontButtonText, styles.fontButtonMedium, { color: hymnFontSize === 'medium' ? '#fff' : colors.textPrimary }]}>A</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => changeHymnFontSize('large')}
            style={[styles.fontButton, hymnFontSize === 'large' && { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.fontButtonText, styles.fontButtonLarge, { color: hymnFontSize === 'large' ? '#fff' : colors.textPrimary }]}>A</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Ad Banner */}
        <AdBanner />

        {/* Header Card */}
        <View style={[styles.headerCard, { backgroundColor: colors.card }]}>
          <View style={[styles.hymnNumberBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.hymnNumberText, { fontSize: applyHymnFontScale(24) }]}>
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
          {hymn.author && hymn.author !== 'Autor Desconhecido' && (
            <Text
              style={[
                styles.hymnAuthor,
                { color: colors.textSecondary, fontSize: applyHymnFontScale(14) },
              ]}
            >
              {hymn.author}
            </Text>
          )}
          {hymn.copyright && (
            <Text
              style={[
                styles.hymnCopyright,
                { color: colors.textSecondary, fontSize: applyHymnFontScale(12) },
              ]}
            >
              {hymn.copyright}
            </Text>
          )}
        </View>

        {/* Player de Áudio */}
        {audioTracks.length > 0 && (
          <View style={[styles.audioPlayer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.playerHeader}>
              <Ionicons name="musical-notes" size={24} color={colors.accent} />
              <Text style={[styles.playerTitle, { color: colors.textPrimary }]}>
                Áudio do Hino
              </Text>
              {isLoadingAudio && <ActivityIndicator size="small" color={colors.accent} />}
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
                  color={(!isPlaying && position === 0) ? colors.textSecondary : colors.accent} 
                />
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handlePlayPause}
                style={[styles.playButton, { backgroundColor: colors.accent }]}
              >
                <Ionicons 
                  name={isPlaying ? 'pause' : 'play'} 
                  size={36} 
                  color="#fff" 
                />
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setShowMixer(!showMixer)}
                style={styles.controlButton}
              >
                <Ionicons 
                  name={showMixer ? 'options' : 'options-outline'} 
                  size={32} 
                  color={colors.accent} 
                />
              </TouchableOpacity>
            </View>

            {/* Barra de progresso */}
            <View style={styles.progressContainer}>
              <Text style={[styles.timeText, { color: colors.textSecondary }]}>
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
              <Text style={[styles.timeText, { color: colors.textSecondary }]}>
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
          </View>
        )}

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  fontControls: {
    flexDirection: 'row',
    gap: 4,
  },
  fontButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  fontButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  hymnNumberBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  hymnNumberText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  hymnTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  hymnAuthor: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  hymnCopyright: {
    fontSize: 12,
    textAlign: 'center',
  },
  versesContent: {
    gap: 20,
  },
  verseContainer: {
    marginBottom: 8,
  },
  verseLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  verseLine: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 4,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  audioPlayer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  playerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  controlButton: {
    padding: 8,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
    elevation: 5,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressSlider: {
    flex: 1,
    height: 40,
  },
  timeText: {
    fontSize: 12,
    minWidth: 40,
    textAlign: 'center',
  },
});
