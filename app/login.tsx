import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AuthService from '../services/AuthService';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{email?: string; password?: string; displayName?: string; general?: string}>({});
  const [checkingEmail, setCheckingEmail] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

  const validate = async (): Promise<boolean> => {
    const newErrors: typeof errors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) newErrors.email = 'Informe o email';
    else if (!emailRegex.test(trimmedEmail)) newErrors.email = 'Email inválido';
    if (!password) newErrors.password = 'Informe a senha';
    else if (password.length < 6) newErrors.password = 'Mínimo 6 caracteres';
    if (mode === 'register') {
      if (!displayName.trim()) newErrors.displayName = 'Informe seu nome';
      if (!newErrors.email && trimmedEmail) {
        setCheckingEmail(true);
        const exists = await AuthService.emailExists(trimmedEmail);
        setCheckingEmail(false);
        if (exists) newErrors.email = 'Email já cadastrado';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async () => {
    const ok = await validate();
    if (!ok) return;
    try {
      setLoading(true);
      if (mode === 'login') {
        await AuthService.login(email.trim(), password);
      } else {
        await AuthService.registerWithName(email.trim(), password, displayName.trim());
      }
      router.replace('/');
    } catch (e: any) {
      let msg = e?.message || 'Falha ao autenticar';
      // Mensagens Firebase comuns
      if (/auth\/user-not-found/.test(msg)) msg = 'Usuário não encontrado';
      if (/auth\/wrong-password/.test(msg)) msg = 'Senha incorreta';
      if (/auth\/invalid-email/.test(msg)) msg = 'Email inválido';
      if (/auth\/email-already-in-use/.test(msg)) msg = 'Email já cadastrado';
      setErrors(prev => ({ ...prev, general: msg }));
      Alert.alert('Erro', msg);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.brand}>📖 ReadBible</Text>
        <Text style={styles.title}>{mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</Text>
        <Text style={styles.subtitle}>{mode === 'login' ? 'Entre para continuar seus estudos e ranking.' : 'Cadastre-se para salvar progresso e ranking.'}</Text>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="seu@email.com"
            placeholderTextColor="#777"
            autoCapitalize='none'
            keyboardType='email-address'
            value={email}
            onChangeText={(v)=>{ setEmail(v); if (errors.email) setErrors({...errors, email: undefined}); }}
            onBlur={async ()=>{ if(email && emailRegex.test(email) && mode==='register'){ setCheckingEmail(true); const exists = await AuthService.emailExists(email); setCheckingEmail(false); if(exists) setErrors(e=>({...e,email:'Email já cadastrado'})); }} }
          />
          {(errors.email || checkingEmail) && (
            <Text style={styles.errorText}>{checkingEmail ? 'Verificando...' : errors.email}</Text>
          )}
        </View>
        {mode === 'register' && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={[styles.input, errors.displayName && styles.inputError]}
              placeholder="Seu nome"
              placeholderTextColor="#777"
              value={displayName}
              onChangeText={(v)=>{ setDisplayName(v); if(errors.displayName) setErrors({...errors, displayName: undefined}); }}
            />
            {errors.displayName && <Text style={styles.errorText}>{errors.displayName}</Text>}
          </View>
        )}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={[styles.input, errors.password && styles.inputError]}
            placeholder="••••••••"
            placeholderTextColor="#777"
            secureTextEntry
            value={password}
            onChangeText={(v)=>{ setPassword(v); if(errors.password) setErrors({...errors, password: undefined}); }}
          />
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        </View>
        {errors.general && <Text style={[styles.errorText, { textAlign:'center', marginBottom:4 }]}>{errors.general}</Text>}
        <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} disabled={loading} onPress={submit}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{mode === 'login' ? 'Entrar' : 'Cadastrar'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setMode(m => m === 'login' ? 'register' : 'login'); setPassword(''); }}>
          <Text style={styles.switchText}>{mode === 'login' ? 'Criar nova conta' : 'Já tenho conta'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0f1115', alignItems:'center', justifyContent:'center', padding:20 },
  card: { width:'100%', maxWidth:420, backgroundColor:'#181c23', padding:28, borderRadius:22, borderWidth:1, borderColor:'#242a33' },
  brand: { textAlign:'center', color:'#90caf9', fontWeight:'600', marginBottom:8, fontSize:16, letterSpacing:0.5 },
  title: { fontSize:26, fontWeight:'700', color:'#f2f5f9', marginBottom:8, textAlign:'center' },
  subtitle: { fontSize:14, color:'#9aa4b1', marginBottom:24, textAlign:'center', lineHeight:20 },
  formGroup: { marginBottom:16 },
  label: { color:'#d0d6dd', marginBottom:6, fontSize:13, fontWeight:'500', letterSpacing:0.5 },
  input: { backgroundColor:'#1f252d', padding:14, borderRadius:12, color:'#fff', fontSize:15, borderWidth:1, borderColor:'#2c333d' },
  button: { backgroundColor:'#2196F3', paddingVertical:14, borderRadius:14, alignItems:'center', marginTop:4, shadowColor:'#2196F3', shadowOpacity:0.3, shadowOffset:{width:0,height:4}, shadowRadius:8, elevation:4 },
  buttonText: { color:'#fff', fontSize:16, fontWeight:'600', letterSpacing:0.5 },
  switchText: { marginTop:20, color:'#90caf9', textAlign:'center', fontSize:14 },
  inputError: { borderColor: '#e53935' },
  errorText: { color:'#e57373', fontSize:12, marginTop:4 },
});