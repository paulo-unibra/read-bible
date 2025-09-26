import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExploreScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Explorar</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Estatísticas</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="book-outline" size={32} color="#2196F3" />
              <Text style={styles.statNumber}>66</Text>
              <Text style={styles.statLabel}>Livros da Bíblia</Text>
            </View>
            
            <View style={styles.statCard}>
              <Ionicons name="library-outline" size={32} color="#FF9800" />
              <Text style={styles.statNumber}>1,189</Text>
              <Text style={styles.statLabel}>Capítulos</Text>
            </View>
            
            <View style={styles.statCard}>
              <Ionicons name="document-text-outline" size={32} color="#4CAF50" />
              <Text style={styles.statNumber}>31,102</Text>
              <Text style={styles.statLabel}>Versículos</Text>
            </View>
          </View>
        </View>

        {/* Bible Structure */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estrutura da Bíblia</Text>
          
          <View style={styles.testamentCard}>
            <Text style={styles.testamentTitle}>Antigo Testamento</Text>
            <Text style={styles.testamentInfo}>39 livros • 929 capítulos</Text>
            <Text style={styles.testamentDescription}>
              Desde Gênesis até Malaquias, contém a história do povo de Israel
              e as profecias sobre o Messias.
            </Text>
          </View>
          
          <View style={styles.testamentCard}>
            <Text style={styles.testamentTitle}>Novo Testamento</Text>
            <Text style={styles.testamentInfo}>27 livros • 260 capítulos</Text>
            <Text style={styles.testamentDescription}>
              Desde Mateus até Apocalipse, relata a vida de Jesus Cristo
              e o início da Igreja Cristã.
            </Text>
          </View>
        </View>

        {/* Reading Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dicas de Leitura</Text>
          
          <View style={styles.tipCard}>
            <Ionicons name="bulb-outline" size={24} color="#FF9800" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Estabeleça uma Rotina</Text>
              <Text style={styles.tipText}>
                Escolha um horário fixo para sua leitura diária e seja consistente.
              </Text>
            </View>
          </View>
          
          <View style={styles.tipCard}>
            <Ionicons name="heart-outline" size={24} color="#f44336" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Ore Antes de Ler</Text>
              <Text style={styles.tipText}>
                Peça ao Espírito Santo para iluminar sua compreensão.
              </Text>
            </View>
          </View>
          
          <View style={styles.tipCard}>
            <Ionicons name="create-outline" size={24} color="#9C27B0" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Tome Notas</Text>
              <Text style={styles.tipText}>
                Anote versículos importantes e reflexões pessoais.
              </Text>
            </View>
          </View>
          
          <View style={styles.tipCard}>
            <Ionicons name="people-outline" size={24} color="#4CAF50" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Compartilhe</Text>
              <Text style={styles.tipText}>
                Discuta suas leituras com outros cristãos para crescer na fé.
              </Text>
            </View>
          </View>
        </View>

        {/* About the App */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre o ReadBible</Text>
          <Text style={styles.aboutText}>
            O ReadBible foi desenvolvido para tornar o estudo da Bíblia mais 
            acessível e organizado. Com funcionalidades de leitura livre e 
            planos estruturados, você pode personalizar sua jornada espiritual 
            conforme suas necessidades.
          </Text>
          
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.featureText}>Múltiplas versões da Bíblia</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.featureText}>Planos de leitura personalizáveis</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.featureText}>Sistema de favoritos</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.featureText}>Busca por palavras-chave</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.featureText}>Lembretes diários</Text>
            </View>
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
  scrollView: {
    flex: 1,
  },
  header: {
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
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statsSection: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  testamentCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  testamentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  testamentInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  testamentDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  aboutText: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    marginBottom: 16,
  },
  featuresList: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
  },
});
