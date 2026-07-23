import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../hooks/theme-context";
import bibleBrainService from "../services/BibleBrainService";
import DatabaseService from "../services/DatabaseService";
import googleDriveService from "../services/GoogleDriveService";
import { Bible, BibleBrainBible, DriveFile } from "../types";

type Tab = "drive" | "biblebrain";

export default function BibleManagerScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const theme = {
    background: colors.bg,
    card: colors.card,
    border: colors.border,
    text: colors.textPrimary,
    subText: colors.textSecondary,
    primary: colors.primary,
  };

  const [activeTab, setActiveTab] = useState<Tab>("drive");

  const [availableBibles, setAvailableBibles] = useState<DriveFile[]>([]);
  const [localBibles, setLocalBibles] = useState<Bible[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);

  const [bbBibles, setBbBibles] = useState<BibleBrainBible[]>([]);
  const [bbGenerating, setBbGenerating] = useState<Set<string>>(new Set());
  const [bbLoading, setBbLoading] = useState(false);
  const bbPollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    loadData();

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });

    return () => {
      unsubscribe();
      bbPollTimers.current.forEach((timer) => clearInterval(timer));
      bbPollTimers.current.clear();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  useEffect(() => {
    if (activeTab === "biblebrain") {
      loadBibleBrainBibles();
    }
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      await DatabaseService.init();

      const driveFiles = await googleDriveService.listBibleFiles();
      setAvailableBibles(driveFiles);

      const localBiblesData = await DatabaseService.getBibles();
      setLocalBibles(localBiblesData);
    } catch (error) {
      console.error("Error loading bible data:", error);
      Alert.alert("Erro", "Falha ao carregar dados das Bíblias");
    } finally {
      setLoading(false);
    }
  };

  const loadBibleBrainBibles = async () => {
    try {
      setBbLoading(true);
      const result = await bibleBrainService.listBibles({ perPage: 50 });
      const bibles = result.data;

      const generating = new Set<string>();
      for (const bible of bibles) {
        if (bible.packageStatus === "generating") {
          generating.add(bible.bibleId);
        }
      }
      setBbGenerating(generating);
      setBbBibles(bibles);

      generating.forEach((bibleId) => startBbPolling(bibleId));
    } catch (error) {
      console.error("Erro ao carregar bíblias BibleBrain:", error);
    } finally {
      setBbLoading(false);
    }
  };

  const startBbPolling = (bibleId: string) => {
    if (bbPollTimers.current.has(bibleId)) return;

    const timer = setInterval(async () => {
      try {
        const status = await bibleBrainService.packageStatus(bibleId);
        setBbBibles((prev) =>
          prev.map((b) => (b.bibleId === bibleId ? status : b)),
        );
        setBbGenerating((prev) => {
          const next = new Set(prev);
          if (status.packageStatus === "ready" || status.packageStatus === "failed") {
            next.delete(bibleId);
          }
          return next;
        });

        if (status.packageStatus === "ready") {
          clearInterval(timer);
          bbPollTimers.current.delete(bibleId);
        }
      } catch {
        clearInterval(timer);
        bbPollTimers.current.delete(bibleId);
      }
    }, 3000);

    bbPollTimers.current.set(bibleId, timer);
  };

  const handleDownloadBible = async (driveFile: DriveFile) => {
    try {
      setDownloading(driveFile.id);

      const isFirstBible = localBibles.length === 0;

      await googleDriveService.downloadBible(driveFile);

      const bibleInfo = googleDriveService.parseBibleInfo(driveFile.name);

      const bible: Bible = {
        id: bibleInfo.id || driveFile.id,
        name: bibleInfo.name || driveFile.name,
        abbreviation: bibleInfo.abbreviation || "UNK",
        fileName: bibleInfo.fileName || driveFile.name,
        isDownloaded: true,
        downloadDate: new Date().toISOString(),
        size: driveFile.size ? parseInt(driveFile.size) : undefined,
      };

      await DatabaseService.saveBible(bible);

      const updatedLocalBibles = await DatabaseService.getBibles();
      setLocalBibles(updatedLocalBibles);

      if (isFirstBible) {
        Alert.alert("Sucesso", `Bíblia "${bible.name}" baixada com sucesso!`, [
          {
            text: "OK",
            onPress: () =>
              router.push({
                pathname: "/chapter-reader",
                params: {
                  bibleId: bible.id,
                  bookId: "1",
                  chapterNumber: "1",
                },
              }),
          },
        ]);
      } else {
        Alert.alert("Sucesso", `Bíblia "${bible.name}" baixada com sucesso!`);
      }
    } catch (error) {
      console.error("Error downloading bible:", error);
      Alert.alert("Erro", "Falha ao baixar a Bíblia");
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadBbBible = async (bb: BibleBrainBible) => {
    try {
      setDownloading(bb.bibleId);

      const isFirstBible = localBibles.length === 0;

      let status = bb;
      if (status.packageStatus !== "ready") {
        status = await bibleBrainService.requestPackage(bb.bibleId);
        setBbGenerating((prev) => new Set(prev).add(bb.bibleId));
        startBbPolling(bb.bibleId);

        while (status.packageStatus === "generating" || status.packageStatus === null) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          status = await bibleBrainService.packageStatus(bb.bibleId);
          setBbBibles((prev) =>
            prev.map((b) => (b.bibleId === bb.bibleId ? status : b)),
          );
        }

        if (status.packageStatus !== "ready") {
          throw new Error(status.packageStatus === "failed" ? "Falha ao gerar pacote" : "Status inesperado");
        }
      }

      const fileName = `${bb.bibleId}.db`;
      await bibleBrainService.downloadPackage(bb.bibleId, fileName);

      const bible: Bible = {
        id: bb.bibleId,
        name: bb.name,
        abbreviation: bb.bibleId,
        fileName,
        isDownloaded: true,
        downloadDate: new Date().toISOString(),
        size: bb.packageSize || undefined,
        source: 'biblebrain',
      };

      await DatabaseService.saveBible(bible);

      const updatedLocalBibles = await DatabaseService.getBibles();
      setLocalBibles(updatedLocalBibles);

      if (isFirstBible) {
        Alert.alert("Sucesso", `Bíblia "${bb.name}" baixada com sucesso!`, [
          {
            text: "OK",
            onPress: () =>
              router.push({
                pathname: "/chapter-reader",
                params: {
                  bibleId: bible.id,
                  bookId: "1",
                  chapterNumber: "1",
                },
              }),
          },
        ]);
      } else {
        Alert.alert("Sucesso", `Bíblia "${bb.name}" baixada com sucesso!`);
      }
    } catch (error: any) {
      console.error("Error downloading biblebrain bible:", error);
      Alert.alert("Erro", error.message || "Falha ao baixar a Bíblia");
    } finally {
      setDownloading(null);
      setBbGenerating((prev) => {
        const next = new Set(prev);
        next.delete(bb.bibleId);
        return next;
      });
    }
  };

  const handleDeleteBible = async (bible: Bible) => {
    Alert.alert(
      "Confirmar Exclusão",
      `Deseja excluir a Bíblia "${bible.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await DatabaseService.deleteBible(bible.id);
              await googleDriveService.deleteBibleFile(bible.fileName);

              const updatedLocalBibles = await DatabaseService.getBibles();
              setLocalBibles(updatedLocalBibles);

              Alert.alert("Sucesso", "Bíblia excluída com sucesso!");
            } catch (error) {
              console.error("Error deleting bible:", error);
              Alert.alert("Erro", "Falha ao excluir a Bíblia");
            }
          },
        },
      ],
    );
  };

  const isDownloaded = (driveFile: DriveFile) =>
    localBibles.some((bible) => bible.fileName === driveFile.name);

  const isBbDownloaded = (bb: BibleBrainBible) =>
    localBibles.some((bible) => bible.id === bb.bibleId);

  const renderAvailableBible = ({ item }: { item: DriveFile }) => {
    const downloaded = isDownloaded(item);
    const bibleInfo = googleDriveService.parseBibleInfo(item.name);
    const isDownloadingThis = downloading === item.id;

    return (
      <View style={[styles.bibleCard, { backgroundColor: theme.card }]}>
        <View style={styles.bibleInfo}>
          <Text style={[styles.bibleName, { color: theme.text }]}>
            {bibleInfo.name}
          </Text>
          <Text style={[styles.bibleDetails, { color: theme.subText }]}>
            {bibleInfo.abbreviation}
          </Text>
          {item.size && (
            <Text style={[styles.bibleSize, { color: theme.subText }]}>
              {(parseInt(item.size) / 1024 / 1024).toFixed(1)} MB
            </Text>
          )}
        </View>

        <View style={styles.bibleActions}>
          {downloaded ? (
            <View style={styles.downloadedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.downloadedText}>Baixada</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.downloadButton,
                (isDownloadingThis || !isConnected) && styles.downloadingButton,
              ]}
              onPress={() => {
                if (!isConnected) {
                  Alert.alert("Sem Conexão", "Você precisa estar conectado à internet para baixar Bíblias.");
                  return;
                }
                handleDownloadBible(item);
              }}
              disabled={isDownloadingThis || !isConnected}
            >
              {isDownloadingThis ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : !isConnected ? (
                <Ionicons name="cloud-offline" size={20} color="#fff" />
              ) : (
                <Ionicons name="download" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderBbBible = ({ item }: { item: BibleBrainBible }) => {
    const downloaded = isBbDownloaded(item);
    const isDownloadingThis = downloading === item.bibleId;
    const isGenerating = bbGenerating.has(item.bibleId);

    const getStatusText = () => {
      if (downloaded) return null;
      if (item.packageStatus === "generating") return `Gerando... ${item.packageProgress}%`;
      if (item.packageStatus === "failed") return "Falha ao gerar";
      if (item.packageStatus === "ready") return "Pronto para baixar";
      return null;
    };

    return (
      <View style={[styles.bibleCard, { backgroundColor: theme.card }]}>
        <View style={styles.bibleInfo}>
          <Text style={[styles.bibleName, { color: theme.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.bibleDetails, { color: theme.subText }]}>
            {item.languageName} · {item.bibleId}
          </Text>
          {item.packageSize && (
            <Text style={[styles.bibleSize, { color: theme.subText }]}>
              {(item.packageSize / 1024 / 1024).toFixed(1)} MB
            </Text>
          )}
          {getStatusText() && (
            <Text style={[styles.bibleDetails, { color: isGenerating ? "#FF9800" : "#f44336", marginTop: 4 }]}>
              {getStatusText()}
            </Text>
          )}
        </View>

        <View style={styles.bibleActions}>
          {downloaded ? (
            <View style={styles.downloadedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.downloadedText}>Baixada</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.downloadButton,
                (isDownloadingThis || isGenerating) && styles.downloadingButton,
              ]}
              onPress={() => handleDownloadBbBible(item)}
              disabled={isDownloadingThis || isGenerating || !isConnected}
            >
              {isDownloadingThis ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : isGenerating ? (
                <Text style={{ color: "#fff", fontSize: 10 }}>{item.packageProgress}%</Text>
              ) : (
                <Ionicons name="download" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderLocalBible = ({ item }: { item: Bible }) => (
    <View style={[styles.bibleCard, { backgroundColor: theme.card }]}>
      <View style={styles.bibleInfo}>
        <Text style={[styles.bibleName, { color: theme.text }]}>
          {item.name}
        </Text>
        <Text style={[styles.bibleDetails, { color: theme.subText }]}>
          {item.abbreviation}
        </Text>
      </View>

      <View style={styles.bibleActions}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteBible(item)}
        >
          <Ionicons name="trash" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Gerenciar Bíblias
          </Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.subText }]}>
            Carregando...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Gerenciar Bíblias
        </Text>
        <TouchableOpacity onPress={() => { loadData(); if (activeTab === "biblebrain") loadBibleBrainBibles(); }} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "drive" && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab("drive")}
        >
          <Ionicons name="cloud" size={18} color={activeTab === "drive" ? theme.primary : theme.subText} />
          <Text style={[styles.tabText, { color: activeTab === "drive" ? theme.primary : theme.subText }]}>
            Google Drive
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "biblebrain" && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab("biblebrain")}
        >
          <Ionicons name="globe" size={18} color={activeTab === "biblebrain" ? theme.primary : theme.subText} />
          <Text style={[styles.tabText, { color: activeTab === "biblebrain" ? theme.primary : theme.subText }]}>
            BibleBrain
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Bíblias Baixadas ({localBibles.length})
        </Text>
        {localBibles.length > 0 ? (
          <FlatList
            data={localBibles}
            renderItem={renderLocalBible}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={styles.biblesList}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={48} color={theme.subText} />
            <Text style={[styles.emptyText, { color: theme.subText }]}>
              Nenhuma Bíblia baixada
            </Text>
          </View>
        )}

        {activeTab === "drive" && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Google Drive — Disponíveis ({availableBibles.length})
            </Text>
            {!isConnected && (
              <View style={[styles.offlineWarning, { backgroundColor: theme.card }]}>
                <Ionicons name="cloud-offline" size={24} color="#FF9800" />
                <Text style={[styles.offlineText, { color: theme.text }]}>
                  Sem conexão com a internet. Conecte-se para baixar Bíblias.
                </Text>
              </View>
            )}
            <FlatList
              data={availableBibles}
              renderItem={renderAvailableBible}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              style={styles.biblesList}
            />
          </>
        )}

        {activeTab === "biblebrain" && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              BibleBrain — Disponíveis ({bbBibles.length})
            </Text>
            {!isConnected && (
              <View style={[styles.offlineWarning, { backgroundColor: theme.card }]}>
                <Ionicons name="cloud-offline" size={24} color="#FF9800" />
                <Text style={[styles.offlineText, { color: theme.text }]}>
                  Sem conexão com a internet.
                </Text>
              </View>
            )}
            {bbLoading ? (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : (
              <FlatList
                data={bbBibles}
                renderItem={renderBbBible}
                keyExtractor={(item) => item.bibleId}
                showsVerticalScrollIndicator={false}
                style={styles.biblesList}
              />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  refreshButton: { padding: 8 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  tabText: { fontSize: 14, fontWeight: "600" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 16 },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16, marginTop: 16 },
  biblesList: { maxHeight: Dimensions.get("window").height / 2, marginBottom: 16 },
  bibleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  bibleInfo: { flex: 1 },
  bibleName: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  bibleDetails: { fontSize: 14, marginBottom: 2 },
  bibleSize: { fontSize: 12 },
  bibleActions: { marginLeft: 16 },
  downloadButton: {
    backgroundColor: "#2196F3",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  downloadingButton: { backgroundColor: "#999" },
  deleteButton: {
    backgroundColor: "#f44336",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  downloadedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f5e8",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  downloadedText: { color: "#4CAF50", fontSize: 12, fontWeight: "600", marginLeft: 4 },
  emptyState: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontSize: 16, marginTop: 16 },
  offlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  offlineText: { flex: 1, fontSize: 14, marginLeft: 12 },
});
