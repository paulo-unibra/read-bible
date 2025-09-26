import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../../components/logo';
import DatabaseService from '../../services/DatabaseService';
import notificationService from '../../services/NotificationService';
import readingPlanService from '../../services/ReadingPlanService';
import { ReadingPlan, ReadingPlanDay } from '../../types';

export default function HomeScreen() {
  const [activePlans, setActivePlans] = useState<ReadingPlan[]>([]);
  const [todayReading, setTodayReading] = useState<ReadingPlanDay | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      await DatabaseService.init();
      await DatabaseService.ensureSampleBible();
      await notificationService.requestPermissions();
      
      const plans = await readingPlanService.getActivePlans();
      setActivePlans(plans);
      
      if (plans.length > 0) {
        const reading = await readingPlanService.getTodayReading(plans[0].id);
        setTodayReading(reading);
      }
    } catch (error) {
      console.error('Error initializing app:', error);
      Alert.alert('Erro', 'Falha ao inicializar o aplicativo');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReadingComplete = async () => {
    if (!todayReading) return;
    
    try {
      await readingPlanService.markDayAsCompleted(todayReading.id);
      setTodayReading({ ...todayReading, isCompleted: true });
      Alert.alert('Parabéns!', 'Leitura marcada como concluída! 🎉');
    } catch (error) {
      console.error('Error marking reading complete:', error);
      Alert.alert('Erro', 'Falha ao marcar leitura como concluída');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Logo size={36} />
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Today's Reading Card */}
        {todayReading ? (
          <View style={styles.todayCard}>
            <Text style={styles.todayTitle}>Leitura de Hoje</Text>
            <View style={styles.readingInfo}>
              {todayReading.readings.map((reading, index) => (
                <Text key={index} style={styles.readingText}>
                  {reading.bookName} {reading.startChapter}
                  {reading.endChapter !== reading.startChapter && `-${reading.endChapter}`}
                </Text>
              ))}
            </View>
            
            {!todayReading.isCompleted ? (
              <TouchableOpacity 
                style={styles.completeButton}
                onPress={handleMarkReadingComplete}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.completeButtonText}>Marcar como Lida</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.completedText}>Concluída</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noReadingCard}>
            <Ionicons name="calendar-outline" size={48} color="#ccc" />
            <Text style={styles.noReadingTitle}>Nenhuma leitura programada</Text>
            <Text style={styles.noReadingText}>
              Crie um plano de leitura para começar sua jornada bíblica
            </Text>
            <TouchableOpacity 
              style={styles.createPlanButton}
              onPress={() => router.push('/reading-plans')}
            >
              <Text style={styles.createPlanButtonText}>Criar Plano</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Modo de Leitura</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/free-reading')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="book-outline" size={32} color="#2196F3" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Leitura Livre</Text>
              <Text style={styles.actionDescription}>
                Navegue por livros, capítulos e versículos
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/reading-plans')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="calendar-outline" size={32} color="#FF9800" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Planos de Leitura</Text>
              <Text style={styles.actionDescription}>
                Siga cronogramas organizados de estudo
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Bible Management */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Gerenciar Bíblias</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/bible-manager')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="download-outline" size={32} color="#4CAF50" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Baixar Bíblias</Text>
              <Text style={styles.actionDescription}>
                Gerencie suas versões da Bíblia
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Active Plans Summary */}
        {activePlans.length > 0 && (
          <View style={styles.plansSection}>
            <Text style={styles.sectionTitle}>Planos Ativos</Text>
            {activePlans.map(plan => (
              <View key={plan.id} style={styles.planSummary}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planProgress}>
                  {plan.completedDays}/{plan.totalDays} dias
                </Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${(plan.completedDays / plan.totalDays) * 100}%` }
                    ]} 
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    fontSize: 18,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  settingsButton: {
    padding: 8,
  },
  todayCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  todayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  readingInfo: {
    marginBottom: 16,
  },
  readingText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  completeButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  completedText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  actionCard: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
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
  actionIcon: {
    width: 56,
    height: 56,
    backgroundColor: '#f0f0f0',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#666',
  },
  plansSection: {
    padding: 16,
  },
  planSummary: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  planProgress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  noReadingCard: {
    backgroundColor: '#fff',
    padding: 24,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  noReadingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  noReadingText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  createPlanButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createPlanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
