import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AuthService from '../services/AuthService';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      if (mode === 'login') {
        await AuthService.login(username, password);
      } else {
        await AuthService.register(username, password);
      }
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{mode === 'login' ? 'Entrar' : 'Registrar'}</Text>
        <TextInput style={styles.input} placeholder="Usuário" autoCapitalize='none' value={username} onChangeText={setUsername} />
        <TextInput style={styles.input} placeholder="Senha" secureTextEntry value={password} onChangeText={setPassword} />
        <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} disabled={loading} onPress={submit}>
          <Text style={styles.buttonText}>{mode === 'login' ? 'Login' : 'Cadastrar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode(m => m === 'login' ? 'register' : 'login')}>
          <Text style={styles.switchText}>{mode === 'login' ? 'Criar nova conta' : 'Já tenho conta'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#121212', alignItems:'center', justifyContent:'center', padding:20 },
  card: { width:'100%', backgroundColor:'#1e1e1e', padding:24, borderRadius:16 },
  title: { fontSize:24, fontWeight:'700', color:'#fafafa', marginBottom:20, textAlign:'center' },
  input: { backgroundColor:'#2a2a2a', padding:14, borderRadius:10, color:'#fff', marginBottom:12 },
  button: { backgroundColor:'#2196F3', padding:14, borderRadius:10, alignItems:'center', marginTop:4 },
  buttonText: { color:'#fff', fontSize:16, fontWeight:'600' },
  switchText: { marginTop:16, color:'#90caf9', textAlign:'center' }
});