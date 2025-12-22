import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatabaseService from '../services/DatabaseService';

export default function ExploreScreen() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontSizePref, setFontSizePref] = useState<'small' | 'medium' | 'large'>('medium');

  useEffect(() => { (async () => {
    const settings = await DatabaseService.getMultipleSettings(['theme', 'fontSize']);
    const t = settings.theme; if (t === 'dark' || t === 'light') setTheme(t);
    const f = settings.fontSize; if (f === 'small' || f === 'medium' || f === 'large') setFontSizePref(f);
  })(); }, []);

  const applyFontScale = useCallback((b: number) => fontSizePref==='small'? b*0.9 : fontSizePref==='large'? b*1.2 : b, [fontSizePref]);
  const isDark = theme === 'dark';
  const colors = { bg: isDark? '#121212':'#f5f5f5', surface: isDark? '#1e1e1e':'#fff', surfaceAlt: isDark? '#262626':'#f8f9fa', text: isDark? '#e0e0e0':'#333', text2: isDark? '#b0b0b0':'#555', border: isDark? '#2b2b2b':'#e0e0e0' } as const;

  return (
    <SafeAreaView style={[styles.container,{ backgroundColor: colors.bg }]}> 
      <ScrollView style={styles.scrollView}>
        <View style={[styles.header,{ backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle,{ color: colors.text, fontSize: applyFontScale(28) }]}>Explorar</Text>
        </View>

        <View style={[styles.statsSection,{ backgroundColor: colors.surface }]}> 
          <Text style={[styles.sectionTitle,{ color: colors.text, fontSize: applyFontScale(20) }]}>Estatísticas</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard,{ backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="book-outline" size={32} color={isDark? '#90caf9':'#2196F3'} />
              <Text style={[styles.statNumber,{ color: colors.text, fontSize: applyFontScale(24) }]}>66</Text>
              <Text style={[styles.statLabel,{ color: colors.text2 }]}>Livros da Bíblia</Text>
            </View>
            <View style={[styles.statCard,{ backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="library-outline" size={32} color={isDark? '#ffcc80':'#FF9800'} />
              <Text style={[styles.statNumber,{ color: colors.text, fontSize: applyFontScale(24) }]}>1,189</Text>
              <Text style={[styles.statLabel,{ color: colors.text2 }]}>Capítulos</Text>
            </View>
            <View style={[styles.statCard,{ backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="document-text-outline" size={32} color={isDark? '#81c784':'#4CAF50'} />
              <Text style={[styles.statNumber,{ color: colors.text, fontSize: applyFontScale(24) }]}>31,102</Text>
              <Text style={[styles.statLabel,{ color: colors.text2 }]}>Versículos</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section,{ backgroundColor: colors.surface }]}> 
          <Text style={[styles.sectionTitle,{ color: colors.text, fontSize: applyFontScale(20) }]}>Estrutura da Bíblia</Text>
          <View style={[styles.testamentCard,{ backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.testamentTitle,{ color: colors.text, fontSize: applyFontScale(18) }]}>Antigo Testamento</Text>
            <Text style={[styles.testamentInfo,{ color: colors.text2 }]}>39 livros • 929 capítulos</Text>
            <Text style={[styles.testamentDescription,{ color: colors.text2, fontSize: applyFontScale(14), lineHeight: applyFontScale(20) }]}>Desde Gênesis até Malaquias, contém a história do povo de Israel e as profecias sobre o Messias.</Text>
          </View>
          <View style={[styles.testamentCard,{ backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.testamentTitle,{ color: colors.text, fontSize: applyFontScale(18) }]}>Novo Testamento</Text>
            <Text style={[styles.testamentInfo,{ color: colors.text2 }]}>27 livros • 260 capítulos</Text>
            <Text style={[styles.testamentDescription,{ color: colors.text2, fontSize: applyFontScale(14), lineHeight: applyFontScale(20) }]}>Desde Mateus até Apocalipse, relata a vida de Jesus Cristo e o início da Igreja Cristã.</Text>
          </View>
        </View>

        <View style={[styles.section,{ backgroundColor: colors.surface }]}> 
          <Text style={[styles.sectionTitle,{ color: colors.text, fontSize: applyFontScale(20) }]}>Dicas de Leitura</Text>
          {[
            { icon:'bulb-outline', color:isDark? '#ffcc80':'#FF9800', title:'Estabeleça uma Rotina', text:'Escolha um horário fixo para sua leitura diária e seja consistente.'},
            { icon:'heart-outline', color:isDark? '#ef9a9a':'#f44336', title:'Ore Antes de Ler', text:'Peça ao Espírito Santo para iluminar sua compreensão.'},
            { icon:'create-outline', color:isDark? '#ce93d8':'#9C27B0', title:'Tome Notas', text:'Anote versículos importantes e reflexões pessoais.'},
            { icon:'people-outline', color:isDark? '#81c784':'#4CAF50', title:'Compartilhe', text:'Discuta suas leituras com outros cristãos para crescer na fé.'},
          ].map((t,i) => (
            <View key={i} style={[styles.tipCard,{ backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name={t.icon as any} size={24} color={t.color} />
              <View style={styles.tipContent}>
                <Text style={[styles.tipTitle,{ color: colors.text, fontSize: applyFontScale(16) }]}>{t.title}</Text>
                <Text style={[styles.tipText,{ color: colors.text2, fontSize: applyFontScale(14), lineHeight: applyFontScale(20) }]}>{t.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.section,{ backgroundColor: colors.surface }]}> 
          <Text style={[styles.sectionTitle,{ color: colors.text, fontSize: applyFontScale(20) }]}>Sobre o Bíblia em Foco</Text>
          <Text style={[styles.aboutText,{ color: colors.text2, fontSize: applyFontScale(16), lineHeight: applyFontScale(24) }]}>O Bíblia em Foco foi desenvolvido para tornar o estudo da Bíblia mais acessível e organizado. Com funcionalidades de leitura livre e planos estruturados, você pode personalizar sua jornada espiritual conforme suas necessidades.</Text>
          <View style={styles.featuresList}>
            {['Múltiplas versões da Bíblia','Planos de leitura personalizáveis','Sistema de favoritos','Busca por palavras-chave','Lembretes diários'].map((f,i) => (
              <View key={i} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={isDark? '#81c784':'#4CAF50'} />
                <Text style={[styles.featureText,{ color: colors.text2, fontSize: applyFontScale(14) }]}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1 },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  section: { backgroundColor: '#fff', marginTop: 16, padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  statsSection: { backgroundColor: '#fff', marginTop: 16, padding: 16 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statCard: { flex:1, alignItems:'center', padding:16, marginHorizontal:4, backgroundColor:'#f8f9fa', borderRadius:12 },
  statNumber: { fontSize:24, fontWeight:'bold', color:'#333', marginTop:8, marginBottom:4 },
  statLabel: { fontSize:12, color:'#666', textAlign:'center' },
  testamentCard: { backgroundColor:'#f8f9fa', padding:16, borderRadius:12, marginBottom:12 },
  testamentTitle: { fontSize:18, fontWeight:'bold', color:'#333', marginBottom:4 },
  testamentInfo: { fontSize:14, color:'#666', marginBottom:8 },
  testamentDescription: { fontSize:14, color:'#555', lineHeight:20 },
  tipCard: { flexDirection:'row', alignItems:'flex-start', padding:16, backgroundColor:'#f8f9fa', borderRadius:12, marginBottom:12 },
  tipContent: { flex:1, marginLeft:12 },
  tipTitle: { fontSize:16, fontWeight:'600', color:'#333', marginBottom:4 },
  tipText: { fontSize:14, color:'#555', lineHeight:20 },
  aboutText: { fontSize:16, color:'#555', lineHeight:24, marginBottom:16 },
  featuresList: { marginTop:8 },
  featureItem: { flexDirection:'row', alignItems:'center', marginBottom:8 },
  featureText: { fontSize:14, color:'#555', marginLeft:8 },
});
