import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatabaseService from '../services/DatabaseService';
import notificationService from '../services/NotificationService';
import { Bible } from '../types';

export default function SettingsScreen() {
  const router = useRouter();
  const [bibles, setBibles] = useState<Bible[]>([]);
  const [selectedBibleId, setSelectedBibleId] = useState<string>('');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationTime, setNotificationTime] = useState('08:00');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      await DatabaseService.init();
      
      // Load available bibles
      const localBibles = await DatabaseService.getBibles();
      const downloadedBibles = localBibles.filter(bible => bible.isDownloaded);
      setBibles(downloadedBibles);
      
      // Load user settings
      const preferredBibleId = await DatabaseService.getSetting('preferredBibleId') || downloadedBibles[0]?.id || '';
      const userFontSize = await DatabaseService.getSetting('fontSize') as 'small' | 'medium' | 'large' || 'medium';
      const userTheme = await DatabaseService.getSetting('theme') as 'light' | 'dark' || 'light';
      const notifEnabled = (await DatabaseService.getSetting('dailyNotificationEnabled')) === 'true';
      const notifTime = await DatabaseService.getSetting('notificationTime') || '08:00';
      
      setSelectedBibleId(preferredBibleId);
      setFontSize(userFontSize);
      setTheme(userTheme);
      setNotificationsEnabled(notifEnabled);
      setNotificationTime(notifTime);
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Erro', 'Falha ao carregar configurações');
    }
  };

  const saveSetting = async (key: string, value: string) => {
    try {
      await DatabaseService.saveSetting(key, value);
    } catch (error) {
      console.error('Error saving setting:', error);
      Alert.alert('Erro', 'Falha ao salvar configuração');
    }
  };

  const handleBibleChange = (bibleId: string) => {
    setSelectedBibleId(bibleId);
    saveSetting('preferredBibleId', bibleId);
  };

  const handleFontSizeChange = (size: 'small' | 'medium' | 'large') => {
    setFontSize(size);
    saveSetting('fontSize', size);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    saveSetting('theme', newTheme);
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    try {
      setNotificationsEnabled(enabled);
      await saveSetting('dailyNotificationEnabled', enabled.toString());
      
      if (enabled) {
        await notificationService.scheduleDailyNotification(notificationTime);
      } else {
        await notificationService.cancelAllNotifications();
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      Alert.alert('Erro', 'Falha ao alterar configuração de notificações');
    }
  };

  const handleTimeChange = () => {
    // For simplicity, using predefined times. In a real app, you'd use a time picker
    const times = ['06:00', '07:00', '08:00', '09:00', '18:00', '19:00', '20:00', '21:00'];
    const currentIndex = times.indexOf(notificationTime);
    const nextIndex = (currentIndex + 1) % times.length;
    const newTime = times[nextIndex];
    
    setNotificationTime(newTime);
    saveSetting('notificationTime', newTime);
    
    if (notificationsEnabled) {
      notificationService.scheduleDailyNotification(newTime);
    }
  };

  const clearAllData = () => {
    Alert.alert(
      'Limpar Todos os Dados',
      'Esta ação irá remover todos os dados do aplicativo, incluindo Bíblias baixadas e planos de leitura. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              // This would require additional implementation to clear all data
              Alert.alert('Info', 'Funcionalidade em desenvolvimento');
            } catch (error) {
              console.error('Clear data error:', error);
              Alert.alert('Erro', 'Falha ao limpar dados');
            }
          },
        },
      ]
    );
  };



  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configurações</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Bible Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bíblia Preferida</Text>
          <Text style={styles.sectionDescription}>
            Selecione a versão da Bíblia que será usada por padrão
          </Text>
          
          {bibles.length > 0 ? (
            <View style={styles.optionsContainer}>
              {bibles.map(bible => (
                <TouchableOpacity
                  key={bible.id}
                  style={[
                    styles.option,
                    selectedBibleId === bible.id && styles.selectedOption
                  ]}
                  onPress={() => handleBibleChange(bible.id)}
                >
                  <View style={styles.optionContent}>
                    <Text style={[
                      styles.optionTitle,
                      selectedBibleId === bible.id && styles.selectedOptionText
                    ]}>
                      {bible.name}
                    </Text>
                    <Text style={[
                      styles.optionSubtitle,
                      selectedBibleId === bible.id && styles.selectedOptionText
                    ]}>
                      {bible.language} • {bible.abbreviation}
                    </Text>
                  </View>
                  {selectedBibleId === bible.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.noBiblesText}>
              Nenhuma Bíblia baixada. Vá para &quot;Gerenciar Bíblias&quot; para baixar uma versão.
            </Text>
          )}
        </View>

        {/* Font Size */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tamanho da Fonte</Text>
          <View style={styles.optionsContainer}>
            {[
              { key: 'small', label: 'Pequena' },
              { key: 'medium', label: 'Média' },
              { key: 'large', label: 'Grande' }
            ].map(option => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.option,
                  fontSize === option.key && styles.selectedOption
                ]}
                onPress={() => handleFontSizeChange(option.key as any)}
              >
                <Text style={[
                  styles.optionTitle,
                  fontSize === option.key && styles.selectedOptionText
                ]}>
                  {option.label}
                </Text>
                {fontSize === option.key && (
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Theme */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tema</Text>
          <View style={styles.optionsContainer}>
            {[
              { key: 'light', label: 'Claro' },
              { key: 'dark', label: 'Escuro' }
            ].map(option => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.option,
                  theme === option.key && styles.selectedOption
                ]}
                onPress={() => handleThemeChange(option.key as any)}
              >
                <Text style={[
                  styles.optionTitle,
                  theme === option.key && styles.selectedOptionText
                ]}>
                  {option.label}
                </Text>
                {theme === option.key && (
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notificações Diárias</Text>
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Receber lembretes diários</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#ddd', true: '#2196F3' }}
              thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
          
          {notificationsEnabled && (
            <TouchableOpacity style={styles.timeSelector} onPress={handleTimeChange}>
              <Text style={styles.timeLabel}>Horário da notificação</Text>
              <View style={styles.timeValue}>
                <Text style={styles.timeText}>{notificationTime}</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gerenciar Dados</Text>
          <TouchableOpacity style={styles.dangerButton} onPress={clearAllData}>
            <Ionicons name="trash-outline" size={24} color="#f44336" />
            <Text style={styles.dangerButtonText}>Limpar Todos os Dados</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre o App</Text>
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>ReadBible v1.0.0</Text>
            <Text style={styles.infoText}>Aplicativo para estudo da Bíblia</Text>
            <Text style={styles.infoText}>com planos de leitura organizados</Text>
          </View>
        </View>
      </ScrollView>
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  selectedOption: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  selectedOptionText: {
    color: '#fff',
  },
  noBiblesText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  timeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginTop: 12,
  },
  timeLabel: {
    fontSize: 16,
    color: '#333',
  },
  timeValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginRight: 8,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#f44336',
    borderRadius: 8,
    backgroundColor: '#fff5f5',
  },
  dangerButtonText: {
    fontSize: 16,
    color: '#f44336',
    marginLeft: 12,
  },
  infoContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
});