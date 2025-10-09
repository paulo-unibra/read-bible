import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import QuizService from '../services/QuizService';

interface QuizButtonProps {
  bookId: number;
  chapterNumber: number;
  bookName: string;
  bibleVersion?: string;
  isDark?: boolean;
}

const QuizButton: React.FC<QuizButtonProps> = ({
  bookId,
  chapterNumber,
  bookName,
  bibleVersion,
  isDark = false,
}) => {
  const router = useRouter();
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const checkQuizAvailability = useCallback(async () => {
    try {
      setChecking(true);
      const available = await QuizService.checkQuizAvailable(bookId, chapterNumber);
      setIsAvailable(available);
    } catch (error) {
      console.error('Error checking quiz availability:', error);
      setIsAvailable(false);
    } finally {
      setChecking(false);
    }
  }, [bookId, chapterNumber]);

  useEffect(() => {
    checkQuizAvailability();
  }, [checkQuizAvailability]);

  const handleQuizPress = async () => {
    try {
      if (checking) return;
      if (!isAvailable) {
        Alert.alert('Quiz Indisponível', 'Não há questionário disponível para este capítulo.');
        return;
      }
      // iniciar quiz
      router.push({
        pathname: '/quiz',
        params: {
          bookId: bookId.toString(),
          chapterNumber: chapterNumber.toString(),
          bookName,
          bibleVersion: bibleVersion || '',
        },
      });
    } catch (e) {
      console.error('Erro no botão de quiz', e);
    }
  };

  const showSpinner = checking;

  const iconColor = isDark ? '#90caf9' : '#2196F3';
  const iconBg = isDark ? '#2a2a2a' : '#f8f9fa';

  // Só mostra o botão se o quiz estiver disponível ou ainda estiver verificando
  if (!checking && !isAvailable) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[
        styles.quizButton,
        { backgroundColor: iconBg, borderColor: iconColor },
      ]}
      onPress={handleQuizPress}
      disabled={showSpinner}
    >
      {showSpinner ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <Ionicons name="game-controller" size={20} color={iconColor} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  quizButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quizButtonLoading: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },
});

export default QuizButton;