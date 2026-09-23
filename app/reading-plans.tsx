import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AdBanner from "../components/AdBanner";
import FocusBottomNav, {
  FOCUS_BOTTOM_NAV_HEIGHT,
} from "../components/FocusBottomNav";
import authService, { API_URL } from "../services/AuthService";
import readingPlanService from "../services/ReadingPlanService";
import { ReadingPlan, ReadingPlanDay } from "../types";

export default function ReadingPlansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<ReadingPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ReadingPlan | null>(null);
  const [planDays, setPlanDays] = useState<ReadingPlanDay[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [userName, setUserName] = useState("");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [profileImageUrlIndex, setProfileImageUrlIndex] = useState(0);
  const [profileImageLoadError, setProfileImageLoadError] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [accountMenu, setAccountMenu] = useState<"account" | "photo" | "logout" | null>(null);

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
      const user = authService.getUser();
      setIsAuthenticated(authenticated);
      setUserName(
        authenticated ? user?.name?.trim().split(/\s+/)[0] || "Usuário" : "",
      );
      setProfilePicture(authenticated ? user?.profilePicture || null : null);
      setProfileImageUrlIndex(0);
      setProfileImageLoadError(false);
      if (authenticated) {
        await loadPlans();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const openImageSource = async (source: "camera" | "library") => {
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permissão necessária",
          source === "camera"
            ? "Precisamos de acesso à câmera para tirar uma foto."
            : "Precisamos de acesso à galeria para selecionar uma foto.",
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setIsUploadingPhoto(true);
      const extension = asset.uri.split(".").pop() || "jpg";
      const upload = await authService.uploadProfilePicture(
        asset.uri,
        asset.mimeType || "image/jpeg",
        `profile_${Date.now()}.${extension}`,
      );
      if (!upload.success) {
        Alert.alert(
          "Erro",
          upload.message || "Não foi possível atualizar a foto",
        );
        return;
      }
      setProfilePicture(
        authService.getUser()?.profilePicture || upload.profilePicture || null,
      );
      setProfileImageUrlIndex(0);
      setProfileImageLoadError(false);
    } catch (error) {
      console.error("Erro ao atualizar foto de perfil:", error);
      Alert.alert("Erro", "Não foi possível atualizar a foto de perfil");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleAvatarPress = () => {
    if (!isAuthenticated) {
      router.push("/auth?mode=login");
      return;
    }
    setAccountMenu("account");
  };

  const handleLogout = async () => {
    setAccountMenu(null);
    setIsLoading(true);
    try {
      await authService.logout();
      setIsAuthenticated(false);
      setUserName("");
      setProfilePicture(null);
      setPlans([]);
      setSelectedPlan(null);
      setPlanDays([]);
      router.replace("/?tab=bible");
    } catch (error) {
      console.error("Erro ao sair da conta:", error);
      Alert.alert("Erro", "Não foi possível sair da conta");
    } finally {
      setIsLoading(false);
    }
  };

  const getProfilePictureUrls = () => {
    if (!profilePicture) return [];
    if (/^(https?:|file:|content:|asset:|data:image)/.test(profilePicture)) {
      return [profilePicture];
    }
    const apiBaseUrl = API_URL.replace(/\/+$/, "");
    const originBaseUrl = apiBaseUrl.replace(/\/api$/, "");
    const path = profilePicture.startsWith("/")
      ? profilePicture
      : `/${profilePicture}`;
    const normalizedPath = path.replace(/^\/api\//, "/");
    if (normalizedPath.startsWith("/uploads/")) {
      return Array.from(
        new Set([
          `${apiBaseUrl}${normalizedPath}`,
          `${originBaseUrl}${normalizedPath}`,
        ]),
      );
    }
    return [`${apiBaseUrl}${path}`];
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
    if (isMarkingComplete) return;
    setIsMarkingComplete(true);
    try {
      await readingPlanService.markDayAsCompleted(day.id);

      await loadPlans();

      Alert.alert("Parabéns!", "Leitura marcada como concluída! 🎉");
    } catch (error) {
      console.error("Error marking day as completed:", error);
      Alert.alert("Erro", "Falha ao marcar dia como concluído");
    } finally {
      setIsMarkingComplete(false);
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

  const renderTodayReading = (item: ReadingPlanDay) => {
    const completedChapters = getCompletedChapters();
    const totalChapters = getTotalChapters();
    const progressPercent = getProgressPercent();
    const progressWidth =
      `${Math.min(100, Math.max(0, progressPercent))}%` as const;
    const totalDays = selectedPlan?.totalDays || 0;
    const readingSummary = getReadingSummary(item);

    return (
      <View style={styles.readingCard}>
        <View style={styles.todaySummaryRow}>
          <Text style={styles.todayDayLabel}>
            Leitura de Hoje - Dia {item.dayNumber}/{totalDays || "-"}
          </Text>
          <View style={styles.statusPill}>
            <Ionicons name="checkmark-circle" size={18} color="#43A047" />
            <Text style={styles.statusPillText}>
              {item.isCompleted ? "Concluída" : "Em dia"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.readingLink}
          onPress={() => openDailyReading(item)}
          accessibilityRole="button"
          accessibilityLabel={`Ler ${readingSummary}`}
        >
          <Text style={styles.readingTitle} numberOfLines={2}>
            {readingSummary}
          </Text>
          <Ionicons name="arrow-forward" size={24} color="#248BE0" />
        </TouchableOpacity>

        <Text style={styles.progressLabel}>
          Progresso: {completedChapters}/{totalChapters} capítulos (
          {progressPercent}%)
        </Text>
        <View style={styles.planProgressBar}>
          <View style={[styles.planProgressFill, { width: progressWidth }]} />
        </View>

        {item.isCompleted ? (
          <View style={[styles.completeButton, styles.completedButton]}>
            <Ionicons name="checkmark-circle" size={21} color="#fff" />
            <Text style={styles.completeButtonText}>Leitura concluída</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => markDayAsCompleted(item)}
            disabled={isMarkingComplete}
            accessibilityRole="button"
          >
            <Ionicons name="checkmark-circle" size={21} color="#fff" />
            <Text style={styles.completeButtonText}>
              {isMarkingComplete ? "Marcando..." : "Marcar como Lida"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const todayReading = getTodayReading();
  const profilePictureUrls = getProfilePictureUrls();
  const profilePictureUrl = profilePictureUrls[profileImageUrlIndex];
  const handleProfileImageError = () => {
    if (profileImageUrlIndex < profilePictureUrls.length - 1) {
      setProfileImageUrlIndex((index) => index + 1);
    } else {
      setProfileImageLoadError(true);
    }
  };

  const chooseImageSource = (source: "camera" | "library") => {
    setAccountMenu(null);
    setTimeout(() => { void openImageSource(source); }, 250);
  };

  const renderMenuOption = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    subtitle: string,
    onPress: () => void,
    destructive = false,
  ) => (
    <TouchableOpacity
      style={styles.menuOption}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[styles.menuOptionIcon, destructive && styles.menuDangerIcon]}>
        <Ionicons name={icon} size={22} color={destructive ? "#D64545" : "#248BE0"} />
      </View>
      <View style={styles.menuOptionText}>
        <Text style={[styles.menuOptionTitle, destructive && styles.menuDangerText]}>{title}</Text>
        <Text style={styles.menuOptionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </TouchableOpacity>
  );

  const renderAccountMenu = () => (
    <Modal
      transparent
      animationType="fade"
      visible={accountMenu !== null}
      onRequestClose={() => setAccountMenu(null)}
    >
      <View style={styles.menuOverlay}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => setAccountMenu(null)}
          accessibilityLabel="Fechar opções da conta"
        />
        <View style={[styles.menuSheet, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
          <View style={styles.menuHandle} />
          <View style={styles.menuHeading}>
            <View style={styles.menuAvatar}>
              {accountMenu === "account" && profilePictureUrl && !profileImageLoadError ? (
                <Image
                  source={{ uri: profilePictureUrl }}
                  style={styles.menuAvatarImage}
                  onError={handleProfileImageError}
                />
              ) : (
                <Ionicons
                  name={accountMenu === "photo" ? "camera-outline" : accountMenu === "logout" ? "log-out-outline" : "person-circle-outline"}
                  size={32}
                  color="#248BE0"
                />
              )}
            </View>
            <View style={styles.menuHeadingText}>
              <Text style={styles.menuTitle}>
                {accountMenu === "photo" ? "Alterar foto" : accountMenu === "logout" ? "Sair da conta?" : `Olá, ${userName}`}
              </Text>
              <Text style={styles.menuSubtitle}>
                {accountMenu === "photo"
                  ? "Escolha como deseja atualizar sua foto"
                  : accountMenu === "logout"
                    ? "Você poderá entrar novamente quando quiser."
                    : "Gerencie sua conta"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.menuClose}
              onPress={() => setAccountMenu(null)}
              accessibilityLabel="Fechar menu"
            >
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {accountMenu === "account" && (
            <View style={styles.menuOptions}>
              {renderMenuOption("camera-outline", "Alterar foto", "Câmera ou galeria", () => setAccountMenu("photo"))}
              {renderMenuOption("log-out-outline", "Sair", "Encerrar sessão neste aparelho", () => setAccountMenu("logout"), true)}
            </View>
          )}
          {accountMenu === "photo" && (
            <View style={styles.menuOptions}>
              {renderMenuOption("camera-outline", "Câmera", "Tirar uma nova foto", () => chooseImageSource("camera"))}
              {renderMenuOption("images-outline", "Galeria", "Escolher uma foto existente", () => chooseImageSource("library"))}
              <TouchableOpacity style={styles.menuBack} onPress={() => setAccountMenu("account")}>
                <Text style={styles.menuBackText}>Voltar</Text>
              </TouchableOpacity>
            </View>
          )}
          {accountMenu === "logout" && (
            <View style={styles.menuConfirmActions}>
              <TouchableOpacity
                style={styles.menuCancelButton}
                onPress={() => setAccountMenu("account")}
              >
                <Text style={styles.menuBackText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuLogoutButton} onPress={handleLogout}>
                <Text style={styles.menuLogoutText}>Sair da conta</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerGreeting}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isLoading
            ? "Plano de leitura"
            : isAuthenticated
              ? `Olá, ${userName}`
              : "Olá!"}
        </Text>
        {!isLoading && (
          <Text style={styles.headerSubtitle}>Plano de leitura</Text>
        )}
      </View>
      <View style={styles.headerActions}>
        {!isLoading && isAuthenticated && plans.length === 0 && (
          <TouchableOpacity
            onPress={() => router.push("/select-plan-template")}
            style={styles.addButton}
            accessibilityLabel="Criar plano de leitura"
          >
            <Ionicons name="add" size={22} color="#2196F3" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleAvatarPress}
          disabled={isLoading || isUploadingPhoto}
          style={styles.avatarButton}
          accessibilityRole="button"
          accessibilityLabel={
            isAuthenticated ? "Opções da conta" : "Entrar na conta"
          }
        >
          {isUploadingPhoto ? (
            <ActivityIndicator size="small" color="#2196F3" />
          ) : profilePictureUrl && !profileImageLoadError ? (
            <Image
              source={{ uri: profilePictureUrl }}
              style={styles.avatarImage}
              onError={handleProfileImageError}
            />
          ) : (
            <Ionicons name="person-circle-outline" size={38} color="#64748B" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <AdBanner />
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
        {renderHeader()}
        <AdBanner />

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.welcomeContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeIconWrap}>
              <Ionicons name="book-outline" size={42} color="#248BE0" />
              <View style={styles.welcomeIconBadge}>
                <Ionicons name="checkmark" size={17} color="#fff" />
              </View>
            </View>

            <Text style={styles.welcomeEyebrow}>SUA JORNADA DE LEITURA</Text>
            <View style={styles.welcomeBenefits}>
              <View style={styles.welcomeBenefitRow}>
                <Ionicons name="calendar-outline" size={20} color="#248BE0" />
                <Text style={styles.welcomeBenefitText}>
                  Leituras diárias no seu ritmo
                </Text>
              </View>
              <View style={styles.welcomeBenefitRow}>
                <Ionicons
                  name="trending-up-outline"
                  size={20}
                  color="#248BE0"
                />
                <Text style={styles.welcomeBenefitText}>
                  Seu progresso sempre à mão
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.welcomePrimaryButton}
              onPress={() => router.push("/auth?mode=login")}
              accessibilityRole="button"
            >
              <Text style={styles.welcomePrimaryText}>Entrar</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.welcomeSecondaryButton}
              onPress={() => router.push("/auth?mode=register")}
              accessibilityRole="button"
            >
              <Text style={styles.welcomeSecondaryText}>Criar conta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <FocusBottomNav active="plan" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <AdBanner />

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
          <View style={styles.modeSection}>
            <Text style={styles.modeTitle}>Modo de Leitura</Text>
            <TouchableOpacity
              style={styles.modeCard}
              onPress={() => router.push("/?tab=bible")}
              accessibilityRole="button"
            >
              <View style={styles.modeIcon}>
                <Ionicons name="book-outline" size={30} color="#248BE0" />
              </View>
              <View style={styles.modeDescription}>
                <Text style={styles.modeCardTitle}>Bíblia</Text>
                <Text style={styles.modeSubtitle}>
                  Leia livros, capítulos e versículos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#888" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <FocusBottomNav active="plan" />
      {renderAccountMenu()}
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
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#DEE6EE",
  },
  headerGreeting: { flex: 1, marginRight: 12 },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  headerSubtitle: { fontSize: 13, color: "#64748B", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F2F3F4",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  menuOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  menuSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  menuHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 24,
  },
  menuHeading: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 22 },
  menuAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EAF5FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  menuAvatarImage: { width: 52, height: 52, borderRadius: 26 },
  menuHeadingText: { flex: 1 },
  menuTitle: { fontSize: 19, fontWeight: "700", color: "#172638" },
  menuSubtitle: { fontSize: 13, color: "#64748B", marginTop: 3 },
  menuClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  menuOptions: { gap: 10 },
  menuOption: {
    minHeight: 70,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#EDF1F5",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
  },
  menuOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#EAF5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  menuDangerIcon: { backgroundColor: "#FDEDED" },
  menuOptionText: { flex: 1 },
  menuOptionTitle: { fontSize: 15, fontWeight: "700", color: "#172638" },
  menuOptionSubtitle: { fontSize: 12, color: "#64748B", marginTop: 3 },
  menuDangerText: { color: "#D64545" },
  menuBack: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  menuBackText: { fontSize: 15, fontWeight: "600", color: "#475569" },
  menuConfirmActions: { flexDirection: "row", gap: 12 },
  menuCancelButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  menuLogoutButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#D64545",
    alignItems: "center",
    justifyContent: "center",
  },
  menuLogoutText: { fontSize: 15, fontWeight: "700", color: "#fff" },
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
  welcomeContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: FOCUS_BOTTOM_NAV_HEIGHT + 24,
  },
  welcomeCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E6EDF5",
    padding: 24,
    alignItems: "center",
    shadowColor: "#163B65",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  welcomeIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#EAF5FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  welcomeIconBadge: {
    position: "absolute",
    right: 2,
    bottom: 3,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#43A047",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    color: "#248BE0",
    textAlign: "center",
    marginBottom: 10,
  },
  welcomeTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    color: "#172638",
    textAlign: "center",
  },
  welcomeDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: "#64748B",
    textAlign: "center",
    marginTop: 12,
  },
  welcomeBenefits: {
    width: "100%",
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: "#EDF1F5",
    marginTop: 24,
    paddingTop: 22,
    marginBottom: 26,
  },
  welcomeBenefitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  welcomeBenefitText: { flex: 1, fontSize: 14, color: "#475569" },
  welcomePrimaryButton: {
    width: "100%",
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: "#248BE0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  welcomePrimaryText: { fontSize: 17, fontWeight: "700", color: "#fff" },
  welcomeSecondaryButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CFE4F8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  welcomeSecondaryText: { fontSize: 16, fontWeight: "600", color: "#248BE0" },
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
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  todayDayLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    flexShrink: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F2F3F4",
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#43A047",
  },
  readingCard: {
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#248BE0",
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.13,
    shadowRadius: 8,
    elevation: 5,
  },
  readingLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 48,
    marginBottom: 10,
  },
  readingTitle: {
    flex: 1,
    fontSize: 19,
    color: "#666",
  },
  progressLabel: {
    fontSize: 15,
    color: "#666",
    marginBottom: 9,
  },
  planProgressBar: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "#DFE1E3",
    overflow: "hidden",
    marginBottom: 18,
  },
  planProgressFill: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "#43A047",
  },
  completeButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 10,
    backgroundColor: "#248BE0",
  },
  completedButton: { backgroundColor: "#43A047" },
  completeButtonText: { fontSize: 17, fontWeight: "700", color: "#fff" },
  modeSection: { paddingHorizontal: 16, paddingTop: 36 },
  modeTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    marginBottom: 18,
  },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    minHeight: 86,
    borderRadius: 16,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  modeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F3F4",
  },
  modeDescription: { flex: 1 },
  modeCardTitle: { fontSize: 19, fontWeight: "700", color: "#333" },
  modeSubtitle: { fontSize: 14, color: "#666", marginTop: 4 },
});
