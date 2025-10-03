import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AuthService from '../services/AuthService';
import RankingService from '../services/RankingService';

export default function RankingScreen() {
  const router = useRouter();
  const user = AuthService.getCurrentUser();
  const data = RankingService.list();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}> 
        <Text style={styles.title}>Ranking Geral</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>Voltar</Text></TouchableOpacity>
      </View>
      {!user && <Text style={styles.info}>Faça login para registrar seus resultados.</Text>}
      <FlatList
        data={data}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding:16, paddingBottom:32 }}
        renderItem={({ item, index }) => (
          <View style={[styles.card, index < 3 && styles.highlight]}> 
            <View style={styles.row}> 
              <Text style={styles.pos}>{index+1}</Text>
              <View style={{ flex:1 }}>
                <Text style={styles.username}>{item.username}</Text>
                <Text style={styles.quiz}>{item.quizName} (Livro {item.bookId} Cap {item.chapter})</Text>
              </View>
              <View style={styles.scoreBox}> 
                <Text style={styles.percentage}>{item.percentage}%</Text>
                <Text style={styles.small}>{item.correct}/{item.total}</Text>
                <Text style={styles.small}>{Math.round(item.totalTimeMs/1000)}s</Text>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.info}>Nenhum resultado ainda.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#121212' },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16 },
  title: { color:'#fff', fontSize:22, fontWeight:'700' },
  back: { color:'#90caf9', fontSize:16 },
  info: { color:'#bbb', textAlign:'center', marginTop:24 },
  card: { backgroundColor:'#1f1f1f', marginBottom:12, borderRadius:12, padding:14 },
  highlight: { borderWidth:1, borderColor:'#2196F3' },
  row: { flexDirection:'row', alignItems:'center' },
  pos: { width:28, color:'#90caf9', fontSize:16, fontWeight:'600' },
  username: { color:'#fff', fontSize:16, fontWeight:'600' },
  quiz: { color:'#999', fontSize:12, marginTop:2 },
  scoreBox: { alignItems:'flex-end', gap:2 },
  percentage: { color:'#4CAF50', fontWeight:'700', fontSize:16 },
  small: { color:'#ccc', fontSize:12 }
});