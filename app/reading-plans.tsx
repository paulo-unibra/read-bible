import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';
import readingPlanService from '../services/ReadingPlanService';
import { ReadingPlan, ReadingPlanDay } from '../types';

export default function ReadingPlansScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<ReadingPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ReadingPlan | null>(null);
  const [planDays, setPlanDays] = useState<ReadingPlanDay[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanType, setNewPlanType] = useState<'monthly' | 'yearly' | 'custom'>('monthly');

  useEffect(() => {
    loadPlans();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPlans = async () => {
    try {
      const activePlans = await readingPlanService.getActivePlans();
      setPlans(activePlans);
      
      if (activePlans.length > 0 && !selectedPlan) {
        selectPlan(activePlans[0]);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
      Alert.alert('Erro', 'Falha ao carregar planos de leitura');
    }
  };

  const selectPlan = async (plan: ReadingPlan) => {
    try {
      setSelectedPlan(plan);
      const days = await readingPlanService.getPlanDays(plan.id);
      setPlanDays(days);
    } catch (error) {
      console.error('Error loading plan days:', error);
      Alert.alert('Erro', 'Falha ao carregar dias do plano');
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlanName.trim()) {
      Alert.alert('Erro', 'Digite um nome para o plano');
      return;
    }

    try {
      const startDate = new Date();
      let newPlan: ReadingPlan;

      switch (newPlanType) {
        case 'monthly':
          newPlan = await readingPlanService.createMonthlyPlan(
            newPlanName,
            startDate,
            'new-testament'
          );
          break;
        case 'yearly':
          newPlan = await readingPlanService.createYearlyPlan(newPlanName, startDate);
          break;
        case 'custom':
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 3); // 3 months default
          newPlan = await readingPlanService.createCustomPlan(
            newPlanName,
            startDate,
            endDate,
            [19, 20] // Psalms and Proverbs
          );
          break;
      }

      setShowCreateModal(false);
      setNewPlanName('');
      await loadPlans();
      selectPlan(newPlan);
      
      Alert.alert('Sucesso', 'Plano de leitura criado com sucesso!');
    } catch (error) {
      console.error('Error creating plan:', error);
      Alert.alert('Erro', 'Falha ao criar plano de leitura');
    }
  };

  const markDayAsCompleted = async (day: ReadingPlanDay) => {
    try {
      await readingPlanService.markDayAsCompleted(day.id);
      
      // Update local state
      setPlanDays(days => 
        days.map(d => 
          d.id === day.id 
            ? { ...d, isCompleted: true, completedDate: new Date().toISOString() }
            : d
        )
      );
      
      Alert.alert('Parabéns!', 'Leitura marcada como concluída! 🎉');
    } catch (error) {
      console.error('Error marking day as completed:', error);
      Alert.alert('Erro', 'Falha ao marcar dia como concluído');
    }
  };

  const getCalendarMarkedDates = () => {
    const marked: any = {};
    
    planDays.forEach(day => {
      const dateKey = day.date.split('T')[0];
      marked[dateKey] = {
        marked: true,
        dotColor: day.isCompleted ? '#4CAF50' : '#2196F3',
        selectedColor: day.isCompleted ? '#4CAF50' : '#2196F3',
      };
    });
    
    // Mark today
    const today = new Date().toISOString().split('T')[0];
    if (marked[today]) {
      marked[today].selected = true;
    } else {
      marked[today] = { selected: true, selectedColor: '#FF9800' };
    }
    
    return marked;
  };

  const getTodayReading = () => {
    const today = new Date().toISOString().split('T')[0];
    return planDays.find(day => day.date.startsWith(today));
  };

  const renderPlan = ({ item }: { item: ReadingPlan }) => (
    <TouchableOpacity 
      style={[
        styles.planCard,
        selectedPlan?.id === item.id && styles.selectedPlanCard
      ]}
      onPress={() => selectPlan(item)}
    >
      <Text style={styles.planName}>{item.name}</Text>
      <Text style={styles.planType}>
        {item.type === 'monthly' ? 'Mensal' : 
         item.type === 'yearly' ? 'Anual' : 'Personalizado'}
      </Text>
      <View style={styles.planProgress}>
        <Text style={styles.planProgressText}>
          {item.completedDays}/{item.totalDays} dias
        </Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill,
              { width: `${(item.completedDays / item.totalDays) * 100}%` }
            ]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderReading = ({ item }: { item: ReadingPlanDay }) => (
    <View style={styles.readingCard}>
      <View style={styles.readingHeader}>
        <Text style={styles.readingDay}>Dia {item.dayNumber}</Text>
        <Text style={styles.readingDate}>
          {new Date(item.date).toLocaleDateString('pt-BR')}
        </Text>
      </View>
      
      <View style={styles.readingContent}>
        {item.readings.map((reading, index) => (
          <Text key={index} style={styles.readingText}>
            {reading.bookName} {reading.startChapter}
            {reading.endChapter !== reading.startChapter && `-${reading.endChapter}`}
          </Text>
        ))}
      </View>
      
      {!item.isCompleted ? (
        <TouchableOpacity 
          style={styles.completeButton}
          onPress={() => markDayAsCompleted(item)}
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
  );

  const todayReading = getTodayReading();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planos de Leitura</Text>
        <TouchableOpacity 
          onPress={() => setShowCreateModal(true)} 
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {plans.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Nenhum Plano Ativo</Text>
          <Text style={styles.emptyText}>
            Crie seu primeiro plano de leitura para começar
          </Text>
          <TouchableOpacity 
            style={styles.createFirstPlanButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.createFirstPlanButtonText}>Criar Plano</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Plans List */}
          <FlatList
            data={plans}
            renderItem={renderPlan}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.plansList}
          />

          {/* Today's Reading */}
          {todayReading && (
            <View style={styles.todaySection}>
              <Text style={styles.sectionTitle}>Leitura de Hoje</Text>
              <View style={styles.todayCard}>
                {renderReading({ item: todayReading })}
              </View>
            </View>
          )}

          {/* Calendar */}
          {selectedPlan && (
            <View style={styles.calendarSection}>
              <Text style={styles.sectionTitle}>Calendário</Text>
              <Calendar
                markedDates={getCalendarMarkedDates()}
                theme={{
                  selectedDayBackgroundColor: '#2196F3',
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: '#FF9800',
                  dayTextColor: '#2d4150',
                  textDisabledColor: '#d9e1e8',
                  dotColor: '#00adf5',
                  selectedDotColor: '#ffffff',
                  arrowColor: '#2196F3',
                  monthTextColor: '#2d4150',
                  indicatorColor: '#2196F3',
                }}
              />
              
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={styles.legendText}>Concluída</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
                  <Text style={styles.legendText}>Pendente</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
                  <Text style={styles.legendText}>Hoje</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Create Plan Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Novo Plano de Leitura</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Nome do plano"
              value={newPlanName}
              onChangeText={setNewPlanName}
            />
            
            <Text style={styles.modalLabel}>Tipo do Plano:</Text>
            <View style={styles.planTypeOptions}>
              {[
                { key: 'monthly', label: 'Mensal (30 dias)' },
                { key: 'yearly', label: 'Anual (365 dias)' },
                { key: 'custom', label: 'Personalizado' }
              ].map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.planTypeOption,
                    newPlanType === option.key && styles.selectedPlanType
                  ]}
                  onPress={() => setNewPlanType(option.key as any)}
                >
                  <Text style={[
                    styles.planTypeOptionText,
                    newPlanType === option.key && styles.selectedPlanTypeText
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalCreateButton}
                onPress={handleCreatePlan}
              >
                <Text style={styles.modalCreateButtonText}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  addButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  createFirstPlanButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createFirstPlanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  plansList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  planCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginRight: 12,
    borderRadius: 12,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedPlanCard: {
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  planName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  planType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  planProgress: {
    marginTop: 8,
  },
  planProgressText: {
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
  todaySection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  todayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  calendarSection: {
    padding: 16,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  readingCard: {
    padding: 16,
  },
  readingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  readingDay: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  readingDate: {
    fontSize: 14,
    color: '#666',
  },
  readingContent: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  planTypeOptions: {
    marginBottom: 24,
  },
  planTypeOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedPlanType: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  planTypeOptionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  selectedPlanTypeText: {
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  modalCancelButtonText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalCreateButton: {
    flex: 1,
    padding: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#2196F3',
  },
  modalCreateButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
});