import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import authService from '../services/AuthService';
import DatabaseService from '../services/DatabaseService';
import googleDriveService from '../services/GoogleDriveService';
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
      const settings = await DatabaseService.getMultipleSettings([
        'preferredBibleId',
        'fontSize',
        'theme',
        'dailyNotificationEnabled',
        'notificationTime'
      ]);
      const preferredBibleId = settings.preferredBibleId || downloadedBibles[0]?.id || '';
      const userFontSize = settings.fontSize as 'small' | 'medium' | 'large' || 'medium';
      const userTheme = settings.theme as 'light' | 'dark' || 'light';
      const notifEnabled = settings.dailyNotificationEnabled === 'true';
      const notifTime = settings.notificationTime || '08:00';
      
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

  // Dynamic theme + font scaling used also in chapter reader
  const isDark = theme === 'dark';
  const applyFontScale = useCallback((base: number) => {
    switch (fontSize) {
      case 'small': return base * 0.9;
      case 'large': return base * 1.2;
      default: return base;
    }
  }, [fontSize]);

  const colors = {
    bg: isDark ? '#121212' : '#f5f5f5',
    headerBg: isDark ? '#1d1d1d' : '#fff',
    sectionBg: isDark ? '#1e1e1e' : '#fff',
    border: isDark ? '#2b2b2b' : '#e0e0e0',
    cardBorder: isDark ? '#2b2b2b' : '#ddd',
    textPrimary: isDark ? '#e0e0e0' : '#333',
    textSecondary: isDark ? '#b0b0b0' : '#666',
    accent: isDark ? '#90caf9' : '#2196F3',
    selectedBg: isDark ? '#263850' : '#2196F3',
    dangerBg: isDark ? '#3a1f1f' : '#fff5f5',
    dangerBorder: isDark ? '#873838' : '#f44336',
    dangerText: isDark ? '#ff8a80' : '#f44336',
  } as const;

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
      'Esta ação irá remover todos os dados do aplicativo, incluindo:\n\n• Todas as Bíblias baixadas\n• Configurações personalizadas\n• Favoritos e marcadores\n• Planos de leitura\n• Histórico de leitura\n• Notificações programadas\n\nEsta ação não pode ser desfeita. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar Tudo',
          style: 'destructive',
          onPress: async () => {
            try {
              // Show loading alert
              Alert.alert('Limpando dados...', 'Por favor aguarde...');
              
              // Clear database data
              await DatabaseService.clearAllData();
              
              // Clear Bible files
              await googleDriveService.clearAllBibleFiles();
              
              // Cancel all notifications
              await notificationService.cancelAllNotifications();
              
              // Reset local state
              setBibles([]);
              setSelectedBibleId('');
              setFontSize('medium');
              setTheme('light');
              setNotificationsEnabled(false);
              setNotificationTime('08:00');
              
              Alert.alert(
                'Dados Limpos',
                'Todos os dados foram removidos com sucesso. O aplicativo será reiniciado.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate back to home and reload
                      router.replace('/');
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('Clear data error:', error);
              Alert.alert('Erro', 'Falha ao limpar alguns dados. Tente novamente.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Deseja realmente sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.logout();
              Alert.alert('Sucesso', 'Você saiu da sua conta', [
                {
                  text: 'OK',
                  onPress: () => router.replace('/auth'),
                },
              ]);
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Erro', 'Falha ao sair da conta. Tente novamente.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteReadingPlan = () => {
    Alert.alert(
      'Excluir Plano de Leitura',
      'Esta ação irá excluir seu plano de leitura atual e todo o progresso. Esta ação não pode ser desfeita.\n\nDeseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await authService.deletePlan();
              
              if (response.success) {
                Alert.alert('Sucesso', 'Plano de leitura excluído com sucesso', [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/(tabs)'),
                  },
                ]);
              } else {
                Alert.alert('Erro', response.message || 'Falha ao excluir plano de leitura');
              }
            } catch (error) {
              console.error('Delete plan error:', error);
              Alert.alert('Erro', 'Falha ao excluir plano de leitura. Tente novamente.');
            }
          },
        },
      ]
    );
  };



  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: applyFontScale(20) }]}>Configurações</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Bible Selection */}
        <View style={[styles.section, { backgroundColor: colors.sectionBg }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>Bíblia Preferida</Text>
          <Text style={[styles.sectionDescription, { color: colors.textSecondary }] }>
            Selecione a versão da Bíblia que será usada por padrão
          </Text>
          
          {bibles.length > 0 ? (
            <View style={styles.optionsContainer}>
              {bibles.map(bible => (
                <TouchableOpacity
                  key={bible.id}
                  style={[
                    styles.option,
                    {
                      borderColor: colors.cardBorder,
                      backgroundColor: colors.sectionBg,
                    },
                    selectedBibleId === bible.id && {
                      backgroundColor: colors.selectedBg,
                      borderColor: colors.selectedBg,
                    }
                  ]}
                  onPress={() => handleBibleChange(bible.id)}
                >
                  <View style={styles.optionContent}>
                    <Text style={[
                      styles.optionTitle,
                      { color: colors.textPrimary, fontSize: applyFontScale(16) },
                      selectedBibleId === bible.id && { color: '#fff' }
                    ]}>
                      {bible.name}
                    </Text>
                    <Text style={[
                      styles.optionSubtitle,
                      { color: colors.textSecondary, fontSize: applyFontScale(14) },
                      selectedBibleId === bible.id && { color: '#fff' }
                    ]}>
                     {bible.abbreviation}
                    </Text>
                  </View>
                  {selectedBibleId === bible.id && (
                    <Ionicons name="checkmark-circle" size={24} color={isDark ? '#fff' : '#fff'} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={[styles.noBiblesText, { color: colors.textSecondary }]}>
              Nenhuma Bíblia baixada. Vá para &quot;Gerenciar Bíblias&quot; para baixar uma versão.
            </Text>
          )}
        </View>

        {/* Font Size */}
        <View style={[styles.section, { backgroundColor: colors.sectionBg }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>Tamanho da Fonte</Text>
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
                  { borderColor: colors.cardBorder, backgroundColor: colors.sectionBg },
                  fontSize === option.key && { backgroundColor: colors.selectedBg, borderColor: colors.selectedBg }
                ]}
                onPress={() => handleFontSizeChange(option.key as any)}
              >
                <Text style={[
                  styles.optionTitle,
                  { color: colors.textPrimary, fontSize: applyFontScale(16) },
                  fontSize === option.key && { color: '#fff' }
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
        <View style={[styles.section, { backgroundColor: colors.sectionBg }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>Tema</Text>
          <View style={styles.optionsContainer}>
            {[
              { key: 'light', label: 'Claro' },
              { key: 'dark', label: 'Escuro' }
            ].map(option => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.option,
                  { borderColor: colors.cardBorder, backgroundColor: colors.sectionBg },
                  theme === option.key && { backgroundColor: colors.selectedBg, borderColor: colors.selectedBg }
                ]}
                onPress={() => handleThemeChange(option.key as any)}
              >
                <Text style={[
                  styles.optionTitle,
                  { color: colors.textPrimary, fontSize: applyFontScale(16) },
                  theme === option.key && { color: '#fff' }
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
        <View style={[styles.section, { backgroundColor: colors.sectionBg }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>Notificações Diárias</Text>
          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: colors.textPrimary, fontSize: applyFontScale(16) }]}>Receber lembretes diários</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#ddd', true: '#2196F3' }}
              thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
          
          {notificationsEnabled && (
            <TouchableOpacity style={styles.timeSelector} onPress={handleTimeChange}>
              <Text style={[styles.timeLabel, { color: colors.textPrimary, fontSize: applyFontScale(16) }]}>Horário da notificação</Text>
              <View style={styles.timeValue}>
                <Text style={[styles.timeText, { color: colors.accent, fontSize: applyFontScale(16) }]}>{notificationTime}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Account Management */}
        <View style={[styles.section, { backgroundColor: colors.sectionBg }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>Conta</Text>
          
          <TouchableOpacity 
            style={[styles.dangerButton, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder, marginBottom: 12 }]} 
            onPress={handleDeleteReadingPlan}
          >
            <Ionicons name="book-outline" size={24} color={colors.dangerText} />
            <Text style={[styles.dangerButtonText, { color: colors.dangerText, fontSize: applyFontScale(16) }]}>Excluir Plano de Leitura</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.dangerButton, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder, marginBottom: 12 }]} 
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={24} color={colors.dangerText} />
            <Text style={[styles.dangerButtonText, { color: colors.dangerText, fontSize: applyFontScale(16) }]}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>

        {/* Data Management */}
        <View style={[styles.section, { backgroundColor: colors.sectionBg }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>Gerenciar Dados</Text>
          <TouchableOpacity style={[styles.dangerButton, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]} onPress={clearAllData}>
            <Ionicons name="trash-outline" size={24} color={colors.dangerText} />
            <Text style={[styles.dangerButtonText, { color: colors.dangerText, fontSize: applyFontScale(16) }]}>Limpar Todos os Dados</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={[styles.section, { backgroundColor: colors.sectionBg }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>Sobre o App</Text>
          <View style={styles.infoContainer}>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>{`Bíblia em Foco v1.0.5`}</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Aplicativo para estudo da Bíblia</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>com planos de leitura organizados</Text>
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