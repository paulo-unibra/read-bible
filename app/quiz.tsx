import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QuizService, { Quiz, QuizSession } from '../services/QuizService';

export default function QuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const bookId = parseInt(params.bookId as string);
  const chapterNumber = parseInt(params.chapterNumber as string);

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const timerRef = React.useRef<number | null>(null);
  
  // Animações
  const [timerAnimation] = useState(new Animated.Value(1));
  const [progressAnimation] = useState(new Animated.Value(0));

  const sessionRef = React.useRef(session);
  const questionStartTimeRef = React.useRef(questionStartTime);
  
  // Manter refs atualizadas
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  
  useEffect(() => {
    questionStartTimeRef.current = questionStartTime;
  }, [questionStartTime]);

  const nextQuestion = useCallback(() => {
    setSelectedAnswer(null);
    setTimeLeft(30);
    progressAnimation.setValue(0);
  }, [progressAnimation]);

  const loadQuiz = useCallback(async () => {
    try {
      setLoading(true);
      const quizData = await QuizService.loadQuiz(bookId, chapterNumber);
      setQuiz(quizData);
      setSession(QuizService.createQuizSession(quizData));
      setQuestionStartTime(Date.now());
    } catch (error) {
      console.error('Error loading quiz:', error);
      Alert.alert(
        'Erro',
        'Não foi possível carregar o questionário',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } finally {
      setLoading(false);
    }
  }, [bookId, chapterNumber, router]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  // Effect para iniciar timer quando uma nova pergunta é apresentada
  useEffect(() => {
    if (session && !session.isCompleted && !showResult && !selectedAnswer) {
      // Limpar timer anterior
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Iniciar novo timer
      setTimeLeft(30);
      setQuestionStartTime(Date.now());
      
      // Animar progresso do timer
      progressAnimation.setValue(0);
      Animated.timing(progressAnimation, {
        toValue: 1,
        duration: 30000,
        useNativeDriver: false,
      }).start();

      // Timer countdown
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            
            // Time's up - handle timeout usando refs
            const currentSession = sessionRef.current;
            if (currentSession) {
              const timeSpent = Date.now() - questionStartTimeRef.current;
              const updatedSession = QuizService.answerQuestion(currentSession, '', timeSpent);
              setSession(updatedSession);
              
              if (updatedSession.isCompleted) {
                setShowResult(true);
              } else {
                setTimeout(() => {
                  setSelectedAnswer(null);
                  setTimeLeft(30);
                  progressAnimation.setValue(0);
                }, 100);
              }
            }
            return 0;
          }
          
          // Animar quando restam 10 segundos
          if (prev <= 10) {
            Animated.sequence([
              Animated.timing(timerAnimation, {
                toValue: 1.2,
                duration: 100,
                useNativeDriver: true,
              }),
              Animated.timing(timerAnimation, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
              }),
            ]).start();
          }
          
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [session?.currentQuestionIndex, showResult, selectedAnswer, progressAnimation, timerAnimation, session]);



  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer || !session) return;
    
    // Parar o timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setSelectedAnswer(answer);
    
    const timeSpent = Date.now() - questionStartTime;
    const updatedSession = QuizService.answerQuestion(session, answer, timeSpent);
    setSession(updatedSession);
    
    // Mostrar feedback visual por 2 segundos
    setTimeout(() => {
      if (updatedSession.isCompleted) {
        setShowResult(true);
      } else {
        nextQuestion();
      }
    }, 2000);
  };



  const restartQuiz = () => {
    if (quiz) {
      // Limpar timer se estiver rodando
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setSession(QuizService.createQuizSession(quiz));
      setSelectedAnswer(null);
      setShowResult(false);
      setTimeLeft(30);
      setQuestionStartTime(Date.now());
      progressAnimation.setValue(0);
    }
  };

  const getAnswerStyle = (answer: string) => {
    if (!selectedAnswer) return styles.answerButton;
    
    if (answer === selectedAnswer) {
      const currentQuestion = session?.quiz.questions[session.currentQuestionIndex - 1];
      return answer === currentQuestion?.respostaCorreta
        ? styles.answerButtonCorrect
        : styles.answerButtonWrong;
    }
    
    // Mostrar resposta correta se a selecionada estava errada
    const currentQuestion = session?.quiz.questions[session.currentQuestionIndex - 1];
    if (selectedAnswer !== currentQuestion?.respostaCorreta && answer === currentQuestion?.respostaCorreta) {
      return styles.answerButtonCorrect;
    }
    
    return styles.answerButtonDisabled;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Carregando questionário...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!quiz || !session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Erro ao carregar questionário</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (showResult) {
    const score = QuizService.calculateScore(session);
    const message = QuizService.getPerformanceMessage(score.percentage);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#2196F3" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Resultado</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>{quiz.name}</Text>
          
          <View style={styles.scoreCard}>
            <Text style={styles.scoreText}>{score.correct}/{score.total}</Text>
            <Text style={styles.percentageText}>{score.percentage}%</Text>
          </View>
          
          <Text style={styles.messageText}>{message}</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Tempo Total</Text>
              <Text style={styles.statValue}>{Math.round(score.totalTime / 1000)}s</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Tempo Médio</Text>
              <Text style={styles.statValue}>{Math.round(score.averageTime / 1000)}s</Text>
            </View>
          </View>
          
          <View style={styles.resultButtons}>
            <TouchableOpacity style={styles.restartButton} onPress={restartQuiz}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.restartButtonText}>Refazer</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.finishButton} onPress={() => router.back()}>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.finishButtonText}>Concluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = session.quiz.questions[session.currentQuestionIndex];
  const progress = ((session.currentQuestionIndex + 1) / session.quiz.questions.length) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{quiz.name}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {session.currentQuestionIndex + 1} de {session.quiz.questions.length}
        </Text>
      </View>

      {/* Timer */}
      <View style={styles.timerContainer}>
        <Animated.View style={[styles.timerCircle, { transform: [{ scale: timerAnimation }] }]}>
          <Text style={[styles.timerText, { color: timeLeft <= 10 ? '#f44336' : '#2196F3' }]}>
            {timeLeft}
          </Text>
        </Animated.View>
        <Animated.View
          style={[
            styles.timerProgress,
            {
              width: progressAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ['100%', '0%'],
              }),
            },
          ]}
        />
      </View>

      {/* Question */}
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>{currentQuestion.pergunta}</Text>
      </View>

      {/* Answers */}
      <View style={styles.answersContainer}>
        {currentQuestion.alternativas.map((answer, index) => (
          <TouchableOpacity
            key={index}
            style={getAnswerStyle(answer)}
            onPress={() => handleAnswerSelect(answer)}
            disabled={!!selectedAnswer}
          >
            <Text style={styles.answerText}>{answer}</Text>
            {selectedAnswer && answer === selectedAnswer && (
              <Ionicons
                name={answer === currentQuestion.respostaCorreta ? "checkmark-circle" : "close-circle"}
                size={24}
                color={answer === currentQuestion.respostaCorreta ? "#4CAF50" : "#f44336"}
              />
            )}
            {selectedAnswer && selectedAnswer !== currentQuestion.respostaCorreta && answer === currentQuestion.respostaCorreta && (
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
  },
  progressText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  timerContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  timerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f8ff',
    borderWidth: 3,
    borderColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  timerText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  timerProgress: {
    height: 4,
    backgroundColor: '#2196F3',
    borderRadius: 2,
  },
  questionContainer: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  questionText: {
    fontSize: 18,
    color: '#333',
    lineHeight: 26,
    textAlign: 'center',
  },
  answersContainer: {
    flex: 1,
    padding: 20,
  },
  answerButton: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  answerButtonCorrect: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  answerButtonWrong: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  answerButtonDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    opacity: 0.6,
  },
  answerText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  resultContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
    textAlign: 'center',
  },
  scoreCard: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  percentageText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
  },
  messageText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 40,
  },
  statItem: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 10,
    flex: 1,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  resultButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  restartButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  finishButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});