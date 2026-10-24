import { audioGuideSettings } from '../services/AudioGuideSettings';
import Alert from '../services/AppFeedback';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFocusColors } from '../constants/design';
import authService from '../services/AuthService';
import DatabaseService from '../services/DatabaseService';
import googleDriveService from '../services/GoogleDriveService';
import notificationService from '../services/NotificationService';
import readingPlanService from '../services/ReadingPlanService';
import { Bible } from '../types';
import { useThemeCustom } from '../hooks/theme-context';
import { formatBibleAbbreviation } from '../utils/bibleAbbreviation';
export default function SettingsScreen() {
  const router = useRouter();
  const [audioGuides, setAudioGuides] = useState(false);
  const [savingAudioGuides, setSavingAudioGuides] = useState(false);
  const [bibles, setBibles] = useState<Bible[]>([]);
  const [selectedBibleId, setSelectedBibleId] = useState<string>('');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationTime, setNotificationTime] = useState('08:00');
  const { setTheme: setGlobalTheme } = useThemeCustom();

  const loadSettings = async () => {
    try {
      setAudioGuides(await audioGuideSettings.load());
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

  useEffect(() => {
    // Settings update only after the asynchronous database reads complete.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings();
  }, []);

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
    setGlobalTheme(newTheme);
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

  const focus = getFocusColors(isDark);
  const colors = {
    bg: focus.screen,
    border: focus.line,
    textPrimary: focus.text,
    textSecondary: focus.muted,
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
                  onPress: () => router.replace('/?tab=bible'),
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
              console.log('🗑️ [DEBUG] Iniciando exclusão de planos...');
              
              // Primeiro, excluir planos locais (templates customizados)
              const localPlans = await readingPlanService.getActivePlans();
              console.log('🗑️ [DEBUG] Planos locais encontrados:', localPlans.length);
              
              if (localPlans.length > 0) {
                console.log('🗑️ [DEBUG] Planos locais:', localPlans.map(p => ({ id: p.id, name: p.name, type: p.type })));
                
                for (const plan of localPlans) {
                  console.log(`🗑️ [DEBUG] Excluindo plano local: ${plan.id} - ${plan.name}`);
                  await readingPlanService.deletePlan(plan.id);
                  console.log(`✅ [DEBUG] Plano local excluído: ${plan.id}`);
                }
              }
              
              // Depois, tentar excluir plano do backend (se existir)
              console.log('🗑️ [DEBUG] Tentando excluir plano do backend...');
              const response = await authService.deletePlan();
              console.log('🗑️ [DEBUG] Resposta do backend:', response);
              
              if (response.success || localPlans.length > 0) {
                console.log('✅ [DEBUG] Planos excluídos com sucesso!');
                Alert.alert('Sucesso', 'Plano de leitura excluído com sucesso', [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/'),
                  },
                ]);
              } else {
                console.log('❌ [DEBUG] Falha ao excluir:', response.message);
                Alert.alert('Erro', response.message || 'Falha ao excluir plano de leitura');
              }
            } catch (error) {
              console.error('❌ [DEBUG] Delete plan error:', error);
              Alert.alert('Erro', 'Falha ao excluir plano de leitura. Tente novamente.');
            }
          },
        },
      ]
    );
  };



  const accent = isDark ? focus.blueDark : '#076B9D';
  const heading = (title: string) => <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: applyFontScale(17) }]}>{title}</Text>;
  const actionRow = (label: string, icon: React.ComponentProps<typeof Ionicons>['name'], onPress: () => void, destructive = false) => (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={[styles.actionRow, { borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={21} color={destructive ? (isDark ? '#ff9290' : '#B5221F') : accent} />
      <Text style={[styles.rowLabel, { color: destructive ? (isDark ? '#ff9290' : '#B5221F') : colors.textPrimary, fontSize: applyFontScale(15) }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={[styles.headerTitle, { color: colors.textPrimary, fontSize: applyFontScale(19) }]}>Configurações</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          {heading('Bíblia preferida')}
          <Text style={[styles.description, { color: colors.textSecondary }]}>Versão usada por padrão nas leituras.</Text>
          {bibles.length ? <View style={styles.options}>{bibles.map(bible => {
            const selected = selectedBibleId === bible.id;
            return <TouchableOpacity key={bible.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => handleBibleChange(bible.id)} style={[styles.bibleOption, { backgroundColor: selected ? focus.blueSoft : focus.surface, borderColor: selected ? accent : colors.border }]}>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, { color: colors.textPrimary, fontSize: applyFontScale(15) }]}>{bible.name}</Text>
                <Text style={[styles.abbreviation, { color: selected ? accent : colors.textSecondary }]}>{formatBibleAbbreviation(bible.abbreviation)}</Text>
              </View>
              <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? accent : colors.textSecondary} />
            </TouchableOpacity>;
          })}</View> : <View style={[styles.empty, { backgroundColor: focus.surface }]}>
            <Text style={[styles.description, { color: colors.textSecondary }]}>Nenhuma Bíblia baixada.</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/bible-manager')} style={styles.downloadButton}><Text style={[styles.linkText, { color: accent }]}>Gerenciar Bíblias</Text><Ionicons name="arrow-forward" size={18} color={accent} /></TouchableOpacity>
          </View>}
        </View>
        <View style={styles.section}>
          {heading('Tamanho da fonte')}
          <View style={[styles.segments, { backgroundColor: focus.surface }]}>{([
            { key: 'small', label: 'Pequena', size: 14 }, { key: 'medium', label: 'Média', size: 16 }, { key: 'large', label: 'Grande', size: 18 },
          ] as const).map(option => <TouchableOpacity key={option.key} accessibilityRole="radio" accessibilityState={{ checked: fontSize === option.key }} onPress={() => handleFontSizeChange(option.key)} style={[styles.segment, fontSize === option.key && { backgroundColor: focus.blueSoft, borderColor: accent }]}>
            <Text style={[styles.segmentText, { fontSize: applyFontScale(option.size), color: fontSize === option.key ? accent : colors.textSecondary }]}>{option.label}</Text>
          </TouchableOpacity>)}</View>
        </View>
        <View style={styles.section}>
          {heading('Tema')}
          <View style={[styles.segments, { backgroundColor: focus.surface }]}>{([
            { key: 'light', label: 'Claro', icon: 'sunny-outline' }, { key: 'dark', label: 'Escuro', icon: 'moon-outline' },
          ] as const).map(option => <TouchableOpacity key={option.key} accessibilityRole="radio" accessibilityState={{ checked: theme === option.key }} onPress={() => handleThemeChange(option.key)} style={[styles.segment, theme === option.key && { backgroundColor: focus.blueSoft, borderColor: accent }]}>
            <Ionicons name={option.icon} size={19} color={theme === option.key ? accent : colors.textSecondary} /><Text style={[styles.segmentText, { color: theme === option.key ? accent : colors.textSecondary, fontSize: applyFontScale(15) }]}>{option.label}</Text>
          </TouchableOpacity>)}</View>
        </View>
        <View style={styles.section}>
          {heading('Guias de áudio')}
          <View style={styles.switchRow}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary, fontSize: applyFontScale(15) }]}>Ouvir orientações e incentivos</Text>
            <Switch accessibilityLabel="Guias de áudio" value={audioGuides} disabled={savingAudioGuides} trackColor={{ false: colors.border, true: accent }} thumbColor="#fff" onValueChange={async value => {
              setSavingAudioGuides(true);
              try { await audioGuideSettings.setEnabled(value); setAudioGuides(value); }
              catch { Alert.alert('Erro', 'Não foi possível salvar a preferência de áudio.'); }
              finally { setSavingAudioGuides(false); }
            }} />
          </View>
        </View>
        <View style={styles.section}>
          {heading('Lembretes de leitura')}
          <View style={styles.switchRow}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary, fontSize: applyFontScale(15) }]}>Receber lembretes diários</Text>
            <Switch accessibilityLabel="Receber lembretes diários" value={notificationsEnabled} onValueChange={handleNotificationToggle} trackColor={{ false: colors.border, true: accent }} thumbColor="#fff" />
          </View>
          {notificationsEnabled && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Horário da notificação: ${notificationTime}. Alterar horário`} style={[styles.actionRow, { borderBottomColor: colors.border }]} onPress={handleTimeChange}>
            <Ionicons name="time-outline" size={21} color={accent} /><Text style={[styles.rowLabel, { color: colors.textPrimary, fontSize: applyFontScale(15) }]}>Horário</Text><Text style={[styles.linkText, { color: accent }]}>{notificationTime}</Text><Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>}
        </View>
        <View style={styles.section}>
          {heading('Conta e dados')}
          {actionRow('Sair da conta', 'log-out-outline', handleLogout)}
          {actionRow('Excluir plano de leitura', 'book-outline', handleDeleteReadingPlan, true)}
          {actionRow('Limpar todos os dados', 'trash-outline', clearAllData, true)}
        </View>
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerName, { color: colors.textPrimary }]}>Bíblia em Foco v1.0.5</Text>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>Estudo da Bíblia e planos de leitura organizados.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  backButton: { width: 44, minHeight: 44, justifyContent: 'center' },
  headerTitle: { fontWeight: '700', flex: 1 },
  content: { padding: 20, paddingBottom: 40, maxWidth: 600, width: '100%', alignSelf: 'center' },
  section: { marginBottom: 28 },
  sectionTitle: { fontWeight: '700', marginBottom: 12 },
  description: { fontSize: 14, lineHeight: 21, marginBottom: 12 },
  options: { gap: 8 },
  bibleOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, minHeight: 64 },
  optionCopy: { flex: 1, minWidth: 0 }, optionTitle: { fontWeight: '600', lineHeight: 23 },
  abbreviation: { fontSize: 13, marginTop: 2 },
  segments: { flexDirection: 'row', padding: 4, borderRadius: 12, gap: 4 },
  segment: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, paddingHorizontal: 4, minHeight: 48, borderRadius: 9, borderWidth: 1, borderColor: 'transparent' },
  segmentText: { fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  rowLabel: { flex: 1, lineHeight: 23 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  empty: { padding: 16, borderRadius: 12 },
  downloadButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  linkText: { fontSize: 14, fontWeight: '600' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 20, gap: 6 },
  footerName: { fontSize: 13, fontWeight: '600' }, footerText: { fontSize: 12, lineHeight: 18 },
});
