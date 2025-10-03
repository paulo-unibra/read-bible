import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Colors } from "../constants/theme";
import AuthService from "../services/AuthService";
import QuizService, {
    Quiz,
    QuizResult,
    QuizSession,
} from "../services/QuizService";
import RankingService from "../services/RankingService";

export default function QuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const navTheme = useTheme();
  const colorScheme = navTheme.dark ? "dark" : "light";
  const theme = Colors[colorScheme];

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
  const [rankingRegistered, setRankingRegistered] = useState(false);

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

      console.log("Quiz loaded:");

      // Corrigir shuffle: manter array, não transformar em objeto
      const shuffled: Quiz = {
        ...quizData,
        questions: quizData.questions.map((q) => ({
          ...q,
          // clona antes de embaralhar para não mutar original
          alternativas: [...q.alternativas].sort(() => Math.random() - 0.9),
        })),
      };

      setSession(QuizService.createQuizSession(shuffled));
      setQuestionStartTime(Date.now());
    } catch (error) {
      console.error("Error loading quiz:", error);
      Alert.alert("Erro", "Não foi possível carregar o questionário", [
        { text: "OK", onPress: () => router.back() },
      ]);
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
              const cq =
                currentSession.quiz.questions[
                  currentSession.currentQuestionIndex
                ];
              const timeoutResult: QuizResult = {
                questionId: cq.id,
                pergunta: cq.pergunta,
                respostaEscolhida: "",
                respostaCorreta: cq.respostaCorreta,
                correct: false,
                timeSpent,
              };
              const isLast =
                currentSession.currentQuestionIndex ===
                currentSession.quiz.questions.length - 1;
              setSession((prev) =>
                prev
                  ? {
                      ...prev,
                      results: [...prev.results, timeoutResult],
                      isCompleted: isLast,
                    }
                  : prev
              );
              if (isLast) {
                setShowResult(true);
              } else {
                // avanço imediato em timeout (sem feedback)
                setSession((prev) =>
                  prev
                    ? {
                        ...prev,
                        currentQuestionIndex: prev.currentQuestionIndex + 1,
                      }
                    : prev
                );
                setSelectedAnswer(null);
                setTimeLeft(30);
                progressAnimation.setValue(0);
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
  }, [
    session?.currentQuestionIndex,
    showResult,
    selectedAnswer,
    progressAnimation,
    timerAnimation,
    session,
  ]);

  // Se a sessão marcou concluído mas ainda não trocou para resultado (evita frame com índice fora do array)
  useEffect(() => {
    if (session?.isCompleted && !showResult) {
      setShowResult(true);
    }
  }, [session?.isCompleted, showResult]);

  // Registrar entrada de ranking quando resultados mostrados
  useEffect(() => {
    if (showResult && session && !rankingRegistered) {
      const user = AuthService.getCurrentUser();
      if (user) {
        try {
          const score = QuizService.calculateScore(session);
          RankingService.addEntry({
            userId: (user as any).uid || 'no-id',
            bookId: bookId,
            chapter: chapterNumber,
            quizName: session.quiz.name,
            correct: score.correct,
            total: score.total,
            percentage: score.percentage,
            totalTimeMs: score.totalTime,
            averageTimeMs: score.averageTime,
          });
        } catch (e) {
          console.warn("Falha ao registrar ranking", e);
        }
      }
      setRankingRegistered(true);
    }
  }, [showResult, session, rankingRegistered, bookId, chapterNumber]);

  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer || !session) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const currentQuestion =
      session.quiz.questions[session.currentQuestionIndex];
    const timeSpent = Date.now() - questionStartTime;
    const isCorrect = answer === currentQuestion.respostaCorreta;

    const result: QuizResult = {
      questionId: currentQuestion.id,
      pergunta: currentQuestion.pergunta,
      respostaEscolhida: answer,
      respostaCorreta: currentQuestion.respostaCorreta,
      correct: isCorrect,
      timeSpent,
    };

    setSelectedAnswer(answer); // exibir feedback

    // Adiciona resultado sem avançar ainda
    setSession((prev) =>
      prev
        ? {
            ...prev,
            results: [...prev.results, result],
            isCompleted:
              prev.currentQuestionIndex === prev.quiz.questions.length - 1,
          }
        : prev
    );

    const isLast =
      session.currentQuestionIndex === session.quiz.questions.length - 1;

    setTimeout(() => {
      if (isLast) {
        setShowResult(true);
      } else {
        // Avança só agora
        setSession((prev) =>
          prev
            ? {
                ...prev,
                currentQuestionIndex: prev.currentQuestionIndex + 1,
              }
            : prev
        );
        nextQuestion();
      }
    }, 1000); // 1s de feedback
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
    if (!selectedAnswer || !session) return styles.answerButton;
    const currentQuestion =
      session.quiz.questions[session.currentQuestionIndex];
    if (answer === selectedAnswer) {
      return answer === currentQuestion.respostaCorreta
        ? styles.answerButtonCorrect
        : styles.answerButtonWrong;
    }
    if (
      selectedAnswer !== currentQuestion.respostaCorreta &&
      answer === currentQuestion.respostaCorreta
    ) {
      return styles.answerButtonCorrect;
    }
    return styles.answerButtonDisabled;
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.tint} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Carregando questionário...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!quiz || !session) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.centerContent}>
          <Text style={[styles.errorText, { color: "#f44336" }]}>
            Erro ao carregar questionário
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.tint }]}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (showResult) {
    const score = QuizService.calculateScore(session);
    const message = QuizService.getPerformanceMessage(score.percentage);
    const wrong = score.total - score.correct;

    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.fabBackButton,
            {
              top: insets.top + 8,
              backgroundColor: colorScheme === "dark" ? "#222" : "#ffffffee",
            },
          ]}
        >
          <Ionicons name="close" size={26} color={theme.tint} />
        </TouchableOpacity>

        <View style={styles.resultContainer}>
          <Text style={[styles.resultTitle, { color: theme.text }]}>
            {quiz.name}
          </Text>

          <View
            style={[
              styles.scoreCard,
              { backgroundColor: colorScheme === "dark" ? "#1e1e1e" : "#fff" },
            ]}
          >
            <Text style={[styles.scoreText, { color: theme.tint }]}>
              {score.correct}/{score.total}
            </Text>
            <Text style={[styles.percentageText, { color: theme.text }]}>
              {score.percentage}%
            </Text>
            <View style={styles.inlineResultCounts}>
              <Text style={styles.correctCount}>✔ {score.correct}</Text>
              <Text style={styles.wrongCount}>✖ {wrong}</Text>
            </View>
          </View>

          <Text style={[styles.messageText, { color: theme.text }]}>
            {message}
          </Text>

          <View style={styles.statsContainer}>
            <View
              style={{
                ...styles.statItem,
                backgroundColor: colorScheme === "dark" ? "#1e1e1e" : "#fff",
              }}
            >
              <Text style={[styles.statLabel, { color: theme.text }]}>
                Tempo Total
              </Text>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {Math.round(score.totalTime / 1000)}s
              </Text>
            </View>
            <View
              style={{
                ...styles.statItem,
                backgroundColor: colorScheme === "dark" ? "#1e1e1e" : "#fff",
              }}
            >
              <Text style={[styles.statLabel, { color: theme.text }]}>
                Tempo Médio
              </Text>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {Math.round(score.averageTime / 1000)}s
              </Text>
            </View>
          </View>

          <View style={styles.resultButtons}>
            <TouchableOpacity
              style={[styles.restartButton, { backgroundColor: "#FF9800" }]}
              onPress={restartQuiz}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.restartButtonText}>Refazer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.finishButton, { backgroundColor: "#4CAF50" }]}
              onPress={() => router.back()}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.finishButtonText}>Concluir</Text>
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 16 }}>
            <TouchableOpacity
              style={[styles.finishButton, { backgroundColor: "#2196F3" }]}
              onPress={() => router.push("/ranking")}
            >
              <Ionicons name="trophy" size={20} color="#fff" />
              <Text style={styles.finishButtonText}>Ranking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Proteger contra índice fora do intervalo enquanto estado visual troca
  const safeIndex = Math.min(
    session.currentQuestionIndex,
    Math.max(0, session.quiz.questions.length - 1)
  );
  const currentQuestion = session.quiz.questions[safeIndex];
  const correctCount = session.results.filter((r) => r.correct).length;
  const wrongCount = session.results.filter((r) => !r.correct).length;
  const progress =
    ((session.currentQuestionIndex + 1) / session.quiz.questions.length) * 100;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        style={[
          styles.fabBackButton,
          {
            top: insets.top + 8,
            backgroundColor: colorScheme === "dark" ? "#222" : "#ffffffee",
          },
        ]}
      >
        <Ionicons name="close" size={26} color={theme.tint} />
      </TouchableOpacity>

      {/* Progress Bar */}
      <View
        style={[
          styles.progressContainer,
          { paddingTop: insets.top + 56, backgroundColor: theme.background },
        ]}
      >
        <View style={styles.progressRow}>
          <Text
            style={[styles.quizTitle, { color: theme.text }]}
            numberOfLines={1}
          >
            {quiz.name}
          </Text>
          <View style={styles.inlineCounts}>
            <Text style={styles.correctCount}>✔ {correctCount}</Text>
            <Text style={styles.wrongCount}>✖ {wrongCount}</Text>
          </View>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%`, backgroundColor: theme.tint },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {session.currentQuestionIndex + 1} de {session.quiz.questions.length}
        </Text>
      </View>

      {/* Timer */}
      <View
        style={[styles.timerContainer, { backgroundColor: theme.background }]}
      >
        <Animated.View
          style={[
            styles.timerCircle,
            {
              transform: [{ scale: timerAnimation }],
              borderColor: theme.tint,
              backgroundColor: colorScheme === "dark" ? "#1f1f1f" : "#f0f8ff",
            },
          ]}
        >
          <Text
            style={[
              styles.timerText,
              { color: timeLeft <= 10 ? "#f44336" : theme.tint },
            ]}
          >
            {timeLeft}
          </Text>
        </Animated.View>
        <Animated.View
          style={[
            styles.timerProgress,
            {
              width: progressAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ["100%", "0%"],
              }),
            },
          ]}
        />
      </View>

      {/* Question */}
      <View
        style={[
          styles.questionContainer,
          { backgroundColor: colorScheme === "dark" ? "#1e1e1e" : "#fff" },
        ]}
      >
        <Text style={[styles.questionText, { color: theme.text }]}>
          {currentQuestion.pergunta}
        </Text>
      </View>

      {/* Answers */}
      <ScrollView
        style={styles.answersContainer}
        contentContainerStyle={[
          styles.answersContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {currentQuestion.alternativas.map((answer, index) => (
          <TouchableOpacity
            key={index}
            style={[
              getAnswerStyle(answer),
              !selectedAnswer && {
                backgroundColor: colorScheme === "dark" ? "#222" : "#fff",
                borderColor: colorScheme === "dark" ? "#333" : "#e0e0e0",
              },
            ]}
            onPress={() => handleAnswerSelect(answer)}
            disabled={!!selectedAnswer}
          >
            <Text style={[styles.answerText, { color: theme.text }]}>
              {answer}
            </Text>
            {selectedAnswer && answer === selectedAnswer && (
              <Ionicons
                name={
                  answer === currentQuestion.respostaCorreta
                    ? "checkmark-circle"
                    : "close-circle"
                }
                size={24}
                color={
                  answer === currentQuestion.respostaCorreta
                    ? "#4CAF50"
                    : "#f44336"
                }
              />
            )}
            {selectedAnswer &&
              selectedAnswer !== currentQuestion.respostaCorreta &&
              answer === currentQuestion.respostaCorreta && (
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  fabBackButton: {
    position: "absolute",
    left: 16,
    zIndex: 50,
    backgroundColor: "#ffffffee",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  placeholder: {
    width: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    fontSize: 16,
    color: "#f44336",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  progressContainer: {
    padding: 16,
    backgroundColor: "#fff",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 12,
  },
  quizTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  inlineCounts: {
    flexDirection: "row",
    gap: 12,
  },
  correctCount: {
    color: "#2e7d32",
    fontWeight: "600",
  },
  wrongCount: {
    color: "#c62828",
    fontWeight: "600",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2196F3",
  },
  progressText: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 14,
    color: "#666",
  },
  timerContainer: {
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    marginBottom: 20,
  },
  timerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f0f8ff",
    borderWidth: 3,
    borderColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  timerText: {
    fontSize: 24,
    fontWeight: "bold",
  },
  timerProgress: {
    height: 4,
    backgroundColor: "#2196F3",
    borderRadius: 2,
  },
  questionContainer: {
    padding: 20,
    backgroundColor: "#fff",
    marginBottom: 20,
  },
  questionText: {
    fontSize: 18,
    color: "#333",
    lineHeight: 26,
    textAlign: "center",
  },
  answersContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  answersContent: {
    paddingTop: 4,
  },
  inlineResultCounts: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
  },
  answerButton: {
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  answerButtonCorrect: {
    backgroundColor: "#e8f5e8",
    borderColor: "#4CAF50",
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  answerButtonWrong: {
    backgroundColor: "#ffebee",
    borderColor: "#f44336",
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  answerButtonDisabled: {
    backgroundColor: "#f5f5f5",
    borderColor: "#e0e0e0",
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    opacity: 0.6,
  },
  answerText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  resultContainer: {
    flex: 1,
    padding: 20,
    alignItems: "center",
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 30,
    textAlign: "center",
  },
  scoreCard: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#2196F3",
  },
  percentageText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#666",
    marginTop: 8,
  },
  messageText: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
  },
  statsContainer: {
    flexDirection: "row",
    marginBottom: 40,
  },
  statItem: {
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 10,
    flex: 1,
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  resultButtons: {
    flexDirection: "row",
    gap: 15,
  },
  restartButton: {
    backgroundColor: "#FF9800",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  restartButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  finishButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  finishButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
