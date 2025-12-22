import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import authService, { ReadingPlan } from '../services/AuthService';
import DatabaseService from '../services/DatabaseService';

interface ReadingHistoryItem {
  id: number;
  day: number;
  bookName: string;
  startChapter: number;
  endChapter: number;
  isCompleted: boolean;
  completedAt: string | null;
  updatedAt: string;
}

interface GroupedHistory {
  [monthYear: string]: ReadingHistoryItem[];
}

export default function ReadingHistoryScreen() {
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);
  const [groupedHistory, setGroupedHistory] = useState<GroupedHistory>({});
  const [upcomingReadings, setUpcomingReadings] = useState<ReadingHistoryItem[]>([]);
  const [plan, setPlan] = useState<ReadingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontSizePref, setFontSizePref] = useState<'small' | 'medium' | 'large'>('medium');

  useEffect(() => {
    loadHistory();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await DatabaseService.getMultipleSettings(['fontSize', 'theme']);
      const userFont = settings.fontSize as 'small' | 'medium' | 'large' | null;
      const userTheme = settings.theme as 'light' | 'dark' | null;
      if (userFont) setFontSizePref(userFont);
      if (userTheme) setTheme(userTheme);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      
      // Carregar plano ativo
      const planResponse = await authService.getActivePlan();
      if (planResponse.success && planResponse.data) {
        setPlan(planResponse.data.plan);
      }
      
      // Carregar histórico completo
      const response = await authService.getAllHistory();
      
      if (response.success && response.data) {
        setHistory(response.data);
        
        // Separar leituras concluídas e próximas
        const completed = response.data.filter(item => item.isCompleted);
        
        // Pegar próximas leituras não concluídas, ordenando pelo dia
        const upcoming = response.data
          .filter(item => !item.isCompleted)
          .sort((a, b) => a.day - b.day)
          .slice(0, 5); // Próximas 5 leituras
        
        setUpcomingReadings(upcoming);
        groupByMonth(completed);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupByMonth = (items: ReadingHistoryItem[]) => {
    const grouped: GroupedHistory = {};
    
    // Ordenar por updatedAt desc
    const sortedItems = items
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    sortedItems.forEach(item => {
      const date = new Date(item.updatedAt);
      const monthYear = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      
      grouped[monthYear].push(item);
    });
    
    setGroupedHistory(grouped);
  };

  const handleToggleReading = async (item: ReadingHistoryItem) => {
    const action = item.isCompleted ? 'desmarcar' : 'marcar';
    const actionTitle = item.isCompleted ? 'Desmarcar Leitura' : 'Marcar Leitura';
    
    Alert.alert(
      actionTitle,
      `Deseja realmente ${action} a leitura do dia ${item.day}?\n${item.bookName} ${item.startChapter}${item.endChapter !== item.startChapter ? `-${item.endChapter}` : ''}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: item.isCompleted ? 'Desmarcar' : 'Marcar',
          style: item.isCompleted ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const response = item.isCompleted 
                ? await authService.unmarkDay(item.day)
                : await authService.completeDay(item.day);
                
              if (response.success) {
                Alert.alert('Sucesso', `Leitura ${item.isCompleted ? 'desmarcada' : 'marcada'} com sucesso`);
                loadHistory();
              } else {
                Alert.alert('Erro', response.message);
              }
            } catch (error) {
              Alert.alert('Erro', `Falha ao ${action} leitura`);
            }
          }
        }
      ]
    );
  };

  const handleDeletePlan = () => {
    Alert.alert(
      'Excluir Plano',
      'Tem certeza que deseja excluir seu plano de leitura? Todo o progresso será perdido.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await authService.deletePlan();
              if (response.success) {
                Alert.alert('Sucesso', 'Plano de leitura excluído', [
                  { text: 'OK', onPress: () => router.back() }
                ]);
              } else {
                Alert.alert('Erro', response.message);
              }
            } catch (error) {
              Alert.alert('Erro', 'Falha ao excluir plano');
            }
          }
        }
      ]
    );
  };

  const applyFontScale = (base: number) => {
    switch (fontSizePref) {
      case 'small': return base * 0.9;
      case 'large': return base * 1.2;
      default: return base;
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
    accent: isDark ? '#90caf9' : '#2196F3',
    success: isDark ? '#81c784' : '#4CAF50',
    danger: isDark ? '#e57373' : '#f44336',
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.headerBg} />
        {/* <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: applyFontScale(20) }]}>
            Detalhes da Leitura2
          </Text>
          <View style={{ width: 40 }} />
        </View> */}
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, fontSize: applyFontScale(16) }]}>
            Carregando...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.headerBg} />
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: applyFontScale(20) }]}>
          Detalhes da Leitura
        </Text>
        <TouchableOpacity onPress={handleDeletePlan} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={24} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Plan Info */}
        {plan && (
          <View style={styles.planInfoSection}>
            <View style={[styles.planInfoCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.planName, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>
                {plan.name}
              </Text>
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${plan.progress}%`,
                        backgroundColor: colors.accent 
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.progressText, { color: colors.textSecondary, fontSize: applyFontScale(12) }]}>
                  {plan.progress}%
                </Text>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.textPrimary, fontSize: applyFontScale(20) }]}>
                    {plan.currentDay}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: applyFontScale(12) }]}>
                    Dia atual
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.textPrimary, fontSize: applyFontScale(20) }]}>
                    {plan.totalDays}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: applyFontScale(12) }]}>
                    Total de dias
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.textPrimary, fontSize: applyFontScale(20) }]}>
                    {plan.completedChapters}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: applyFontScale(12) }]}>
                    Capítulos lidos
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Próximas Leituras */}
        {upcomingReadings.length > 0 && (
          <View style={styles.upcomingSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>
              Próximas Leituras
            </Text>
            {upcomingReadings.map((reading, index) => (
              <View
                key={reading.id}
                style={[
                  styles.upcomingCard, 
                  { 
                    backgroundColor: colors.card, 
                    borderLeftColor: index === 0 ? colors.accent : colors.textSecondary,
                    opacity: index === 0 ? 1 : 0.7
                  }
                ]}
              >
                <View style={styles.historyInfo}>
                  <View style={[
                    styles.dayBadge, 
                    { backgroundColor: index === 0 ? colors.accent : colors.textSecondary }
                  ]}>
                    <Text style={[styles.dayNumber, { fontSize: applyFontScale(14) }]}>
                      Dia {reading.day}
                    </Text>
                  </View>
                  <View style={styles.readingDetails}>
                    <Text style={[styles.bookName, { color: colors.textPrimary, fontSize: applyFontScale(16) }]}>
                      {reading.bookName} {reading.startChapter}
                      {reading.endChapter !== reading.startChapter && `-${reading.endChapter}`}
                    </Text>
                    {index === 0 && (
                      <Text style={[styles.nextReadingLabel, { color: colors.accent, fontSize: applyFontScale(12) }]}>
                        🔥 Próxima leitura
                      </Text>
                    )}
                  </View>
                </View>
                
                <TouchableOpacity
                  style={[styles.markButton, { backgroundColor: colors.success }]}
                  onPress={() => handleToggleReading(reading)}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Histórico */}
        <View style={styles.historySection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>
            Leituras Concluídas ({history.filter(h => h.isCompleted).length})
          </Text>
        </View>

        {history.filter(h => h.isCompleted).length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>
              Nenhuma leitura concluída
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: applyFontScale(14) }]}>
              Complete suas leituras diárias para vê-las aqui
            </Text>
          </View>
        ) : (
          Object.keys(groupedHistory).map(monthYear => (
            <View key={monthYear} style={styles.monthSection}>
              <Text style={[styles.monthTitle, { color: colors.accent, fontSize: applyFontScale(18) }]}>
                {monthYear.charAt(0).toUpperCase() + monthYear.slice(1)}
              </Text>
              
              {groupedHistory[monthYear].map(item => (
                <View
                  key={item.id}
                  style={[styles.historyCard, { backgroundColor: colors.card, borderLeftColor: colors.success }]}
                >
                  <View style={styles.historyInfo}>
                    <View style={[styles.dayBadge, { backgroundColor: colors.success }]}>
                      <Text style={[styles.dayNumber, { fontSize: applyFontScale(16) }]}>
                        Dia {item.day}
                      </Text>
                    </View>
                    <View style={styles.readingDetails}>
                      <Text style={[styles.bookName, { color: colors.textPrimary, fontSize: applyFontScale(16) }]}>
                        {item.bookName} {item.startChapter}
                        {item.endChapter !== item.startChapter && `-${item.endChapter}`}
                      </Text>
                      <Text style={[styles.completedDate, { color: colors.textSecondary, fontSize: applyFontScale(12) }]}>
                        {new Date(item.completedAt!).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.unmarkButton, { backgroundColor: colors.danger }]}
                    onPress={() => handleToggleReading(item)}
                  >
                    <Ionicons name="close-circle" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: StatusBar.currentHeight || 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  backButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    marginBottom: 30
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  planInfoSection: {
    padding: 16,
    paddingBottom: 8,
  },
  planInfoCard: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  upcomingSection: {
    padding: 16,
    paddingTop: 8,
  },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  nextReadingSection: {
    padding: 16,
    paddingBottom: 8,
  },
  nextReadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  nextReadingLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  markButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  planStats: {
    fontSize: 14,
  },
  historySection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  monthSection: {
    padding: 16,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  historyInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 12,
  },
  dayNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  readingDetails: {
    flex: 1,
  },
  bookName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  completedDate: {
    fontSize: 12,
  },
  unmarkButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
});
