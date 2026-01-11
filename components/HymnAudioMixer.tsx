import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { HymnAudioTrack } from '../services/HymnAudioService';

interface HymnAudioMixerProps {
  tracks: HymnAudioTrack[];
  onVolumeChange: (trackIndex: number, volume: number) => void;
  onMuteToggle: (trackIndex: number) => void;
  isDark: boolean;
}

export default function HymnAudioMixer({
  tracks,
  onVolumeChange,
  onMuteToggle,
  isDark,
}: HymnAudioMixerProps) {
  const colors = {
    bg: isDark ? '#1e1e1e' : '#fff',
    border: isDark ? '#2b2b2b' : '#e0e0e0',
    text: isDark ? '#e0e0e0' : '#333',
    textSecondary: isDark ? '#b0b0b0' : '#666',
    accent: isDark ? '#81c784' : '#4CAF50',
    muted: isDark ? '#616161' : '#9e9e9e',
  };

  const getInstrumentIcon = (instrument: string): keyof typeof Ionicons.glyphMap => {
    const lower = instrument.toLowerCase();
    if (lower.includes('voz') || lower.includes('vocal')) return 'mic';
    if (lower.includes('teclado') || lower.includes('piano')) return 'musical-notes';
    if (lower.includes('violao') || lower.includes('violão') || lower.includes('guitarra')) return 'musical-note';
    if (lower.includes('bateria') || lower.includes('drums')) return 'disc';
    if (lower.includes('baixo') || lower.includes('bass')) return 'radio';
    return 'musical-notes';
  };

  const formatInstrumentName = (instrument: string): string => {
    return instrument.charAt(0).toUpperCase() + instrument.slice(1);
  };

  if (tracks.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="options" size={20} color={colors.accent} />
        <Text style={[styles.title, { color: colors.text }]}>
          Mixer de Áudio ({tracks.length} {tracks.length === 1 ? 'faixa' : 'faixas'})
        </Text>
      </View>

      {tracks.map((track, index) => (
        <View key={index} style={[styles.trackRow, { borderBottomColor: colors.border }]}>
          <View style={styles.trackHeader}>
            <View style={styles.trackInfo}>
              <Ionicons
                name={getInstrumentIcon(track.instrument)}
                size={18}
                color={track.isMuted ? colors.muted : colors.accent}
              />
              <Text
                style={[
                  styles.trackName,
                  { color: track.isMuted ? colors.muted : colors.text },
                ]}
              >
                {formatInstrumentName(track.instrument)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.muteButton}
              onPress={() => onMuteToggle(index)}
            >
              <Ionicons
                name={track.isMuted ? 'volume-mute' : 'volume-high'}
                size={22}
                color={track.isMuted ? colors.muted : colors.accent}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.volumeControl}>
            <Ionicons
              name="volume-low"
              size={16}
              color={track.isMuted ? colors.muted : colors.textSecondary}
            />
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={track.isMuted ? 0 : track.volume}
              onValueChange={(value) => onVolumeChange(index, value)}
              minimumTrackTintColor={track.isMuted ? colors.muted : colors.accent}
              maximumTrackTintColor={colors.border}
              thumbTintColor={track.isMuted ? colors.muted : colors.accent}
              disabled={track.isMuted}
            />
            <Ionicons
              name="volume-high"
              size={16}
              color={track.isMuted ? colors.muted : colors.textSecondary}
            />
            <Text style={[styles.volumeText, { color: colors.textSecondary }]}>
              {track.isMuted ? '0%' : `${Math.round(track.volume * 100)}%`}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  trackRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  trackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackName: {
    fontSize: 15,
    fontWeight: '500',
  },
  muteButton: {
    padding: 4,
  },
  volumeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  volumeText: {
    fontSize: 12,
    minWidth: 35,
    textAlign: 'right',
  },
});
