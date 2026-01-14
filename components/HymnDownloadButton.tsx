import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CacheStatus } from '../services/HymnCacheService';

interface HymnDownloadButtonProps {
  hymnNumber: number;
  cacheStatuses: Map<string, CacheStatus>;
  isDownloading: boolean;
  downloadProgress: number; // 0 a 1
  onDownload: () => void;
  onRemove?: () => void;
  isDark: boolean;
  compact?: boolean; // Modo compacto para integração com player
}

export default function HymnDownloadButton({
  hymnNumber,
  cacheStatuses,
  isDownloading,
  downloadProgress,
  onDownload,
  onRemove,
  isDark,
  compact = false,
}: HymnDownloadButtonProps) {
  const colors = {
    bg: isDark ? '#1e1e1e' : '#fff',
    border: isDark ? '#2b2b2b' : '#e0e0e0',
    text: isDark ? '#e0e0e0' : '#333',
    textSecondary: isDark ? '#b0b0b0' : '#666',
    accent: isDark ? '#81c784' : '#4CAF50',
    success: isDark ? '#66bb6a' : '#4CAF50',
    warning: isDark ? '#ffa726' : '#ff9800',
    danger: isDark ? '#ef5350' : '#f44336',
  };

  // Calcular estatísticas
  const totalTracks = cacheStatuses.size;
  const cachedTracks = Array.from(cacheStatuses.values()).filter(s => s.isCached).length;
  const isFullyCached = cachedTracks === totalTracks && totalTracks > 0;
  const isPartiallyCached = cachedTracks > 0 && cachedTracks < totalTracks;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const totalSize = Array.from(cacheStatuses.values())
    .filter(s => s.isCached && s.fileSize)
    .reduce((sum, s) => sum + (s.fileSize || 0), 0);

  if (totalTracks === 0) {
    return null; // Não mostrar se não há faixas
  }

  // Modo compacto - apenas botão de ação principal
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {/* Barra de progresso durante download */}
        {isDownloading && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${downloadProgress * 100}%`,
                    backgroundColor: colors.accent 
                  }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              Baixando... {Math.round(downloadProgress * 100)}%
            </Text>
          </View>
        )}

        {/* Botão de ação */}
        <View style={styles.actions}>
          {!isFullyCached && (
            <TouchableOpacity
              style={[
                styles.button,
                styles.downloadButton,
                { 
                  backgroundColor: colors.accent,
                  opacity: isDownloading ? 0.6 : 1,
                }
              ]}
              onPress={onDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.buttonText}>Baixando...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.buttonText}>
                    Baixar {totalTracks} {totalTracks === 1 ? 'faixa' : 'faixas'} ({cachedTracks}/{totalTracks})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isFullyCached && onRemove && (
            <TouchableOpacity
              style={[
                styles.button,
                styles.removeButton,
                { borderColor: colors.danger }
              ]}
              onPress={onRemove}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={[styles.buttonText, { color: colors.danger }]}>
                Remover Downloads
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info compacta */}
        {!isFullyCached && !isDownloading && (
          <Text style={[styles.compactInfo, { color: colors.textSecondary }]}>
            {totalTracks} {totalTracks === 1 ? 'faixa disponível' : 'faixas disponíveis'} para download
          </Text>
        )}
      </View>
    );
  }

  // Modo normal (original)

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      {/* Header com status */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          {isFullyCached ? (
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          ) : isPartiallyCached ? (
            <Ionicons name="cloud-download-outline" size={24} color={colors.warning} />
          ) : (
            <Ionicons name="cloud-offline-outline" size={24} color={colors.textSecondary} />
          )}
        </View>
        
        <View style={styles.statusInfo}>
          <Text style={[styles.statusTitle, { color: colors.text }]}>
            {isFullyCached ? 'Áudio Offline' : isPartiallyCached ? 'Parcialmente Baixado' : 'Áudio Online'}
          </Text>
          <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>
            {isFullyCached 
              ? `${totalTracks} ${totalTracks === 1 ? 'faixa' : 'faixas'} • ${formatFileSize(totalSize)}`
              : isPartiallyCached
              ? `${cachedTracks}/${totalTracks} faixas baixadas`
              : `${totalTracks} ${totalTracks === 1 ? 'faixa disponível' : 'faixas disponíveis'}`
            }
          </Text>
        </View>
      </View>

      {/* Barra de progresso durante download */}
      {isDownloading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${downloadProgress * 100}%`,
                  backgroundColor: colors.accent 
                }
              ]} 
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {Math.round(downloadProgress * 100)}%
          </Text>
        </View>
      )}

      {/* Botões de ação */}
      <View style={styles.actions}>
        {!isFullyCached && (
          <TouchableOpacity
            style={[
              styles.button,
              styles.downloadButton,
              { 
                backgroundColor: colors.accent,
                opacity: isDownloading ? 0.6 : 1,
              }
            ]}
            onPress={onDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.buttonText}>Baixando...</Text>
              </>
            ) : (
              <>
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.buttonText}>
                  {isPartiallyCached ? 'Baixar Restantes' : 'Baixar Áudios'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isFullyCached && onRemove && (
          <TouchableOpacity
            style={[
              styles.button,
              styles.removeButton,
              { borderColor: colors.danger }
            ]}
            onPress={onRemove}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            <Text style={[styles.buttonText, { color: colors.danger }]}>
              Remover Downloads
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista de faixas com status */}
      <View style={styles.tracksList}>
        {Array.from(cacheStatuses.entries()).map(([instrument, status], index) => (
          <View 
            key={instrument} 
            style={[
              styles.trackItem,
              index < cacheStatuses.size - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }
            ]}
          >
            <View style={styles.trackInfo}>
              <Ionicons 
                name={status.isCached ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={status.isCached ? colors.success : colors.textSecondary} 
              />
              <Text style={[styles.trackName, { color: colors.text }]}>
                {instrument.charAt(0).toUpperCase() + instrument.slice(1)}
              </Text>
            </View>
            {status.isCached && status.fileSize && (
              <Text style={[styles.trackSize, { color: colors.textSecondary }]}>
                {formatFileSize(status.fileSize)}
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Info adicional */}
      {!isFullyCached && (
        <View style={[styles.infoBox, { backgroundColor: isDark ? '#3d2b2b' : '#fff3e0' }]}>
          <Ionicons name="information-circle-outline" size={16} color={isDark ? '#ffb74d' : '#f57c00'} />
          <Text style={[styles.infoText, { color: isDark ? '#ffb74d' : '#f57c00' }]}>
            Para reproduzir o áudio, é necessário baixar as faixas. A letra do hino já está disponível para leitura.
          </Text>
        </View>
      )}
      
      {isFullyCached && (
        <View style={[styles.infoBox, { backgroundColor: isDark ? '#2b3d2b' : '#e8f5e9' }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.success} />
          <Text style={[styles.infoText, { color: isDark ? '#a5d6a7' : '#2e7d32' }]}>
            Este hino pode ser reproduzido sem conexão com a internet
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    gap: 8,
  },
  compactInfo: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusSubtitle: {
    fontSize: 13,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  downloadButton: {
    // backgroundColor definido dinamicamente
  },
  removeButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  tracksList: {
    marginTop: 8,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackName: {
    fontSize: 14,
  },
  trackSize: {
    fontSize: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
