import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AdBanner from "../components/AdBanner";
import BibleCuriosityCard from "../components/BibleCuriosityCard";
import { Logo } from "../components/logo";
import authService, {
  API_URL,
  ReadingPlan,
  TodayReading,
} from "../services/AuthService";
import bibleCuriosityService, {
  BibleCuriosity,
} from "../services/BibleCuriosityService";
import bibleReaderService from "../services/BibleReaderService";
import DatabaseService from "../services/DatabaseService";
import pdfExportService from "../services/PdfExportService";
import readingPlanService from "../services/ReadingPlanService";
import { Book } from "../types";

export default function HomeScreen() {
  const params = useLocalSearchParams();
  const [readingPlan, setReadingPlan] = useState<ReadingPlan | null>(null);
  const [todayReadings, setTodayReadings] = useState<TodayReading[]>([]);
  const [todayDayId, setTodayDayId] = useState<string | null>(null);
  const [curiosity, setCuriosity] = useState<BibleCuriosity | null>(null);
  const [loading, setLoading] = useState(true);
  const [fontSizePref, setFontSizePref] = useState<
    "small" | "medium" | "large"
  >("medium");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [userProfilePicture, setUserProfilePicture] = useState<string | null>(
    null,
  );
  const [profileImageLoadError, setProfileImageLoadError] = useState(false);
  const [headerImageUrlIndex, setHeaderImageUrlIndex] = useState(0);
  const [hasLocalPlan, setHasLocalPlan] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    setProfileImageLoadError(false);
    setHeaderImageUrlIndex(0);
  }, [userProfilePicture]);

  useEffect(() => {
    initializeApp();

    // // Verificar conexão de internet
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Mostrar mensagem se veio dos params
  useEffect(() => {
    if (params.message && typeof params.message === "string") {
      Alert.alert("Login Necessário", params.message);
    }
  }, [params.message]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          const settings = await DatabaseService.getMultipleSettings([
            "fontSize",
            "theme",
          ]);
          const userFont = settings.fontSize as
            | "small"
            | "medium"
            | "large"
            | null;
          const userTheme = settings.theme as "light" | "dark" | null;
          if (mounted) {
            if (userFont) setFontSizePref(userFont);
            if (userTheme) setTheme(userTheme);

            const authenticated = authService.isAuthenticated();
            const user = authService.getUser();
            setIsAuthenticated(authenticated);
            if (authenticated && user) {
              if (user.name) setUserName(user.name.split(" ")[0]);
              setUserProfilePicture(user.profilePicture || null);
            } else {
              setUserName("");
              setUserProfilePicture(null);
            }

            // Recarregar plano de leitura
            loadReadingPlan();
          }
        } catch {}
      })();
      return () => {
        mounted = false;
      };
    }, []),
  );

  const initializeApp = async () => {
    try {
      await DatabaseService.init();
      // Notificações removidas - não compatível com Expo Go SDK 53+
      // await notificationService.requestPermissions();
      await authService.init();

      setIsAuthenticated(authService.isAuthenticated());

      // Carregar nome do usuário se autenticado
      if (authService.isAuthenticated()) {
        const user = authService.getUser();
        if (user?.name) {
          setUserName(user.name.split(" ")[0]);
        }
        setUserProfilePicture(user?.profilePicture || null);
        await loadReadingPlan();
      }

      // Carregar curiosidade do dia
      await loadCuriosity();

      const settings = await DatabaseService.getMultipleSettings([
        "fontSize",
        "theme",
      ]);
      const userFont = settings.fontSize as "small" | "medium" | "large" | null;
      const userTheme = settings.theme as "light" | "dark" | null;
      if (userFont) setFontSizePref(userFont);
      if (userTheme) setTheme(userTheme);
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Falha ao inicializar o aplicativo");
    } finally {
      setLoading(false);
    }
  };

  const loadReadingPlan = async () => {
    try {
      console.log("=== LOAD READING PLAN START ===");
      // Primeiro busca planos locais (templates customizados tem prioridade)
      const localPlans = await readingPlanService.getActivePlans();
      console.log("Local plans found:", localPlans.length);
      if (localPlans.length > 0) {
        console.log("Using local plan:", localPlans[0]);
        setHasLocalPlan(true);
        // Pega o primeiro plano ativo local
        const plan = localPlans[0];

        // Busca o próximo dia não concluído do plano
        const planDays = await readingPlanService.getPlanDays(plan.id);
        console.log("Plan days retrieved:", planDays.length);

        // Busca o primeiro dia que NÃO está concluído (ordenado por número do dia)
        const nextDay = planDays
          .sort((a, b) => a.dayNumber - b.dayNumber)
          .find((day) => !day.isCompleted);

        console.log(
          "Next uncompleted day:",
          nextDay ? `Day ${nextDay.dayNumber}` : "None found",
        );

        // Calcular total de capítulos do plano
        const totalChapters = planDays.reduce((sum, day) => {
          return (
            sum +
            day.readings.reduce((chapterSum, reading) => {
              return (
                chapterSum + (reading.endChapter - reading.startChapter + 1)
              );
            }, 0)
          );
        }, 0);

        // Calcular capítulos completados
        const completedChapters = planDays
          .filter((day) => day.isCompleted)
          .reduce((sum, day) => {
            return (
              sum +
              day.readings.reduce((chapterSum, reading) => {
                return (
                  chapterSum + (reading.endChapter - reading.startChapter + 1)
                );
              }, 0)
            );
          }, 0);

        // Converte para o formato esperado pela tela
        const readingPlanData = {
          ...plan,
          currentDay: nextDay?.dayNumber || plan.totalDays,
          chaptersPerDay: 0,
          totalChapters,
          completedChapters,
          progress: Math.round((plan.completedDays / plan.totalDays) * 100),
        };

        console.log("Reading plan data prepared:", {
          currentDay: readingPlanData.currentDay,
          totalDays: readingPlanData.totalDays,
          totalChapters: readingPlanData.totalChapters,
          completedChapters: readingPlanData.completedChapters,
          progress: readingPlanData.progress,
          hasStartDate: !!readingPlanData.startDate,
          completedDays: readingPlanData.completedDays,
        });

        setReadingPlan(readingPlanData);

        // Converte readings para o formato esperado
        if (nextDay) {
          console.log("Setting today readings:", nextDay.readings);
          setTodayReadings(nextDay.readings);
          setTodayDayId(nextDay.id); // Guardar o ID do dia do plano

          // // readings pode ser string ou array, precisa lidar com ambos
          // const readingsText =
          //   typeof nextDay.readings === "string"
          //     ? nextDay.readings
          //     : Array.isArray(nextDay.readings)
          //     ? nextDay.readings
          //         .map(
          //           (r) =>
          //             `${r.bookName} ${r.startChapter}${
          //               r.endChapter !== r.startChapter
          //                 ? `-${r.endChapter}`
          //                 : ""
          //             }`
          //         )
          //         .join(" | ")
          //     : "";
        } else {
          // Se não há mais dias não concluídos, limpa as leituras
          console.log("No more uncompleted days - clearing readings");
          setTodayReadings([]);
          setTodayDayId(null);
        }
        console.log("=== LOCAL PLAN LOADED SUCCESSFULLY ===");
        return;
      }

      // Se não encontrou planos locais, busca do backend (sistema antigo - apenas para retrocompatibilidade)
      console.log("No local plans - trying backend API");
      const planResponse = await authService.getActivePlan();
      console.log("Backend plan response:", planResponse);

      if (planResponse.success && planResponse.data) {
        console.log("Backend plan data:", planResponse.data.plan);
        setReadingPlan(planResponse.data.plan);
        setHasLocalPlan(false);

        // Buscar TODAS as leituras do plano para encontrar a próxima não concluída
        const allReadingsResponse = await authService.getAllPlanReadings();
        console.log("All readings response:", allReadingsResponse);

        if (allReadingsResponse.success && allReadingsResponse.data) {
          console.log(
            "Total readings from backend:",
            allReadingsResponse.data.length,
          );
          // Encontra a primeira leitura não concluída
          const nextReadings = allReadingsResponse.data
            .filter((reading) => !reading.isCompleted)
            .sort((a, b) => a.day - b.day);

          console.log("Uncompleted readings found:", nextReadings.length);

          if (nextReadings.length > 0) {
            // Agrupar leituras do mesmo dia
            const firstDay = nextReadings[0].day;
            const todayReadings = nextReadings.filter(
              (r) => r.day === firstDay,
            );

            console.log("Próxima leitura não concluída (dia):", firstDay);
            console.log("Leituras do dia:", todayReadings);

            setTodayReadings(todayReadings);
          } else {
            // Todas as leituras foram concluídas
            console.log("Todas as leituras do plano foram concluídas!");
            setTodayReadings([]);
          }
        } else {
          console.log("Failed to get all readings - using fallback");
          // Fallback para o comportamento antigo se falhar
          setTodayReadings(planResponse.data.todayReadings);
        }

        setTodayDayId(null); // Backend não usa IDs locais
        console.log("=== BACKEND PLAN LOADED SUCCESSFULLY ===");
      } else {
        console.log("No backend plan found");
      }
    } catch (error) {
      console.error("=== ERROR LOADING PLAN ===", error);
    }
  };

  const loadCuriosity = async () => {
    try {
      const response = await bibleCuriosityService.getTodayCuriosity();
      if (response.success && response.data) {
        setCuriosity(response.data);
      }
    } catch (error) {
      console.error("Erro ao carregar curiosidade:", error);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja realmente sair da sua conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await authService.logout();
          setIsAuthenticated(false);
          setUserName("");
          setUserProfilePicture(null);
          setReadingPlan(null);
          setTodayReadings([]);
          Alert.alert("Sucesso", "Você saiu da sua conta.");
        },
      },
    ]);
  };

  const handleStartDailyReading = () => {
    if (!isAuthenticated) {
      Alert.alert(
        "Login Necessário",
        "Para usar a Leitura Diária, você precisa criar uma conta.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Criar Conta", onPress: () => router.push("/auth") },
        ],
      );
      return;
    }

    if (!readingPlan) {
      Alert.alert(
        "Criar Plano",
        "Você ainda não tem um plano de leitura. Deseja criar um agora?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Criar",
            onPress: () => router.push("/select-plan-template"),
          },
        ],
      );
      return;
    }

    // Ir para leitura do dia
    if (todayReadings) {
      // Aqui você pode navegar para a tela de leitura com os capítulos do dia
      // Alert.alert('Leitura do Dia', `${todayReading.bookName} ${todayReading.startChapter}${todayReading.endChapter !== todayReading.startChapter ? `-${todayReading.endChapter}` : ''}`);
      Alert;
    }
  };

  const handleMarkReadingComplete = async () => {
    if (!todayReadings.length || !readingPlan || markingComplete) return;

    try {
      setMarkingComplete(true);
      console.log("TESTE: ", todayReadings);

      // Se é um plano local (template)
      if (hasLocalPlan) {
        if (!todayDayId) {
          Alert.alert("Erro", "ID do dia não encontrado");
          setMarkingComplete(false);
          return;
        }
        await readingPlanService.markDayAsCompleted(todayDayId);
        await loadReadingPlan();

        // Alerta de parabéns após atualizar
        2;
        return;
      }

      // Se é plano do backend (padrão)
      const response = await authService.completeDay(todayReadings[0].day);
      if (response.success) {
        await loadReadingPlan();

        // Alerta de parabéns após atualizar
        // setTimeout(() => {
        //   Alert.alert(
        //     "🎉 Parabéns!",
        //     "Leitura marcada como concluída!\n\nContinue firme em sua jornada de leitura bíblica.",
        //     [
        //       {
        //         text: "Continuar",
        //         style: "default"
        //       }
        //     ]
        //   );
        // }, 300);
      } else {
        Alert.alert("Erro", response.message);
      }
    } catch (error) {
      console.log("Erro ao marcar leitura como completa:", error);
      Alert.alert("Erro", "Falha ao marcar leitura");
    } finally {
      setMarkingComplete(false);
    }
  };

  const startFreeReading = async () => {
    try {
      const bibles = await DatabaseService.getBibles();
      const downloadedBibles = bibles.filter((b) => b.isDownloaded);
      if (downloadedBibles.length === 0) {
        Alert.alert(
          "Nenhuma Bíblia Disponível",
          "Você precisa baixar pelo menos uma Bíblia.",
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Baixar Bíblias",
              onPress: () => router.push("/bible-manager"),
            },
          ],
        );
        return;
      }
      let lastReading = await DatabaseService.getLastReading();
      if (!lastReading) {
        const firstBible = downloadedBibles[0];
        let startBookId = 1;

        // Verificar se a Bíblia tem apenas NT (começar em Mateus)
        try {
          const books = await bibleReaderService.getBooks(firstBible.id);
          await bibleReaderService.openBible(
            firstBible.id,
            firstBible.fileName,
          );

          // Se não tem livros do AT, começar em Mateus
          const hasOldTestament = books.some(
            (book: Book) => book.testament === "old",
          );
          if (!hasOldTestament) {
            // Procurar por Mateus
            const matthew = books.find((book: Book) =>
              /Mateus|Matthew/i.test(book.name),
            );
            if (matthew) {
              startBookId = matthew.id;
            }
          }
        } catch (error) {
          console.warn("Erro ao verificar livros da Bíblia:", error);
        }

        lastReading = {
          bibleId: firstBible.id,
          bookId: startBookId,
          chapterNumber: 1,
        };
      }
      router.push(
        `/chapter-reader?bibleId=${lastReading.bibleId}&bookId=${lastReading.bookId}&chapterNumber=${lastReading.chapterNumber}`,
      );
    } catch {
      Alert.alert("Erro", "Falha ao abrir Bíblia");
    }
  };

  const applyFontScale = useCallback(
    (base: number) => {
      switch (fontSizePref) {
        case "small":
          return base * 0.9;
        case "large":
          return base * 1.2;
        default:
          return base;
      }
    },
    [fontSizePref],
  );

  const handleExportPlan = async () => {
    if (!readingPlan) {
      Alert.alert("Erro", "Nenhum plano de leitura disponível");
      return;
    }

    try {
      // Buscar todas as leituras do plano
      const response = await authService.getAllPlanReadings();

      if (!response.success || !response.data) {
        Alert.alert("Erro", "Não foi possível carregar os dados do plano");
        return;
      }

      await pdfExportService.exportPlan({
        plan: readingPlan,
        allReadings: response.data,
      });
    } catch (error) {
      Alert.alert("Erro", "Não foi possível exportar o plano");
      console.error("Erro ao exportar:", error);
    }
  };

  const getHeaderProfilePictureUrls = () => {
    if (!userProfilePicture) return [] as string[];

    if (
      userProfilePicture.startsWith("http") ||
      userProfilePicture.startsWith("file://") ||
      userProfilePicture.startsWith("content://") ||
      userProfilePicture.startsWith("asset://") ||
      userProfilePicture.startsWith("data:image")
    ) {
      return [userProfilePicture];
    }

    const apiBaseUrl = API_URL.replace(/\/+$/, "");
    const originBaseUrl = apiBaseUrl.replace(/\/api$/, "");
    const path = userProfilePicture.startsWith("/")
      ? userProfilePicture
      : `/${userProfilePicture}`;
    const normalizedPath = path.replace(/^\/api\//, "/");

    if (normalizedPath.startsWith("/uploads/")) {
      const urls = [
        `${apiBaseUrl}${normalizedPath}`,
        `${originBaseUrl}${normalizedPath}`,
      ];
      return Array.from(new Set(urls));
    }

    return [`${apiBaseUrl}${path}`];
  };

  const isDark = theme === "dark";
  const colors = {
    bg: isDark ? "#121212" : "#f5f5f5",
    headerBg: isDark ? "#1d1d1d" : "#fff",
    border: isDark ? "#2b2b2b" : "#e0e0e0",
    card: isDark ? "#1e1e1e" : "#fff",
    surfaceAlt: isDark ? "#2a2a2a" : "#f0f0f0",
    textPrimary: isDark ? "#e0e0e0" : "#333",
    textSecondary: isDark ? "#b0b0b0" : "#666",
    accent: isDark ? "#90caf9" : "#2196F3",
    primary: isDark ? "#90caf9" : "#2196F3",
    success: isDark ? "#81c784" : "#4CAF50",
    progressTrack: isDark ? "#2c2c2c" : "#e0e0e0",
    progressFill: "#4CAF50",
    iconMuted: isDark ? "#aaaaaa" : "#666",
    iconForward: isDark ? "#888" : "#999",
    emptyIcon: isDark ? "#555" : "#ccc",
  } as const;

  const headerProfilePictureUrls = getHeaderProfilePictureUrls();
  const headerProfilePictureUrl =
    headerProfilePictureUrls[headerImageUrlIndex] || null;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Carregando...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header fixo */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.headerBg,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={startFreeReading}>
          <Logo size={36} />
        </TouchableOpacity>

        {/* User greeting or login button */}
        {isAuthenticated ? (
          <TouchableOpacity
            style={styles.userGreeting}
            onPress={() => router.push("/profile")}
          >
            {headerProfilePictureUrl && !profileImageLoadError ? (
              <Image
                source={{ uri: headerProfilePictureUrl }}
                style={[
                  styles.userAvatar,
                  { backgroundColor: colors.surfaceAlt },
                ]}
                onError={() => {
                  if (headerImageUrlIndex < headerProfilePictureUrls.length - 1) {
                    setHeaderImageUrlIndex((prev) => prev + 1);
                    return;
                  }
                  setProfileImageLoadError(true);
                }}
              />
            ) : (
              <Ionicons
                name="person-circle-outline"
                size={20}
                color={colors.iconMuted}
                style={styles.userIcon}
              />
            )}
            <Text style={[styles.greetingText, { color: colors.textPrimary }]}> 
              Olá, {userName}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.iconMuted}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (isConnected) {
                router.push("/auth");
              } else {
                Alert.alert(
                  "Sem Conexão",
                  "Conecte-se à internet para entrar.",
                );
              }
            }}
          >
            <Text style={[styles.loginButtonText, { color: "#FFFFFF" }]}>
              Entrar
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.headerActions}>
          {/* {readingPlan && (
            <TouchableOpacity 
              style={styles.exportButton} 
              onPress={handleExportPlan}
            >
              <Ionicons name="download-outline" size={24} color={colors.iconMuted} />
            </TouchableOpacity>
          )} */}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push("/settings")}
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color={colors.iconMuted}
            />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Ad Banner */}
        <AdBanner />

        {/* Curiosidade Bíblica */}
        {curiosity && (
          <BibleCuriosityCard
            curiosity={curiosity}
            onFavoriteChange={loadCuriosity}
          />
        )}

        {/* Plano de Leitura */}
        {!isConnected ? (
          <View
            style={[
              styles.noReadingCard,
              {
                backgroundColor: colors.card,
                shadowOpacity: isDark ? 0.3 : 0.1,
              },
            ]}
          >
            <Ionicons
              name="cloud-offline-outline"
              size={48}
              color={colors.emptyIcon}
            />
            <Text
              style={[
                styles.noReadingTitle,
                { color: colors.textPrimary, fontSize: applyFontScale(18) },
              ]}
            >
              Sem Conexão
            </Text>
            <Text
              style={[
                styles.noReadingText,
                {
                  color: colors.textSecondary,
                  fontSize: applyFontScale(14),
                  lineHeight: applyFontScale(20),
                },
              ]}
            >
              Conecte-se à internet para visualizar o seu plano
            </Text>
          </View>
        ) : readingPlan && todayReadings.length ? (
          <View
            style={[
              styles.todayCard,
              {
                backgroundColor: colors.card,
                borderLeftColor: colors.accent,
                shadowOpacity: isDark ? 0.3 : 0.1,
              },
            ]}
          >
            <View style={styles.todayHeader}>
              <Text
                style={[
                  styles.todayTitle,
                  { color: colors.textPrimary, fontSize: applyFontScale(18) },
                ]}
              >
                Leitura de Hoje - Dia {readingPlan.currentDay}/
                {readingPlan.totalDays}
              </Text>
              {(() => {
                // Calcular status baseado nas leituras realmente concluídas
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Extrair apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
                const startDateStr = readingPlan.startDate.split("T")[0]; // "2026-01-01"
                const [year, month, day] = startDateStr.split("-").map(Number);
                const planStartDate = new Date(year, month - 1, day); // Mês é 0-indexed
                planStartDate.setHours(0, 0, 0, 0);

                console.log("=== STATUS BADGE CALCULATION ===");
                console.log("Today:", today.toISOString());
                console.log("Plan start date:", readingPlan.startDate);
                console.log(
                  "Plan start date parsed:",
                  planStartDate.toISOString(),
                );

                // Calcular quantos dias se passaram desde o início do plano
                const daysPassed = Math.floor(
                  (today.getTime() - planStartDate.getTime()) /
                    (1000 * 60 * 60 * 24),
                );

                console.log("Days passed:", daysPassed);

                // Contar quantas leituras foram realmente concluídas
                const completedDays = readingPlan.completedDays || 0;

                console.log("Completed days:", completedDays);
                console.log(
                  "Current day (next uncompleted):",
                  readingPlan.currentDay,
                );

                // Dia que DEVERIA estar baseado na data (quantos dias já se passaram)
                // Se começou dia 1/1 e hoje é 10/1, já se passaram 9 dias, então hoje é o dia 10
                const expectedDayByDate = Math.min(
                  daysPassed + 1,
                  readingPlan.totalDays,
                );

                console.log("Expected day by date:", expectedDayByDate);
                console.log("Total days in plan:", readingPlan.totalDays);

                // Calcular status:
                // - Se completou MENOS que o dia esperado - 1, está atrasado
                // - Se completou EXATAMENTE o dia esperado - 1, está pendente hoje
                // - Se completou IGUAL OU MAIS que o dia esperado, está em dia

                const isLate = completedDays < expectedDayByDate - 1;
                const hasNotReadToday = completedDays === expectedDayByDate - 1;
                const daysLate = isLate
                  ? expectedDayByDate - 1 - completedDays
                  : 0;

                console.log("Is late:", isLate);
                console.log("Has not read today:", hasNotReadToday);
                console.log("Days late:", daysLate);
                console.log(
                  "Calculation: completedDays =",
                  completedDays,
                  ", expectedDayByDate - 1 =",
                  expectedDayByDate - 1,
                );
                console.log("=== END STATUS CALCULATION ===");

                if (isLate) {
                  return (
                    <View style={styles.statusBadge}>
                      <Ionicons name="alert-circle" size={14} color="#FF9800" />
                      <Text style={[styles.statusText, { color: "#FF9800" }]}>
                        {daysLate}{" "}
                        {daysLate === 1 ? "dia atrasado" : "dias atrasados"}
                      </Text>
                    </View>
                  );
                } else if (hasNotReadToday) {
                  return (
                    <View style={styles.statusBadge}>
                      <Ionicons name="time-outline" size={14} color="#2196F3" />
                      <Text style={[styles.statusText, { color: "#2196F3" }]}>
                        Pendente hoje
                      </Text>
                    </View>
                  );
                } else {
                  return (
                    <View style={styles.statusBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color="#4CAF50"
                      />
                      <Text style={[styles.statusText, { color: "#4CAF50" }]}>
                        Em dia
                      </Text>
                    </View>
                  );
                }
              })()}
            </View>
            <TouchableOpacity
              style={styles.readingInfo}
              onPress={() => {
                router.push({
                  pathname: "/daily-reading",
                  params: {
                    readings: JSON.stringify(todayReadings),
                    hasLocalPlan: hasLocalPlan.toString(),
                    todayDayId: todayDayId || undefined,
                    dayNumber: todayReadings[0]?.day?.toString() || undefined,
                  },
                });
              }}
            >
              <View style={styles.readingTextContainer}>
                <Text
                  style={[
                    styles.readingText,
                    {
                      color: colors.textSecondary,
                      fontSize: applyFontScale(16),
                    },
                  ]}
                >
                  {todayReadings.map((reading, index) => (
                    <Text key={reading.id}>
                      {reading.bookName} {reading.startChapter}
                      {reading.endChapter !== reading.startChapter
                        ? `-${reading.endChapter}`
                        : ""}
                      {index < todayReadings.length - 1 ? ", " : ""}
                    </Text>
                  ))}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={colors.accent}
                  style={styles.readingArrow}
                />
              </View>
              <Text
                style={[
                  styles.readingProgress,
                  {
                    color: colors.textSecondary,
                    fontSize: applyFontScale(14),
                    marginTop: 8,
                  },
                ]}
              >
                Progresso: {readingPlan.completedChapters}/
                {readingPlan.totalChapters} capítulos ({readingPlan.progress}%)
              </Text>
              {/* Barra de progresso */}
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: colors.progressTrack, marginTop: 8 },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.progressFill,
                      width: `${readingPlan.progress}%`,
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
            {!todayReadings[0].isCompleted ? (
              <TouchableOpacity
                style={[
                  styles.completeButton,
                  markingComplete && { opacity: 0.7 },
                ]}
                onPress={handleMarkReadingComplete}
                disabled={markingComplete}
              >
                {markingComplete ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                )}
                <Text
                  style={[
                    styles.completeButtonText,
                    { fontSize: applyFontScale(16) },
                  ]}
                >
                  {markingComplete ? "Marcando..." : "Marcar como Lida"}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.completedBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.success}
                />
                <Text
                  style={[
                    styles.completedText,
                    { color: colors.success, fontSize: applyFontScale(16) },
                  ]}
                >
                  Concluída
                </Text>
              </View>
            )}
          </View>
        ) : isAuthenticated && readingPlan && !todayReadings.length ? (
          <View
            style={[
              styles.noReadingCard,
              {
                backgroundColor: colors.card,
                shadowOpacity: isDark ? 0.3 : 0.1,
              },
            ]}
          >
            <Ionicons
              name="checkmark-done-circle"
              size={48}
              color={colors.success}
            />
            <Text
              style={[
                styles.noReadingTitle,
                { color: colors.textPrimary, fontSize: applyFontScale(18) },
              ]}
            >
              Plano de Leitura Concluído!
            </Text>
            <Text
              style={[
                styles.noReadingText,
                {
                  color: colors.textSecondary,
                  fontSize: applyFontScale(14),
                  lineHeight: applyFontScale(20),
                },
              ]}
            >
              Parabéns por concluir seu plano de leitura. Clique aqui para
              visualizar seu certificado de conclusão.
            </Text>
          </View>
        ) : !isAuthenticated ? (
          <View
            style={[
              styles.noReadingCard,
              {
                backgroundColor: colors.card,
                shadowOpacity: isDark ? 0.3 : 0.1,
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={48}
              color={colors.emptyIcon}
            />
            <Text
              style={[
                styles.noReadingTitle,
                { color: colors.textPrimary, fontSize: applyFontScale(18) },
              ]}
            >
              Leitura Diária
            </Text>
            <Text
              style={[
                styles.noReadingText,
                {
                  color: colors.textSecondary,
                  fontSize: applyFontScale(14),
                  lineHeight: applyFontScale(20),
                },
              ]}
            >
              Crie uma conta para ter acesso ao plano de leitura anual da Bíblia
            </Text>
            <TouchableOpacity
              style={styles.createPlanButton}
              onPress={() => router.push("/auth?mode=register")}
            >
              <Text
                style={[
                  styles.createPlanButtonText,
                  { fontSize: applyFontScale(16) },
                ]}
              >
                Criar Conta
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={[
              styles.noReadingCard,
              {
                backgroundColor: colors.card,
                shadowOpacity: isDark ? 0.3 : 0.1,
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={48}
              color={colors.emptyIcon}
            />
            <Text
              style={[
                styles.noReadingTitle,
                { color: colors.textPrimary, fontSize: applyFontScale(18) },
              ]}
            >
              Sem plano de leitura
            </Text>
            <Text
              style={[
                styles.noReadingText,
                {
                  color: colors.textSecondary,
                  fontSize: applyFontScale(14),
                  lineHeight: applyFontScale(20),
                },
              ]}
            >
              Crie seu plano para ler toda a Bíblia até o fim do ano
            </Text>
            <TouchableOpacity
              style={styles.createPlanButton}
              onPress={() => router.push("/select-plan-template")}
            >
              <Text
                style={[
                  styles.createPlanButtonText,
                  { fontSize: applyFontScale(16) },
                ]}
              >
                Criar Plano
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionsSection}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.textPrimary, fontSize: applyFontScale(20) },
            ]}
          >
            Modo de Leitura
          </Text>

          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: colors.card,
                shadowOpacity: isDark ? 0.25 : 0.1,
              },
            ]}
            onPress={startFreeReading}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <Ionicons name="book-outline" size={32} color={colors.accent} />
            </View>
            <View style={styles.actionContent}>
              <Text
                style={[
                  styles.actionTitle,
                  { color: colors.textPrimary, fontSize: applyFontScale(18) },
                ]}
              >
                Bíblia
              </Text>
              <Text
                style={[
                  styles.actionDescription,
                  { color: colors.textSecondary, fontSize: applyFontScale(14) },
                ]}
              >
                Leia livros, capítulos e versículos
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.iconForward}
            />
          </TouchableOpacity>

          {/* Harpa Cristã */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: colors.card,
                shadowOpacity: isDark ? 0.25 : 0.1,
              },
            ]}
            onPress={() => router.push("/harpa")}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <Ionicons
                name="musical-notes-outline"
                size={32}
                color={isDark ? "#81c784" : "#4CAF50"}
              />
            </View>
            <View style={styles.actionContent}>
              <Text
                style={[
                  styles.actionTitle,
                  { color: colors.textPrimary, fontSize: applyFontScale(18) },
                ]}
              >
                Harpa Cristã
              </Text>
              <Text
                style={[
                  styles.actionDescription,
                  { color: colors.textSecondary, fontSize: applyFontScale(14) },
                ]}
              >
                640 hinos da Harpa Cristã
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.iconForward}
            />
          </TouchableOpacity>

          {isAuthenticated && readingPlan && (
            <TouchableOpacity
              style={[
                styles.actionCard,
                {
                  backgroundColor: colors.card,
                  shadowOpacity: isDark ? 0.25 : 0.1,
                },
              ]}
              onPress={() => router.push("/reading-history")}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={32}
                  color={isDark ? "#ffb74d" : "#FF9800"}
                />
              </View>
              <View style={styles.actionContent}>
                <Text
                  style={[
                    styles.actionTitle,
                    { color: colors.textPrimary, fontSize: applyFontScale(18) },
                  ]}
                >
                  Seu Plano de Leitura
                </Text>
                <Text
                  style={[
                    styles.actionDescription,
                    {
                      color: colors.textSecondary,
                      fontSize: applyFontScale(14),
                    },
                  ]}
                >
                  Histórico, próximas leituras e mais
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.iconForward}
              />
            </TouchableOpacity>
          )}

          {/* {isAuthenticated && (
            <TouchableOpacity
              style={[
                styles.actionCard,
                {
                  backgroundColor: colors.card,
                  shadowOpacity: isDark ? 0.25 : 0.1,
                },
              ]}
              onPress={() => router.push("/my-notes")}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={32}
                  color={isDark ? "#ba68c8" : "#9C27B0"}
                />
              </View>
              <View style={styles.actionContent}>
                <Text
                  style={[
                    styles.actionTitle,
                    { color: colors.textPrimary, fontSize: applyFontScale(18) },
                  ]}
                >
                  Minhas Anotações
                </Text>
                <Text
                  style={[
                    styles.actionDescription,
                    { color: colors.textSecondary, fontSize: applyFontScale(14) },
                  ]}
                >
                  Visualize suas anotações bíblicas
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.iconForward}
              />
            </TouchableOpacity>
          )} */}

          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: colors.card,
                shadowOpacity: isDark ? 0.25 : 0.1,
              },
            ]}
            onPress={() => router.push("/explore")}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <Ionicons
                name="compass-outline"
                size={32}
                color={isDark ? "#64b5f6" : "#1976D2"}
              />
            </View>
            <View style={styles.actionContent}>
              <Text
                style={[
                  styles.actionTitle,
                  { color: colors.textPrimary, fontSize: applyFontScale(18) },
                ]}
              >
                Explorar
              </Text>
              <Text
                style={[
                  styles.actionDescription,
                  { color: colors.textSecondary, fontSize: applyFontScale(14) },
                ]}
              >
                Estatísticas, dicas e estrutura bíblica
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.iconForward}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.actionsSection}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.textPrimary, fontSize: applyFontScale(20) },
            ]}
          >
            Gerenciar Bíblias
          </Text>
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: colors.card,
                shadowOpacity: isDark ? 0.25 : 0.1,
              },
            ]}
            onPress={() => {
              if (isConnected) {
                router.push("/bible-manager");
              } else {
                Alert.alert(
                  "Sem Conexão",
                  "Conecte-se à internet para gerenciar suas Bíblias.",
                );
              }
            }}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <Ionicons
                name="download-outline"
                size={32}
                color={isDark ? "#81c784" : "#4CAF50"}
              />
            </View>
            <View style={styles.actionContent}>
              <Text
                style={[
                  styles.actionTitle,
                  {
                    color: !isConnected ? colors.iconMuted : colors.textPrimary,
                    fontSize: applyFontScale(18),
                  },
                ]}
              >
                Baixar Bíblias
              </Text>
              <Text
                style={[
                  styles.actionDescription,
                  { color: colors.textSecondary, fontSize: applyFontScale(14) },
                ]}
              >
                Gerencie suas versões da Bíblia
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.iconForward}
            />
          </TouchableOpacity>
        </View>

        {/* Seção de planos ativos oculta enquanto a funcionalidade está em desenvolvimento */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  scrollView: { flex: 1 },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 18, color: "#666" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  userGreeting: { flexDirection: "row", alignItems: "center", gap: 6 },
  userIcon: { marginRight: 2 },
  userAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 2,
  },
  greetingText: { fontSize: 16, fontWeight: "500" },
  logoutButton: { marginLeft: 4, padding: 4 },
  loginButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  loginButtonText: { fontSize: 14, fontWeight: "600" },
  exportButton: { padding: 8 },
  settingsButton: { padding: 8 },
  todayCard: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  todayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  todayTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  readingInfo: { marginBottom: 16 },
  readingText: { fontSize: 16, color: "#666", marginBottom: 4 },
  completeButton: {
    backgroundColor: "#2196F3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  completeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  completedText: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  actionsSection: { padding: 16 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  actionCard: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  disabledCard: { opacity: 0.55 },
  actionIcon: {
    width: 56,
    height: 56,
    backgroundColor: "#f0f0f0",
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  actionContent: { flex: 1 },
  actionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  actionDescription: { fontSize: 14, color: "#666" },
  plansSection: { padding: 16 },
  planSummary: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  planName: { fontSize: 16, fontWeight: "600", color: "#333", marginBottom: 8 },
  planProgress: { fontSize: 14, color: "#666", marginBottom: 8 },
  progressBar: { height: 4, backgroundColor: "#e0e0e0", borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: "#4CAF50", borderRadius: 2 },
  noReadingCard: {
    backgroundColor: "#fff",
    padding: 24,
    margin: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  noReadingTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  noReadingText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  createPlanButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createPlanButtonDisabled: { backgroundColor: "#999", opacity: 0.6 },
  disabledButton: { backgroundColor: "#888" },
  createPlanButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  disabledButtonText: { color: "#eee" },
  disabledText: { opacity: 0.7 },
  readingProgress: { fontSize: 14, color: "#666", marginTop: 8 },
  readingTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  readingArrow: {
    marginLeft: 8,
  },
});
