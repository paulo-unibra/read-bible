import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import readingPlanService from '../services/ReadingPlanService';

interface PlanTemplate {
  id: number;
  name: string;
  description: string;
  type: 'annual' | 'custom' | 'sequential' | 'thematic';
  duration: number;
  testament: 'old' | 'new' | 'both';
  readingsCount: number;
  isActive: boolean;
}

export default function SelectPlanTemplateScreen() {
  const router = useRouter();
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [customName, setCustomName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<PlanTemplate | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const getDaysUntilEndOfYear = () => {
    const today = new Date();
    const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59);
    const diffTime = endOfYear.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const createDefaultTemplate = (): PlanTemplate => {
    const daysRemaining = getDaysUntilEndOfYear();
    return {
      id: -1, // ID negativo para indicar que é o template padrão
      name: `Plano Anual ${new Date().getFullYear()}`,
      description: `Leia toda a Bíblia até o final do ano. Faltam ${daysRemaining} dias para completar sua jornada espiritual.`,
      type: 'annual',
      duration: daysRemaining,
      testament: 'both',
      readingsCount: 1189, // Total de capítulos da Bíblia
      isActive: true,
    };
  };

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await readingPlanService.getTemplates();
      
      // Adicionar template padrão no início
      const defaultTemplate = createDefaultTemplate();
      setTemplates([defaultTemplate, ...data]);
    } catch (error) {
      console.error('Error loading templates:', error);
      Alert.alert('Erro', 'Falha ao carregar templates de planos');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template: PlanTemplate) => {
    setSelectedTemplate(template);
    // Pre-fill name with template name
    setCustomName(template.name);
  };

  const handleCreatePlan = async () => {
    if (!selectedTemplate) {
      Alert.alert('Atenção', 'Selecione um template primeiro');
      return;
    }

    if (!customName.trim()) {
      Alert.alert('Atenção', 'Digite um nome para seu plano');
      return;
    }

    try {
      setLoading(true);
      
      // Se for o template padrão (ID -1), usar a função antiga de criar plano anual
      if (selectedTemplate.id === -1) {
        await readingPlanService.createDefaultAnnualPlan(customName);
      } else {
        // Senão, usar template do banco de dados
        await readingPlanService.createPlanFromTemplate(selectedTemplate.id, customName);
      }
      
      Alert.alert(
        'Sucesso! 🎉',
        'Plano de leitura criado com sucesso!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error creating plan:', error);
      Alert.alert('Erro', 'Falha ao criar plano de leitura');
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      annual: 'Anual',
      custom: 'Personalizado',
      sequential: 'Sequencial',
      thematic: 'Temático',
    };
    return labels[type] || type;
  };

  const getTestamentLabel = (testament: string) => {
    const labels: Record<string, string> = {
      old: 'Antigo Testamento',
      new: 'Novo Testamento',
      both: 'Ambos',
    };
    return labels[testament] || testament;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      annual: '#2196F3',
      custom: '#9C27B0',
      sequential: '#4CAF50',
      thematic: '#FF9800',
    };
    return colors[type] || '#757575';
  };

  const renderTemplate = ({ item }: { item: PlanTemplate }) => {
    const isSelected = selectedTemplate?.id === item.id;
    const typeColor = getTypeColor(item.type);

    return (
      <TouchableOpacity
        style={[
          styles.templateCard,
          isSelected && { ...styles.selectedCard, borderColor: typeColor }
        ]}
        onPress={() => handleSelectTemplate(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.templateName}>{item.name}</Text>
          {isSelected && <Ionicons name="checkmark-circle" size={24} color={typeColor} />}
        </View>

        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: typeColor + '20' }]}>
            <Text style={[styles.badgeText, { color: typeColor }]}>
              {getTypeLabel(item.type)}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{getTestamentLabel(item.testament)}</Text>
          </View>
        </View>

        <Text style={styles.description}>{item.description}</Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.statText}>{item.duration} dias</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="book-outline" size={16} color="#666" />
            <Text style={styles.statText}>{item.readingsCount} leituras</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && templates.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Carregando templates...</Text>
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
        <Text style={styles.headerTitle}>Escolher Plano de Leitura</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={templates}
        renderItem={renderTemplate}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum template disponível</Text>
          </View>
        }
      />

      {selectedTemplate && (
        <View style={styles.footer}>
          <View style={styles.nameInputContainer}>
            <Text style={styles.nameLabel}>Nome do seu plano:</Text>
            <TextInput
              style={styles.nameInput}
              value={customName}
              onChangeText={setCustomName}
              placeholder="Digite um nome personalizado"
              placeholderTextColor="#999"
            />
          </View>
          <TouchableOpacity
            style={[
              styles.createButton,
              { backgroundColor: getTypeColor(selectedTemplate.type) }
            ]}
            onPress={handleCreatePlan}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={24} color="#fff" />
                <Text style={styles.createButtonText}>Criar Plano</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  templateCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedCard: {
    borderWidth: 3,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  templateName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  nameInputContainer: {
    marginBottom: 12,
  },
  nameLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
