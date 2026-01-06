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

interface DayReadings {
  day: number;
  readings: ReadingHistoryItem[];
  isCompleted: boolean;
  completedAt: string | null;
}

interface GroupedHistory {
  [monthYear: string]: DayReadings[];
}

export default function ReadingHistoryScreen() {
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);
  const [groupedHistory, setGroupedHistory] = useState<GroupedHistory>({});
  const [upcomingReadings, setUpcomingReadings] = useState<DayReadings[]>([]);
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

  const groupByDay = (items: ReadingHistoryItem[]): DayReadings[] => {
    const dayMap = new Map<number, ReadingHistoryItem[]>();
    
    items.forEach(item => {
      if (!dayMap.has(item.day)) {
        dayMap.set(item.day, []);
      }
      dayMap.get(item.day)!.push(item);
    });
    
    return Array.from(dayMap.entries())
      .map(([day, readings]) => ({
        day,
        readings,
        isCompleted: readings.every(r => r.isCompleted),
        completedAt: readings[0]?.completedAt || null,
      }))
      .sort((a, b) => a.day - b.day);
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      
      // Carregar plano ativo
      const planResponse = await authService.getActivePlan();
      if (planResponse.success && planResponse.data) {
        setPlan(planResponse.data.plan);
      }
      
      // Carregar TODAS as leituras do plano (não apenas histórico)
      const response = await authService.getAllPlanReadings();
      
      if (response.success && response.data) {
        setHistory(response.data);
        
        // Separar leituras concluídas e próximas
        const completed = response.data.filter(item => item.isCompleted);
        
        // Agrupar próximas leituras por dia
        const upcomingByDay = groupByDay(
          response.data
            .filter(item => !item.isCompleted)
            .sort((a, b) => a.day - b.day)
        );
        
        console.log('Total de leituras do plano:', response.data.length);
        console.log('Leituras concluídas:', completed.length);
        console.log('Próximas leituras (dias):', upcomingByDay.length);
        
        // Pegar próximos 5 dias
        setUpcomingReadings(upcomingByDay.slice(0, 5));
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
    
    // Agrupar por dia primeiro
    const dayReadings = groupByDay(items);
    
    // Ordenar por updatedAt desc
    const sortedDays = dayReadings
      .sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return dateB - dateA;
      });
    
    sortedDays.forEach(dayReading => {
      const date = new Date(dayReading.completedAt!);
      const monthYear = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      
      grouped[monthYear].push(dayReading);
    });
    
    setGroupedHistory(grouped);
  };

  const handleToggleReading = async (dayReading: DayReadings) => {
    const action = dayReading.isCompleted ? 'desmarcar' : 'marcar';
    const actionTitle = dayReading.isCompleted ? 'Desmarcar Leitura' : 'Marcar Leitura';
    
    const readingsText = dayReading.readings
      .map(r => `${r.bookName} ${r.startChapter}${r.endChapter !== r.startChapter ? `-${r.endChapter}` : ''}`)
      .join('\n');
    
    Alert.alert(
      actionTitle,
      `Deseja realmente ${action} a leitura do dia ${dayReading.day}?\n\n${readingsText}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: dayReading.isCompleted ? 'Desmarcar' : 'Marcar',
          style: dayReading.isCompleted ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const response = dayReading.isCompleted 
                ? await authService.unmarkDay(dayReading.day)
                : await authService.completeDay(dayReading.day);
                
              if (response.success) {
                Alert.alert('Sucesso', `Leitura ${dayReading.isCompleted ? 'desmarcada' : 'marcada'} com sucesso`);
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
                // Voltar para home (vai disparar useFocusEffect e recarregar)
                router.push('/');
                
                // Mostrar mensagem de sucesso após um pequeno delay
                setTimeout(() => {
                  Alert.alert('Sucesso', 'Plano de leitura excluído');
                }, 300);
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
          Seu Plano de Leitura
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
        <View style={styles.upcomingSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>
            Próximas Leituras
          </Text>
          {upcomingReadings.length > 0 ? (
            upcomingReadings.map((dayReading, index) => (
              <View
                key={dayReading.day}
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
                      Dia {dayReading.day}
                    </Text>
                  </View>
                  <View style={styles.readingDetails}>
                    {dayReading.readings.map((reading, rIndex) => (
                      <Text 
                        key={reading.id}
                        style={[
                          styles.bookName, 
                          { 
                            color: colors.textPrimary, 
                            fontSize: applyFontScale(16),
                            marginBottom: rIndex < dayReading.readings.length - 1 ? 4 : 0
                          }
                        ]}
                      >
                        {reading.bookName} {reading.startChapter}
                        {reading.endChapter !== reading.startChapter && `-${reading.endChapter}`}
                      </Text>
                    ))}
                    {index === 0 && (
                      <Text style={[styles.nextReadingLabel, { color: colors.accent, fontSize: applyFontScale(12), marginTop: 4 }]}>
                        🔥 Próxima leitura
                      </Text>
                    )}
                  </View>
                </View>
                
                <TouchableOpacity
                  style={[styles.markButton, { backgroundColor: colors.success }]}
                  onPress={() => handleToggleReading(dayReading)}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={[styles.emptyUpcomingCard, { backgroundColor: colors.card }]}>
              <Ionicons name="checkmark-done-circle" size={48} color={colors.success} />
              <Text style={[styles.emptyUpcomingTitle, { color: colors.textPrimary, fontSize: applyFontScale(16) }]}>
                Você está em dia!
              </Text>
              <Text style={[styles.emptyUpcomingText, { color: colors.textSecondary, fontSize: applyFontScale(14) }]}>
                Todas as leituras disponíveis foram concluídas. Continue acessando para mais conteúdo.
              </Text>
            </View>
          )}
        </View>

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
              
              {groupedHistory[monthYear].slice(0, 5).map(dayReading => (
                <View
                  key={dayReading.day}
                  style={[styles.historyCard, { backgroundColor: colors.card, borderLeftColor: colors.success }]}
                >
                  <View style={styles.historyInfo}>
                    <View style={[styles.dayBadge, { backgroundColor: colors.success }]}>
                      <Text style={[styles.dayNumber, { fontSize: applyFontScale(16) }]}>
                        Dia {dayReading.day}
                      </Text>
                    </View>
                    <View style={styles.readingDetails}>
                      {dayReading.readings.map((reading, index) => (
                        <Text 
                          key={reading.id}
                          style={[
                            styles.bookName, 
                            { 
                              color: colors.textPrimary, 
                              fontSize: applyFontScale(16),
                              marginBottom: index < dayReading.readings.length - 1 ? 4 : 0
                            }
                          ]}
                        >
                          {reading.bookName} {reading.startChapter}
                          {reading.endChapter !== reading.startChapter && `-${reading.endChapter}`}
                        </Text>
                      ))}
                      <Text style={[styles.completedDate, { color: colors.textSecondary, fontSize: applyFontScale(12), marginTop: 4 }]}>
                        {new Date(dayReading.completedAt!).toLocaleDateString('pt-BR', {
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
                    onPress={() => handleToggleReading(dayReading)}
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
  nextReadingLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  markButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 8,
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
  emptyUpcomingCard: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  emptyUpcomingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyUpcomingText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
