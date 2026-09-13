import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FocusBottomNav, {
  FOCUS_BOTTOM_NAV_HEIGHT,
} from "../components/FocusBottomNav";
import authService from "../services/AuthService";
import readingPlanService from "../services/ReadingPlanService";
import { ReadingPlan, ReadingPlanDay } from "../types";

export default function ReadingPlansScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<ReadingPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ReadingPlan | null>(null);
  const [planDays, setPlanDays] = useState<ReadingPlanDay[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reload plans when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      checkAuthAndLoadPlans();
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const checkAuthAndLoadPlans = async () => {
    setIsLoading(true);
    try {
      await authService.init().catch(() => {});
      const authenticated = authService.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        await loadPlans();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const activePlans = await readingPlanService.getActivePlans();
      setPlans(activePlans);

      if (activePlans.length > 0) {
        const planToSelect =
          activePlans.find((plan) => plan.id === selectedPlan?.id) ||
          activePlans[0];
        await selectPlan(planToSelect);
      }
    } catch (error) {
      console.error("Error loading plans:", error);
      Alert.alert("Erro", "Falha ao carregar planos de leitura");
    }
  };

  const selectPlan = async (plan: ReadingPlan) => {
    try {
      setSelectedPlan(plan);
      const days = await readingPlanService.getPlanDays(plan.id);
      setPlanDays(days);
    } catch (error) {
      console.error("Error loading plan days:", error);
      Alert.alert("Erro", "Falha ao carregar dias do plano");
    }
  };

  const markDayAsCompleted = async (day: ReadingPlanDay) => {
    try {
      await readingPlanService.markDayAsCompleted(day.id);

      await loadPlans();

      Alert.alert("Parabéns!", "Leitura marcada como concluída! 🎉");
    } catch (error) {
      console.error("Error marking day as completed:", error);
      Alert.alert("Erro", "Falha ao marcar dia como concluído");
    }
  };

  const openDailyReading = (day: ReadingPlanDay) => {
    router.push({
      pathname: "/daily-reading",
      params: {
        readings: JSON.stringify(
          day.readings.map((reading) => ({
            id: Number(reading.id) || 0,
            day: day.dayNumber,
            bookName: reading.bookName,
            startChapter: reading.startChapter,
            endChapter: reading.endChapter,
            isCompleted: day.isCompleted,
          })),
        ),
        dayNumber: String(day.dayNumber),
        todayDayId: day.id,
        hasLocalPlan: "false",
      },
    });
  };

  const getTodayReading = () => {
    if (selectedPlan?.currentDay) {
      const currentDay = planDays.find(
        (day) => day.dayNumber === selectedPlan.currentDay,
      );

      if (currentDay) {
        return currentDay;
      }
    }

    return planDays.find((day) => !day.isCompleted);
  };

  const getReadingSummary = (day: ReadingPlanDay) =>
    day.readings
      .map(
        (reading) =>
          `${reading.bookName} ${reading.startChapter}${reading.endChapter !== reading.startChapter ? `-${reading.endChapter}` : ""}`,
      )
      .join(", ");

  const getChaptersCount = (day: ReadingPlanDay) =>
    day.readings.reduce(
      (sum, reading) => sum + reading.endChapter - reading.startChapter + 1,
      0,
    );

  const getCompletedChapters = () =>
    selectedPlan?.completedChapters ??
    planDays
      .filter((day) => day.isCompleted)
      .reduce((sum, day) => sum + getChaptersCount(day), 0);

  const getTotalChapters = () =>
    selectedPlan?.totalChapters ??
    planDays.reduce((sum, day) => sum + getChaptersCount(day), 0);

  const getProgressPercent = () => {
    const totalChapters = getTotalChapters();

    if (!totalChapters) {
      return 0;
    }

    return Math.round((getCompletedChapters() / totalChapters) * 100);
  };

  const getTestamentLabel = (day: ReadingPlanDay) => {
    const newTestamentBooks = new Set([
      "Mateus",
      "Marcos",
      "Lucas",
      "João",
      "Atos",
      "Romanos",
      "1 Coríntios",
      "2 Coríntios",
      "Gálatas",
      "Efésios",
      "Filipenses",
      "Colossenses",
      "1 Tessalonicenses",
      "2 Tessalonicenses",
      "1 Timóteo",
      "2 Timóteo",
      "Tito",
      "Filemom",
      "Hebreus",
      "Tiago",
      "1 Pedro",
      "2 Pedro",
      "1 João",
      "2 João",
      "3 João",
      "Judas",
      "Apocalipse",
    ]);

    const hasOldTestament = day.readings.some(
      (reading) => !newTestamentBooks.has(reading.bookName),
    );
    const hasNewTestament = day.readings.some((reading) =>
      newTestamentBooks.has(reading.bookName),
    );

    if (hasOldTestament && hasNewTestament) {
      return "Antigo e Novo Testamento";
    }

    return hasNewTestament ? "Novo Testamento" : "Antigo Testamento";
  };

  const renderTodayReading = (item: ReadingPlanDay) => {
    const completedChapters = getCompletedChapters();
    const totalChapters = getTotalChapters();
    const progressPercent = getProgressPercent();
    const progressWidth = `${Math.min(100, Math.max(0, progressPercent))}%`;
    const currentDay = selectedPlan?.currentDay || item.dayNumber;
    const totalDays = selectedPlan?.totalDays || 0;
    const remainingDays = Math.max(totalDays - currentDay, 0);
    const readingSummary = getReadingSummary(item);

    return (
      <>
        <View style={styles.todaySummaryRow}>
          <View>
            <Text style={styles.todayEyebrow}>Leitura de hoje</Text>
            <Text style={styles.todayDayLabel}>
              Dia {item.dayNumber} de {totalDays || "-"}
            </Text>
          </View>
          <View style={styles.statusPill}>
            <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
            <Text style={styles.statusPillText}>
              {item.isCompleted ? "Concluída" : "Em dia"}
            </Text>
          </View>
        </View>

        <View style={styles.readingCard}>
          <View style={styles.readingCardContent}>
            <View style={styles.readingIconBubble}>
              <Ionicons name="book-outline" size={22} color="#2196F3" />
            </View>
            <View style={styles.readingTextBlock}>
              <Text style={styles.readingMeta}>{getTestamentLabel(item)}</Text>
              <Text style={styles.readingTitle} numberOfLines={2}>
                {readingSummary}
              </Text>
              <Text style={styles.readingSubline}>
                {getChaptersCount(item)} capítulos para hoje
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => openDailyReading(item)}
          >
            <Text style={styles.primaryButtonText}>Ler agora</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>

          {!item.isCompleted ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => markDayAsCompleted(item)}
            >
              <View style={styles.radioCircle} />
              <Text style={styles.secondaryButtonText}>Marcar como lida</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.secondaryButton}>
              <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
              <Text style={styles.secondaryButtonText}>Leitura concluída</Text>
            </View>
          )}
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeaderRow}>
            <View>
              <Text style={styles.progressLabel}>Progresso do plano</Text>
              <Text style={styles.progressStrong}>
                {completedChapters} de {totalChapters.toLocaleString("pt-BR")}{" "}
                capítulos
              </Text>
            </View>
            <Text style={styles.progressPercent}>{progressPercent}%</Text>
          </View>
          <View style={styles.planProgressBar}>
            <View style={[styles.planProgressFill, { width: progressWidth }]} />
          </View>
          <View style={styles.progressFooterRow}>
            <Text style={styles.progressFooterText}>
              Iniciado há {currentDay} dias
            </Text>
            <Text style={styles.progressFooterText}>
              {remainingDays} dias restantes
            </Text>
          </View>
        </View>
      </>
    );
  };

  const todayReading = getTodayReading();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Plano de leitura</Text>
        </View>
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Carregando plano de leitura...</Text>
        </View>
        <FocusBottomNav active="plan" />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Plano de leitura</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="today-outline" size={64} color="#2196F3" />
          <Text style={styles.emptyTitle}>Entre para acessar seu plano</Text>
          <Text style={styles.emptyText}>
            Autentique-se para criar, acompanhar e sincronizar seu plano de
            leitura.
          </Text>
          <TouchableOpacity
            style={styles.createFirstPlanButton}
            onPress={() => router.push("/auth?mode=login")}
          >
            <Text style={styles.createFirstPlanButtonText}>Entrar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.createFirstPlanButton,
              { marginTop: 10, backgroundColor: "#4CAF50" },
            ]}
            onPress={() => router.push("/auth?mode=register")}
          >
            <Text style={styles.createFirstPlanButtonText}>Criar Conta</Text>
          </TouchableOpacity>
        </View>
        <FocusBottomNav active="plan" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Plano de leitura</Text>
        <TouchableOpacity
          onPress={() =>
            !plans.length ? router.push("/select-plan-template") : null
          }
          style={styles.addButton}
        >
          {plans.length === 0 ? (
            <Ionicons name="add" size={22} color="#2196F3" />
          ) : (
            <Ionicons name="add" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {plans.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Nenhum Plano Ativo</Text>
          <Text style={styles.emptyText}>
            Crie seu primeiro plano de leitura para começar
          </Text>
          <TouchableOpacity
            style={styles.createFirstPlanButton}
            onPress={() => router.push("/select-plan-template")}
          >
            <Text style={styles.createFirstPlanButtonText}>Criar Plano</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Today's Reading */}
          {todayReading && (
            <View style={styles.todaySection}>
              {renderTodayReading(todayReading)}
            </View>
          )}
        </ScrollView>
      )}

      <FocusBottomNav active="plan" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F8FB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 64,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#DEE6EE",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF6FF",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    paddingBottom: FOCUS_BOTTOM_NAV_HEIGHT + 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
  },
  createFirstPlanButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createFirstPlanButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingBottom: FOCUS_BOTTOM_NAV_HEIGHT + 20,
  },
  todaySection: {
    paddingHorizontal: 16,
    paddingTop: 25,
  },
  todaySummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  todayEyebrow: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 4,
  },
  todayDayLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "#EAF8EF",
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16A34A",
  },
  readingCard: {
    padding: 19,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#0F172A",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 27,
  },
  readingCardContent: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 20,
  },
  readingIconBubble: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF6FF",
  },
  readingTextBlock: {
    flex: 1,
  },
  readingMeta: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginBottom: 5,
  },
  readingTitle: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "500",
    color: "#0F172A",
    marginBottom: 5,
  },
  readingSubline: {
    fontSize: 12,
    color: "#64748B",
  },
  primaryButton: {
    height: 49,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 17,
    backgroundColor: "#1EA0E6",
    marginBottom: 16,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    height: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "transparent",
  },
  radioCircle: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.4,
    borderColor: "#64748B",
  },
  secondaryButtonText: {
    color: "#475569",
    fontSize: 15,
    fontWeight: "500",
  },
  progressCard: {
    backgroundColor: "transparent",
  },
  progressHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 3,
  },
  progressStrong: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  progressPercent: {
    fontSize: 22,
    fontWeight: "500",
    color: "#0EA5E9",
  },
  planProgressBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
    marginBottom: 12,
  },
  planProgressFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#1EA0E6",
  },
  progressFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressFooterText: {
    fontSize: 11,
    color: "#64748B",
  },
});
