import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/theme-context';
import passwordResetService from '../services/PasswordResetService';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [step, setStep] = useState<'email' | 'token' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async () => {
    if (!email) {
      Alert.alert('Atenção', 'Digite seu email');
      return;
    }

    setLoading(true);
    try {
      const response = await passwordResetService.requestReset(email);

      if (response.success) {
        Alert.alert('Sucesso', response.message);
        setStep('token');
        // Em desenvolvimento, mostrar o token
        if (response.token) {
          Alert.alert('Token de Desenvolvimento', `Seu token é: ${response.token}`);
        }
      } else {
        Alert.alert('Erro', response.message);
      }
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyToken = async () => {
    if (!token) {
      Alert.alert('Atenção', 'Digite o código de 6 dígitos');
      return;
    }

    setLoading(true);
    try {
      const response = await passwordResetService.verifyToken(email, token);

      if (response.success) {
        setStep('password');
      } else {
        Alert.alert('Erro', response.message);
      }
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Atenção', 'Preencha todos os campos');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Atenção', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Atenção', 'As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const response = await passwordResetService.resetPassword(email, token, newPassword);

      if (response.success) {
        Alert.alert('Sucesso', response.message, [
          {
            text: 'OK',
            onPress: () => router.replace('/auth'),
          },
        ]);
      } else {
        Alert.alert('Erro', response.message);
      }
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Recuperar Senha</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {step === 'email' && 'Digite seu email para receber o código de recuperação'}
              {step === 'token' && 'Digite o código de 6 dígitos enviado para seu email'}
              {step === 'password' && 'Digite sua nova senha'}
            </Text>
          </View>

          <View style={styles.form}>
            {step === 'email' && (
              <>
                <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
                  <Ionicons name="mail-outline" size={20} color={colors.iconMuted} style={styles.icon} />
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    placeholder="Email"
                    placeholderTextColor={colors.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
                  onPress={handleRequestReset}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>
                    {loading ? 'Enviando...' : 'Enviar Código'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'token' && (
              <>
                <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
                  <Ionicons name="key-outline" size={20} color={colors.iconMuted} style={styles.icon} />
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    placeholder="Código de 6 dígitos"
                    placeholderTextColor={colors.textSecondary}
                    value={token}
                    onChangeText={setToken}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
                  onPress={handleVerifyToken}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>
                    {loading ? 'Verificando...' : 'Verificar Código'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => setStep('email')}
                  disabled={loading}
                >
                  <Text style={[styles.linkText, { color: colors.primary }]}>Não recebeu o código? Reenviar</Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'password' && (
              <>
                <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.iconMuted} style={styles.icon} />
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    placeholder="Nova senha"
                    placeholderTextColor={colors.textSecondary}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    editable={!loading}
                  />
                </View>

                <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.iconMuted} style={styles.icon} />
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    placeholder="Confirmar senha"
                    placeholderTextColor={colors.textSecondary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>
                    {loading ? 'Salvando...' : 'Redefinir Senha'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
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
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    padding: 12,
  },
  linkText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
  },
});
