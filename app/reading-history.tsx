import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import authService, { ReadingPlan, TodayReading } from '../services/AuthService';
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
  const [nextReading, setNextReading] = useState<TodayReading | null>(null);
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
      
      // Carregar plano ativo e próxima leitura
      const planResponse = await authService.getActivePlan();
      if (planResponse.success && planResponse.data) {
        setPlan(planResponse.data.plan);
        setNextReading(planResponse.data.todayReading);
      }
      
      // Carregar histórico completo
      const response = await authService.getAllHistory();
      
      if (response.success && response.data) {
        setHistory(response.data);
        groupByMonth(response.data);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupByMonth = (items: ReadingHistoryItem[]) => {
    const grouped: GroupedHistory = {};
    
    // Filtrar apenas leituras concluídas e ordenar por updatedAt desc
    const completedItems = items
      .filter(item => item.isCompleted)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    completedItems.forEach(item => {
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
      {/* <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: applyFontScale(20) }]}>
          Detalhes da Leitura3
        </Text>
        <TouchableOpacity onPress={handleDeletePlan} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={24} color={colors.danger} />
        </TouchableOpacity>
      </View> */}

      <ScrollView style={styles.scrollView}>
        {/* Próxima Leitura */}
        {nextReading && (
          <View style={styles.nextReadingSection}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>
              Próxima Leitura
            </Text>
            <View
              style={[styles.nextReadingCard, { backgroundColor: colors.card, borderLeftColor: colors.accent }]}
            >
              <View style={styles.historyInfo}>
                <View style={[styles.dayBadge, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.dayNumber, { fontSize: applyFontScale(16) }]}>
                    Dia {nextReading.day}
                  </Text>
                </View>
                <View style={styles.readingDetails}>
                  <Text style={[styles.bookName, { color: colors.textPrimary, fontSize: applyFontScale(16) }]}>
                    {nextReading.bookName} {nextReading.startChapter}
                    {nextReading.endChapter !== nextReading.startChapter && `-${nextReading.endChapter}`}
                  </Text>
                  <Text style={[styles.nextReadingLabel, { color: colors.accent, fontSize: applyFontScale(12) }]}>
                    Pendente
                  </Text>
                </View> 
              </View>
              
              {!nextReading.isCompleted && (
                <TouchableOpacity
                  style={[styles.markButton, { backgroundColor: colors.success }]}
                  onPress={() => handleToggleReading({
                    id: 0,
                    day: nextReading.day,
                    bookName: nextReading.bookName,
                    startChapter: nextReading.startChapter,
                    endChapter: nextReading.endChapter,
                    isCompleted: false,
                    completedAt: null,
                    updatedAt: new Date().toISOString()
                  })}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Plan Info */}
        {plan && (
          <View style={styles.planInfoSection}>
            <View style={[styles.planInfoCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.planName, { color: colors.textPrimary, fontSize: applyFontScale(16) }]}>
                {plan.name}
              </Text>
              <Text style={[styles.planStats, { color: colors.textSecondary, fontSize: applyFontScale(14) }]}>
                Dia {plan.currentDay} de {plan.totalDays}
              </Text>
              <Text style={[styles.planStats, { color: colors.textSecondary, fontSize: applyFontScale(14) }]}>
                {plan.completedChapters} de {plan.totalChapters} capítulos ({Math.round((plan.completedChapters / plan.totalChapters) * 100)}%)
              </Text>
            </View>
          </View>
        )}

        {/* Histórico */}
        <View style={styles.historySection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>
            Leituras Concluídas
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
  planInfoSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  planInfoCard: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  planName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
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
