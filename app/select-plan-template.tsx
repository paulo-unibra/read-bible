import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/theme-context';
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
      name: `Plano Sequencial ${new Date().getFullYear()}`,
      description: `Leia toda a Bíblia de forma sequencial até o final do ano. Faltam ${daysRemaining} dias para completar sua jornada espiritual.`,
      type: 'sequential',
      duration: daysRemaining,
      testament: 'both',
      readingsCount: 1189, // Total de capítulos da Bíblia
      isActive: true,
    };
  };

  const createInterleavedTemplate = (): PlanTemplate => {
    const daysRemaining = getDaysUntilEndOfYear();
    return {
      id: -2, // ID -2 para o template intercalado
      name: `Plano Intercalado ${new Date().getFullYear()}`,
      description: `Leia Antigo e Novo Testamento juntos até o fim do ano. Faltam ${daysRemaining} dias para completar sua jornada espiritual.`,
      type: 'custom',
      duration: daysRemaining,
      testament: 'both',
      readingsCount: 1189,
      isActive: true,
    };
  };

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await readingPlanService.getTemplates();
      
      // Adicionar templates padrão no início
      const sequentialTemplate = createDefaultTemplate();
      const interleavedTemplate = createInterleavedTemplate();
      setTemplates([sequentialTemplate, interleavedTemplate, ...data]);
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

    // Verificar autenticação para plano intercalado
    if (selectedTemplate.id === -2) {
      const authService = (await import('../services/AuthService')).default;
      if (!authService.isAuthenticated()) {
        Alert.alert(
          'Login Necessário',
          'O plano intercalado requer autenticação. Por favor, faça login primeiro.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Fazer Login', onPress: () => router.push('/auth') },
          ]
        );
        return;
      }
    }

    try {
      setLoading(true);
      
      console.log('🎯 [select-plan-template] Criando plano - Template ID:', selectedTemplate.id, 'Nome:', customName);
      
      // Se for o template sequencial (ID -1), usar função de criar plano anual
      if (selectedTemplate.id === -1) {
        console.log('📘 [select-plan-template] Criando plano sequencial...');
        await readingPlanService.createDefaultAnnualPlan(customName);
      } 
      // Se for o template intercalado (ID -2), usar função de criar plano intercalado
      else if (selectedTemplate.id === -2) {
        console.log('🔄 [select-plan-template] Criando plano intercalado...');
        await readingPlanService.createInterleavedPlan(customName);
      }
      // Se for o template NT 100 dias (ID -3)
      else if (selectedTemplate.id === -3) {
        console.log('📖 [select-plan-template] Criando plano NT 100 dias...');
        await readingPlanService.createNT100DaysPlan(customName);
      }
      // Senão, usar template do banco de dados
      else {
        console.log('📋 [select-plan-template] Criando plano a partir de template do backend...');
        await readingPlanService.createPlanFromTemplate(selectedTemplate.id, customName);
      }
      
      console.log('✅ [select-plan-template] Plano criado com sucesso!');
      
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
    } catch (error: any) {
      console.error('❌ [select-plan-template] Erro ao criar plano:', error);
      console.error('❌ [select-plan-template] Stack:', error?.stack);
      const errorMessage = error?.message || 'Falha ao criar plano de leitura';
      Alert.alert('Erro', errorMessage);
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
          { backgroundColor: colors.card, borderColor: colors.border },
          isSelected && { ...styles.selectedCard, borderColor: typeColor }
        ]}
        onPress={() => handleSelectTemplate(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.templateName, { color: colors.text }]}>{item.name}</Text>
          {isSelected && <Ionicons name="checkmark-circle" size={24} color={typeColor} />}
        </View>

        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: typeColor + '20' }]}>
            <Text style={[styles.badgeText, { color: typeColor }]}>
              {getTypeLabel(item.type)}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isDark ? '#404040' : '#f0f0f0' }]}>
            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{getTestamentLabel(item.testament)}</Text>
          </View>
        </View>

        <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>{item.duration} dias</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="book-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>{item.readingsCount} leituras</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const colors = {
    bg: isDark ? '#1a1a1a' : '#f5f5f5',
    card: isDark ? '#2a2a2a' : '#ffffff',
    text: isDark ? '#ffffff' : '#333333',
    textSecondary: isDark ? '#b0b0b0' : '#666666',
    accent: isDark ? '#8b5cf6' : '#8b5cf6',
    border: isDark ? '#404040' : '#e0e0e0',
    headerBg: isDark ? '#242424' : '#ffffff',
  };

  if (loading && templates.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando templates...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Escolher Plano de Leitura</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={templates}
        renderItem={renderTemplate}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum template disponível</Text>
          </View>
        }
      />

      {selectedTemplate && (
        <View style={[styles.footer, { backgroundColor: colors.headerBg, borderTopColor: colors.border }]}>
          <View style={styles.nameInputContainer}>
            <Text style={[styles.nameLabel, { color: colors.text }]}>Nome do seu plano:</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
              value={customName}
              onChangeText={setCustomName}
              placeholder="Digite um nome personalizado"
              placeholderTextColor={colors.textSecondary}
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
