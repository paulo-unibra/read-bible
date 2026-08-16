import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/theme-context';
import authService from '../services/AuthService';

export default function AuthScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const [isLogin, setIsLogin] = useState(params.mode !== 'register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Mostrar mensagem se veio dos params
  useEffect(() => {
    if (params.message && typeof params.message === 'string') {
      Alert.alert('Login Necessário', params.message);
    }
  }, [params.message]);

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert('Atenção', 'Preencha todos os campos');
      return;
    }

    if (!isLogin && name.includes('@')) {
      Alert.alert('Atenção', 'O nome não pode ser um email');
      return;
    }

    if (
      !isLogin &&
      (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    ) {
      Alert.alert(
        'Atenção',
        'A senha deve ter pelo menos 8 caracteres, com letras e números'
      );
      return;
    }

    setLoading(true);
    try {
      console.log('🚀 Iniciando autenticação...');
      console.log('📧 Email:', email);
      console.log('🔐 Modo:', isLogin ? 'Login' : 'Registro');
      
      const response = isLogin
        ? await authService.login(email, password)
        : await authService.register(name, email, password);

      console.log('✅ Resposta recebida:', response);

      if (response.success) {
        Alert.alert('Sucesso', response.message, [
          {
            text: 'OK',
            onPress: () => {
              // Redirecionar para home após login ou cadastro
              router.replace('/');
            },
          },
        ]);
      } else {
        Alert.alert('Erro', response.message);
      }
    } catch (error) {
      console.error('❌ Erro no handleAuth:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      Alert.alert(
        'Erro',
        `Ocorreu um erro. Tente novamente.\n\nDetalhes: ${errorMessage}`
      );
    } finally {
      setLoading(false);
    }
  };

  const createReadingPlan = async () => {
    try {
      const response = await authService.createReadingPlan();
      if (response.success) {
        Alert.alert(
          'Plano Criado!',
          `Seu plano de leitura foi criado com sucesso!\n\n` +
          `📅 ${response.data.plan.totalDays} dias até o fim do ano\n` +
          `📖 ${response.data.plan.chaptersPerDay} capítulos por dia`,
          [{ text: 'Começar', onPress: () => router.replace('/') }]
        );
      } else {
        Alert.alert('Aviso', response.message, [
          { text: 'OK', onPress: () => router.replace('/') }
        ]);
      }
    } catch (error) {
      console.error('Erro ao criar plano:', error);
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Ionicons name="book" size={64} color={colors.primary} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Bíblia em Foco</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {isLogin ? 'Entre para continuar' : 'Crie sua conta e comece hoje'}
            </Text>
          </View>

          <View style={styles.form}>
            {!isLogin && (
              <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
                <Ionicons name="person-outline" size={20} color={colors.iconMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="Nome completo"
                  placeholderTextColor={colors.textSecondary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
              <Ionicons name="mail-outline" size={20} color={colors.iconMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.iconMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="Senha"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
              onPress={handleAuth}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Criar Conta'}
              </Text>
            </TouchableOpacity>

            {isLogin && (
              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => router.push('/forgot-password')}
              >
                <Text style={[styles.forgotText, { color: colors.primary }]}>Esqueceu a senha?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={[styles.switchText, { color: colors.primary }]}>
                {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.info}>
            <Ionicons name="information-circle-outline" size={20} color="#666" />
            <Text style={styles.infoText}>
              {isLogin
                ? 'Entre para acessar seu plano de leitura'
                : 'Crie sua conta para ter acesso ao plano de leitura anual da Bíblia'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#90caf9',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  forgotButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  forgotText: {
    color: '#2196F3',
    fontSize: 14,
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '500',
  },
  info: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
