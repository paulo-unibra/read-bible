import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatabaseService from '../services/DatabaseService';
import googleDriveService from '../services/GoogleDriveService';
import { Bible, DriveFile } from '../types';

export default function BibleManagerScreen() {
  const router = useRouter();
  const [availableBibles, setAvailableBibles] = useState<DriveFile[]>([]);
  const [localBibles, setLocalBibles] = useState<Bible[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await DatabaseService.init();

      // Load available bibles from Google Drive
      const driveFiles = await googleDriveService.listBibleFiles();
      setAvailableBibles(driveFiles);

      // Load local bibles
      const localBiblesData = await DatabaseService.getBibles();
      setLocalBibles(localBiblesData);
    } catch (error) {
      console.error('Error loading bible data:', error);
      Alert.alert('Erro', 'Falha ao carregar dados das Bíblias');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBible = async (driveFile: DriveFile) => {
    try {
      setDownloading(driveFile.id);
      
      // Download the bible file
      await googleDriveService.downloadBible(driveFile);
      
      // Parse bible info from filename
      const bibleInfo = googleDriveService.parseBibleInfo(driveFile.name);
      
      // Create bible record
      const bible: Bible = {
        id: bibleInfo.id || driveFile.id,
        name: bibleInfo.name || driveFile.name,
        abbreviation: bibleInfo.abbreviation || 'UNK',
        language: bibleInfo.language || 'Unknown',
        fileName: bibleInfo.fileName || driveFile.name,
        isDownloaded: true,
        downloadDate: new Date().toISOString(),
        size: driveFile.size ? parseInt(driveFile.size) : undefined,
      };

      // Save to database
      await DatabaseService.saveBible(bible);
      
      // Refresh local bibles list
      const updatedLocalBibles = await DatabaseService.getBibles();
      setLocalBibles(updatedLocalBibles);
      
      Alert.alert('Sucesso', `Bíblia "${bible.name}" baixada com sucesso!`);
    } catch (error) {
      console.error('Error downloading bible:', error);
      Alert.alert('Erro', 'Falha ao baixar a Bíblia');
    } finally {
      setDownloading(null);
    }
  };

  const handleDeleteBible = async (bible: Bible) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Deseja excluir a Bíblia "${bible.name}"?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteBible(bible.id);
              await googleDriveService.deleteBibleFile(bible.fileName);
              
              // Refresh local bibles list
              const updatedLocalBibles = await DatabaseService.getBibles();
              setLocalBibles(updatedLocalBibles);
              
              Alert.alert('Sucesso', 'Bíblia excluída com sucesso!');
            } catch (error) {
              console.error('Error deleting bible:', error);
              Alert.alert('Erro', 'Falha ao excluir a Bíblia');
            }
          },
        },
      ]
    );
  };

  const isDownloaded = (driveFile: DriveFile) => {
    return localBibles.some(bible => bible.fileName === driveFile.name);
  };

  const renderAvailableBible = ({ item }: { item: DriveFile }) => {
    const downloaded = isDownloaded(item);
    const bibleInfo = googleDriveService.parseBibleInfo(item.name);
    const isDownloadingThis = downloading === item.id;

    return (
      <View style={styles.bibleCard}>
        <View style={styles.bibleInfo}>
          <Text style={styles.bibleName}>{bibleInfo.name}</Text>
          <Text style={styles.bibleDetails}>
            {bibleInfo.language} • {bibleInfo.abbreviation}
          </Text>
          {item.size && (
            <Text style={styles.bibleSize}>
              {(parseInt(item.size) / 1024 / 1024).toFixed(1)} MB
            </Text>
          )}
        </View>
        
        <View style={styles.bibleActions}>
          {downloaded ? (
            <View style={styles.downloadedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.downloadedText}>Baixada</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.downloadButton, isDownloadingThis && styles.downloadingButton]}
              onPress={() => handleDownloadBible(item)}
              disabled={isDownloadingThis}
            >
              {isDownloadingThis ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="download" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderLocalBible = ({ item }: { item: Bible }) => (
    <View style={styles.bibleCard}>
      <View style={styles.bibleInfo}>
        <Text style={styles.bibleName}>{item.name}</Text>
        <Text style={styles.bibleDetails}>
          {item.language} • {item.abbreviation}
        </Text>
        {item.downloadDate && (
          <Text style={styles.downloadDate}>
            Baixada em {new Date(item.downloadDate).toLocaleDateString('pt-BR')}
          </Text>
        )}
      </View>
      
      <View style={styles.bibleActions}>
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => handleDeleteBible(item)}
        >
          <Ionicons name="trash" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gerenciar Bíblias</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gerenciar Bíblias</Text>
        <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Local Bibles Section */}
        <Text style={styles.sectionTitle}>Bíblias Baixadas ({localBibles.length})</Text>
        {localBibles.length > 0 ? (
          <FlatList
            data={localBibles}
            renderItem={renderLocalBible}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={styles.biblesList}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nenhuma Bíblia baixada</Text>
          </View>
        )}

        {/* Available Bibles Section */}
        <Text style={styles.sectionTitle}>Disponíveis para Download ({availableBibles.length})</Text>
        <FlatList
          data={availableBibles}
          renderItem={renderAvailableBible}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          style={styles.biblesList}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    marginTop: 16,
  },
  biblesList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  bibleCard: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  bibleInfo: {
    flex: 1,
  },
  bibleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bibleDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  bibleSize: {
    fontSize: 12,
    color: '#999',
  },
  downloadDate: {
    fontSize: 12,
    color: '#999',
  },
  bibleActions: {
    marginLeft: 16,
  },
  downloadButton: {
    backgroundColor: '#2196F3',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadingButton: {
    backgroundColor: '#999',
  },
  deleteButton: {
    backgroundColor: '#f44336',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  downloadedText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
});