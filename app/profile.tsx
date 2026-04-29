import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import authService, { API_URL } from "../services/AuthService";
import DatabaseService from "../services/DatabaseService";
import readingPlanService from "../services/ReadingPlanService";

interface UserStats {
  totalChaptersRead: number;
  totalQuizzesCompleted: number;
  currentStreak: number;
  longestStreak: number;
  readingStatus: "em-dia" | "atrasado" | "sem-plano";
  daysLate?: number;
  completedDays: number;
  totalDays: number;
  planProgress: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userProfilePicture, setUserProfilePicture] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showEditModal, setShowEditModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileImageLoadError, setProfileImageLoadError] = useState(false);
  const [profileImageUrlIndex, setProfileImageUrlIndex] = useState(0);
  const [fontSizePref, setFontSizePref] = useState<
    "small" | "medium" | "large"
  >("medium");

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    setProfileImageLoadError(false);
    setProfileImageUrlIndex(0);
  }, [userProfilePicture]);

  const loadProfile = async () => {
    try {
      setLoading(true);

      // Carregar dados do usuário
      const user = authService.getUser();
      if (user) {
        setUserName(user.name || "Usuário");
        setUserEmail(user.email || "");
        setNewName(user.name || "");
        setUserProfilePicture(user.profilePicture || null);
      }

      // Carregar configurações
      const settings = await DatabaseService.getMultipleSettings([
        "theme",
        "fontSize",
      ]);
      if (settings.theme) setTheme(settings.theme as "light" | "dark");
      if (settings.fontSize)
        setFontSizePref(settings.fontSize as "small" | "medium" | "large");

      // Carregar estatísticas
      await loadStats();
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      Alert.alert("Erro", "Falha ao carregar dados do perfil");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Tentar buscar do backend primeiro (se o usuário tem token)
      const token = authService.getToken();

      if (token) {
        console.log("Buscando estatísticas do backend...");
        const response = await authService.getStats();

        if (response.success && response.data) {
          console.log("Estatísticas do backend recebidas:", response.data);
          setStats(response.data);
          return;
        }
      }

      // Fallback para busca local se backend não disponível ou falhou
      console.log("Buscando estatísticas localmente...");

      // Buscar plano ativo
      const localPlans = await readingPlanService.getActivePlans();

      let userStats: UserStats = {
        totalChaptersRead: 0,
        totalQuizzesCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
        readingStatus: "sem-plano",
        completedDays: 0,
        totalDays: 0,
        planProgress: 0,
      };

      if (localPlans.length > 0) {
        const plan = localPlans[0];
        const planDays = await readingPlanService.getPlanDays(plan.id);

        // Calcular capítulos lidos
        const completedDays = planDays.filter((day) => day.isCompleted);
        const totalChaptersRead = completedDays.reduce((sum, day) => {
          return (
            sum +
            day.readings.reduce((chapterSum, reading) => {
              return (
                chapterSum + (reading.endChapter - reading.startChapter + 1)
              );
            }, 0)
          );
        }, 0);

        // Calcular total de capítulos
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

        // Calcular streak (sequência de dias consecutivos)
        const { currentStreak, longestStreak } = calculateStreaks(planDays);

        // Calcular status de leitura
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDateStr = plan.startDate.split("T")[0];
        const [year, month, day] = startDateStr.split("-").map(Number);
        const planStartDate = new Date(year, month - 1, day);
        planStartDate.setHours(0, 0, 0, 0);

        const daysPassed = Math.floor(
          (today.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        const expectedDayByDate = Math.min(daysPassed + 1, plan.totalDays);
        const isLate = plan.completedDays < expectedDayByDate - 1;
        const hasNotReadToday = plan.completedDays === expectedDayByDate - 1;
        const daysLate = isLate
          ? expectedDayByDate - 1 - plan.completedDays
          : 0;

        userStats = {
          ...userStats,
          totalChaptersRead,
          currentStreak,
          longestStreak,
          readingStatus: isLate ? "atrasado" : "em-dia",
          daysLate: isLate ? daysLate : undefined,
          completedDays: plan.completedDays,
          totalDays: plan.totalDays,
          planProgress: Math.round((plan.completedDays / plan.totalDays) * 100),
        };
      }

      // Buscar questionários completados
      const quizStats = await DatabaseService.getQuizStats();
      if (quizStats) {
        userStats.totalQuizzesCompleted = quizStats.completed || 0;
      }

      setStats(userStats);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
      Alert.alert("Erro", "Não foi possível carregar as estatísticas");
    }
  };

  const calculateStreaks = (planDays: any[]) => {
    // Ordenar por número do dia
    const sortedDays = [...planDays].sort((a, b) => a.dayNumber - b.dayNumber);

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < sortedDays.length; i++) {
      if (sortedDays[i].isCompleted) {
        tempStreak++;
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      } else {
        // Se chegou em um dia não completado, resetar streak temporário
        // mas guardar como currentStreak se for o último completado
        if (i === 0 || !sortedDays[i - 1].isCompleted) {
          tempStreak = 0;
        } else {
          currentStreak = tempStreak;
          tempStreak = 0;
        }
      }
    }

    // Se terminou com uma sequência, ela é a atual
    if (tempStreak > 0) {
      currentStreak = tempStreak;
    }

    return { currentStreak, longestStreak };
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      Alert.alert("Atenção", "Digite um nome válido");
      return;
    }

    try {
      setSaving(true);

      // Atualizar no serviço de autenticação
      await authService.updateUserName(newName.trim());

      setUserName(newName.trim());
      setShowEditModal(false);
      Alert.alert("Sucesso", "Nome atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar nome:", error);
      Alert.alert("Erro", "Não foi possível atualizar o nome");
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    Alert.alert("Foto de Perfil", "Escolha uma opção", [
      {
        text: "Câmera",
        onPress: () => openImageSource("camera"),
      },
      {
        text: "Galeria",
        onPress: () => openImageSource("library"),
      },
      ...(userProfilePicture
        ? [
            {
              text: "Remover foto",
              style: "destructive" as const,
              onPress: handleRemoveImage,
            },
          ]
        : []),
      { text: "Cancelar", style: "cancel" as const },
    ]);
  };

  const openImageSource = async (source: "camera" | "library") => {
    try {
      let permissionResult;

      if (source === "camera") {
        permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        permissionResult =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
      }

      if (!permissionResult.granted) {
        Alert.alert(
          "Permissão necessária",
          source === "camera"
            ? "Precisamos de acesso à câmera para tirar uma foto."
            : "Precisamos de acesso à galeria para selecionar uma foto.",
        );
        return;
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };

      let result;
      if (source === "camera") {
        result = await ImagePicker.launchCameraAsync(pickerOptions);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      }

      if (!result.canceled && result.assets[0]) {
        await handleUploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error("Erro ao abrir seletor de imagem:", error);
      Alert.alert("Erro", "Não foi possível abrir o seletor de imagens");
    }
  };

  const handleUploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setUploadingImage(true);

      const uri = asset.uri;
      const mimeType = asset.mimeType || "image/jpeg";
      const extension = uri.split(".").pop() || "jpg";
      const fileName = `profile_${Date.now()}.${extension}`;

      const result = await authService.uploadProfilePicture(
        uri,
        mimeType,
        fileName,
      );

      if (result.success && result.profilePicture) {
        setUserProfilePicture(result.profilePicture);
        const authUser = authService.getUser();
        if (authUser?.profilePicture) {
          setUserProfilePicture(authUser.profilePicture);
        }
        Alert.alert(
          "Sucesso",
          result.message || "Foto de perfil atualizada!",
        );
      } else {
        Alert.alert("Erro", result.message || "Não foi possível atualizar a foto");
      }
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      Alert.alert("Erro", "Falha ao enviar a imagem");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    try {
      setUploadingImage(true);
      const result = await authService.removeProfilePicture();
      if (result.success) {
        setUserProfilePicture(null);
        Alert.alert("Sucesso", result.message || "Foto de perfil removida!");
      } else {
        Alert.alert("Erro", result.message || "Não foi possível remover a foto");
      }
    } catch (error) {
      console.error("Erro ao remover foto:", error);
      Alert.alert("Erro", "Falha ao remover a imagem");
    } finally {
      setUploadingImage(false);
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
          router.replace("/");
        },
      },
    ]);
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

  const getProfilePictureUrls = () => {
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
    success: isDark ? "#81c784" : "#4CAF50",
    warning: isDark ? "#ffb74d" : "#FF9800",
    error: isDark ? "#e57373" : "#f44336",
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Carregando perfil...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const profilePictureUrls = getProfilePictureUrls();
  const profilePictureUrl = profilePictureUrls[profileImageUrlIndex] || null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.headerBg,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Meu Perfil
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Info Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          {/* Avatar com botão de edição de imagem */}
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={handlePickImage}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <View
                style={[
                  styles.avatarContainer,
                  { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : profilePictureUrl && !profileImageLoadError ? (
              <Image
                source={{ uri: profilePictureUrl }}
                style={[styles.avatarImage, { backgroundColor: colors.surfaceAlt }]}
                onError={() => {
                  if (profileImageUrlIndex < profilePictureUrls.length - 1) {
                    setProfileImageUrlIndex((prev) => prev + 1);
                    return;
                  }
                  setProfileImageLoadError(true);
                }}
              />
            ) : (
              <View
                style={[
                  styles.avatarContainer,
                  { backgroundColor: colors.accent },
                ]}
              >
                <Text style={styles.avatarText}>
                  {userName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.avatarEditBadge,
                { backgroundColor: colors.accent },
              ]}
            >
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            <Text
              style={[
                styles.profileName,
                { color: colors.textPrimary, fontSize: applyFontScale(24) },
              ]}
            >
              {userName}
            </Text>
            <Text
              style={[
                styles.profileEmail,
                { color: colors.textSecondary, fontSize: applyFontScale(14) },
              ]}
            >
              {userEmail}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => setShowEditModal(true)}
          >
            <Ionicons name="pencil" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Reading Status */}
        {stats && stats.readingStatus !== "sem-plano" && (
          <View style={[styles.statusCard, { backgroundColor: colors.card }]}>
            <View style={styles.statusHeader}>
              <Ionicons
                name={
                  stats.readingStatus === "em-dia"
                    ? "checkmark-circle"
                    : "alert-circle"
                }
                size={32}
                color={
                  stats.readingStatus === "em-dia"
                    ? colors.success
                    : colors.warning
                }
              />
              <View style={styles.statusTextContainer}>
                <Text
                  style={[
                    styles.statusTitle,
                    { color: colors.textPrimary, fontSize: applyFontScale(18) },
                  ]}
                >
                  {stats.readingStatus === "em-dia"
                    ? "Leitura em Dia!"
                    : "Leitura Atrasada"}
                </Text>
                <Text
                  style={[
                    styles.statusSubtitle,
                    {
                      color: colors.textSecondary,
                      fontSize: applyFontScale(14),
                    },
                  ]}
                >
                  {stats.readingStatus === "em-dia"
                    ? "Continue assim!"
                    : `${stats.daysLate} ${stats.daysLate === 1 ? "dia atrasado" : "dias atrasados"}`}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.progressBar,
                { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor:
                      stats.readingStatus === "em-dia"
                        ? colors.success
                        : colors.warning,
                    width: `${stats.planProgress}%`,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.progressText,
                { color: colors.textSecondary, fontSize: applyFontScale(12) },
              ]}
            >
              {stats.completedDays} de {stats.totalDays} dias concluídos (
              {stats.planProgress}%)
            </Text>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="book-outline" size={32} color={colors.accent} />
            <Text
              style={[
                styles.statValue,
                { color: colors.textPrimary, fontSize: applyFontScale(28) },
              ]}
            >
              {stats?.totalChaptersRead || 0}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: colors.textSecondary, fontSize: applyFontScale(14) },
              ]}
            >
              Capítulos Lidos
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons
              name="help-circle-outline"
              size={32}
              color={colors.success}
            />
            <Text
              style={[
                styles.statValue,
                { color: colors.textPrimary, fontSize: applyFontScale(28) },
              ]}
            >
              {stats?.totalQuizzesCompleted || 0}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: colors.textSecondary, fontSize: applyFontScale(14) },
              ]}
            >
              Questionários
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="flame-outline" size={32} color={colors.warning} />
            <Text
              style={[
                styles.statValue,
                { color: colors.textPrimary, fontSize: applyFontScale(28) },
              ]}
            >
              {stats?.currentStreak || 0}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: colors.textSecondary, fontSize: applyFontScale(14) },
              ]}
            >
              Sequência Atual
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="trophy-outline" size={32} color={colors.accent} />
            <Text
              style={[
                styles.statValue,
                { color: colors.textPrimary, fontSize: applyFontScale(28) },
              ]}
            >
              {stats?.longestStreak || 0}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: colors.textSecondary, fontSize: applyFontScale(14) },
              ]}
            >
              Maior Sequência
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text
              style={[
                styles.actionButtonText,
                { fontSize: applyFontScale(16) },
              ]}
            >
              Sair da Conta
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: colors.textPrimary, fontSize: applyFontScale(18) },
                ]}
              >
                Editar Nome
              </Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceAlt,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  fontSize: applyFontScale(16),
                },
              ]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Digite seu nome"
              placeholderTextColor={colors.textSecondary}
            />

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.accent }]}
              onPress={handleSaveName}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text
                    style={[
                      styles.saveButtonText,
                      { fontSize: applyFontScale(16) },
                    ]}
                  >
                    Salvar
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  profileCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  statusCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    textAlign: "center",
  },
  actionsSection: {
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
