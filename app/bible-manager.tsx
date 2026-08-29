import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../hooks/theme-context";
import bibleBrainService from "../services/BibleBrainService";
import DatabaseService from "../services/DatabaseService";
import googleDriveService from "../services/GoogleDriveService";
import { Bible, BibleBrainBible, DriveFile } from "../types";

// As Bíblias do Google Drive hospedadas hoje neste app são todas em português.
const DRIVE_LANGUAGE_ISO = "por";

type AvailableBible =
  | { source: "drive"; driveFile: DriveFile }
  | { source: "biblebrain"; bibleBrainBible: BibleBrainBible }
  | { source: "local"; bible: Bible };

export default function BibleManagerScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const theme = {
    background: colors.bg,
    card: colors.card,
    border: colors.border,
    text: colors.textPrimary,
    subText: colors.textSecondary,
    primary: colors.primary,
  };

  const [availableBibles, setAvailableBibles] = useState<DriveFile[]>([]);
  const [localBibles, setLocalBibles] = useState<Bible[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);

  const [bbBibles, setBbBibles] = useState<BibleBrainBible[]>([]);
  const [bbGenerating, setBbGenerating] = useState<Set<string>>(new Set());
  const [bbLoading, setBbLoading] = useState(false);
  const bbPollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [languages, setLanguages] = useState<{ iso: string; name: string }[]>([]);
  const [languageIso, setLanguageIso] = useState("");
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [languageFilterText, setLanguageFilterText] = useState("");
  const isFirstBbFilterRun = useRef(true);

  useEffect(() => {
    loadData();
    loadLanguages();

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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, languageIso]),
  );

  // Debounce da busca por nome digitada pelo usuário
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Sempre que a busca ou o idioma mudar, refaz a busca das bíblias BibleBrain no servidor
  useEffect(() => {
    if (isFirstBbFilterRun.current) {
      isFirstBbFilterRun.current = false;
      return;
    }
    loadBibleBrainBibles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, languageIso]);

  const loadLanguages = async () => {
    try {
      const data = await bibleBrainService.getLanguages();
      setLanguages(data);
    } catch (error) {
      console.error("Erro ao carregar idiomas BibleBrain:", error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      await DatabaseService.init();

      const [driveFiles] = await Promise.all([
        googleDriveService.listBibleFiles(),
        loadBibleBrainBibles(),
      ]);
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
      const result = await bibleBrainService.listBibles({ perPage: 50, search, languageIso });
      updateBibleBrainBibles(result.data);
    } catch (error) {
      console.error("Erro ao carregar bíblias BibleBrain:", error);
    } finally {
      setBbLoading(false);
    }
  };

  const updateBibleBrainBibles = (bibles: BibleBrainBible[]) => {
    const generating = new Set<string>();
    for (const bible of bibles) {
      if (bible.packageStatus === "generating") {
        generating.add(bible.bibleId);
      }
    }
    setBbGenerating(generating);
    setBbBibles(bibles);
    generating.forEach((bibleId) => startBbPolling(bibleId));
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
      const isAudioOnly = !bb.hasText && bb.hasAudio;

      console.log("[BibleManager] Iniciando download/adicao BibleBrain:", {
        bibleId: bb.bibleId,
        name: bb.name,
        hasText: bb.hasText,
        hasAudio: bb.hasAudio,
        packageStatus: bb.packageStatus,
        audioPackageStatus: bb.audioPackageStatus,
        isAudioOnly,
      });

      if (isAudioOnly) {
        if (bb.audioPackageStatus !== "ready") {
          throw new Error("Áudio ainda não está pronto para uso");
        }

        console.log("[BibleManager] BibleBrain somente audio: salvando referencia local sem .db", {
          bibleId: bb.bibleId,
          fileName: `${bb.bibleId}.audio`,
        });

        const bible: Bible = {
          id: bb.bibleId,
          name: bb.name,
          abbreviation: bb.bibleId,
          fileName: `${bb.bibleId}.audio`,
          isDownloaded: true,
          downloadDate: new Date().toISOString(),
          source: "biblebrain",
        };

        await DatabaseService.saveBible(bible);

        console.log("[BibleManager] Referencia BibleBrain audio salva no banco local", bible);

        const updatedLocalBibles = await DatabaseService.getBibles();
        setLocalBibles(updatedLocalBibles);

        Alert.alert("Sucesso", `Áudio "${bb.name}" adicionado com sucesso!`);
        return;
      }

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
      console.log("[BibleManager] Baixando pacote .db BibleBrain", {
        bibleId: bb.bibleId,
        fileName,
        packageSize: status.packageSize,
      });
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

      console.log("[BibleManager] Pacote .db BibleBrain salvo no banco local", bible);

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

  const handleRemoveDownload = (bible: Bible) => {
    Alert.alert(
      "Remover Download",
      `Deseja remover o download da Bíblia "${bible.name}"? Você poderá baixá-la novamente quando quiser.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              await DatabaseService.deleteBible(bible.id);
              await googleDriveService.deleteBibleFile(bible.fileName);

              const updatedLocalBibles = await DatabaseService.getBibles();
              setLocalBibles(updatedLocalBibles);
            } catch (error) {
              console.error("Error removing bible download:", error);
              Alert.alert("Erro", "Falha ao remover o download da Bíblia");
            }
          },
        },
      ],
    );
  };

  const getLocalDriveBible = (driveFile: DriveFile) =>
    localBibles.find((bible) => bible.fileName === driveFile.name);

  const getLocalBbBible = (bb: BibleBrainBible) =>
    localBibles.find((bible) => bible.id === bb.bibleId);

  const driveBibleHasAudio = (driveFile: DriveFile, bibleInfo: Partial<Bible>) => {
    const searchableText = [
      driveFile.name,
      bibleInfo.id,
      bibleInfo.name,
      bibleInfo.abbreviation,
    ]
      .filter(Boolean)
      .join(" ")
      .toUpperCase();

    return searchableText.includes("ARC") || searchableText.includes("ALMEIDA REVISTA E CORRIGIDA");
  };

  const getAvailableBibleResources = (item: AvailableBible) => {
    if (item.source === "drive") {
      const bibleInfo = googleDriveService.parseBibleInfo(item.driveFile.name);
      return {
        hasText: true,
        hasAudio: driveBibleHasAudio(item.driveFile, bibleInfo),
        name: bibleInfo.name || item.driveFile.name,
      };
    }

    if (item.source === "biblebrain") {
      return {
        hasText: item.bibleBrainBible.hasText,
        hasAudio: item.bibleBrainBible.hasAudio,
        name: item.bibleBrainBible.name,
      };
    }

    return {
      hasText: true,
      hasAudio: false,
      name: item.bible.name,
    };
  };

  const normalizedSearch = search.trim().toLowerCase();
  const matchesSearch = (name: string) =>
    !normalizedSearch || name.toLowerCase().includes(normalizedSearch);

  // Bíblias do Drive não têm idioma cadastrado: assumimos português (único
  // idioma hospedado hoje no Drive) e as escondemos quando outro idioma
  // específico é selecionado no filtro.
  const filteredDriveBibles = availableBibles.filter((driveFile) => {
    if (languageIso && languageIso !== DRIVE_LANGUAGE_ISO) return false;
    const bibleInfo = googleDriveService.parseBibleInfo(driveFile.name);
    return matchesSearch(bibleInfo.name || driveFile.name);
  });

  // Bíblias já baixadas cuja versão não está mais no catálogo atual (ex.:
  // filtro de idioma/busca ativo, ou item removido do catálogo remoto).
  // Mantidas na lista para que o usuário sempre consiga gerenciá-las.
  const localOnlyBibles = localBibles.filter((local) => {
    const inDrive = availableBibles.some((driveFile) => driveFile.name === local.fileName);
    const inBibleBrain = bbBibles.some((bb) => bb.bibleId === local.id);
    return !inDrive && !inBibleBrain;
  }).filter((local) => matchesSearch(local.name));

  const availableDownloadBibles: AvailableBible[] = [
    ...filteredDriveBibles.map((driveFile) => ({ source: "drive" as const, driveFile })),
    ...bbBibles.map((bibleBrainBible) => ({ source: "biblebrain" as const, bibleBrainBible })),
    ...localOnlyBibles.map((bible) => ({ source: "local" as const, bible })),
  ].sort((a, b) => {
    const aResources = getAvailableBibleResources(a);
    const bResources = getAvailableBibleResources(b);
    const aScore = Number(aResources.hasText) + Number(aResources.hasAudio);
    const bScore = Number(bResources.hasText) + Number(bResources.hasAudio);

    if (aScore !== bScore) return bScore - aScore;
    if (aResources.hasAudio !== bResources.hasAudio) return Number(bResources.hasAudio) - Number(aResources.hasAudio);

    return aResources.name.localeCompare(bResources.name);
  });

  const renderAvailableBible = ({ item }: { item: DriveFile }) => {
    const localBible = getLocalDriveBible(item);
    const downloaded = !!localBible;
    const bibleInfo = googleDriveService.parseBibleInfo(item.name);
    const isDownloadingThis = downloading === item.id;
    const hasAudio = driveBibleHasAudio(item, bibleInfo);

    return (
      <View style={[styles.bibleCard, { backgroundColor: theme.card }]}> 
        <View style={styles.bibleInfo}>
          <Text style={[styles.bibleName, { color: theme.text }]}>
            {bibleInfo.name}
          </Text>
          <View style={styles.sourceRow}>
            <View style={[styles.sourceIcon, { backgroundColor: "#E3F2FD" }]}> 
              <Ionicons name="cloud" size={13} color="#1976D2" />
            </View>
            <View style={[styles.mediaIcon, { backgroundColor: "#FFF3E0" }]}> 
              <Ionicons name="document-text" size={13} color="#EF6C00" />
            </View>
            {hasAudio && (
              <View style={[styles.mediaIcon, { backgroundColor: "#F3E5F5" }]}> 
                <Ionicons name="volume-high" size={13} color="#7B1FA2" />
              </View>
            )}
          </View>
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
          {downloaded && localBible ? (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveDownload(localBible)}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
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
    const localBible = getLocalBbBible(item);
    const downloaded = !!localBible;
    const isDownloadingThis = downloading === item.bibleId;
    const isGenerating = bbGenerating.has(item.bibleId);

    const getStatusText = () => {
      if (downloaded) return null;
      if (item.packageStatus === "generating") return `Gerando... ${item.packageProgress}%`;
      if (item.packageStatus === "failed") return "Falha ao gerar";
      if (item.packageStatus === "ready") return "Pronto para baixar";
      if (!item.hasText && item.audioPackageStatus === "ready") return "Áudio pronto";
      return null;
    };
    const statusText = getStatusText();
    const statusColor = isGenerating ? "#FF9800" : item.audioPackageStatus === "ready" && !item.hasText ? "#4CAF50" : "#f44336";

    return (
      <View style={[styles.bibleCard, { backgroundColor: theme.card }]}>
        <View style={styles.bibleInfo}>
          <Text style={[styles.bibleName, { color: theme.text }]}>
            {item.name}
          </Text>
          <View style={styles.sourceRow}>
            <View style={[styles.sourceIcon, { backgroundColor: "#E8F5E9" }]}> 
              <Ionicons name="globe" size={13} color="#2E7D32" />
            </View>
            {item.hasText && (
              <View style={[styles.mediaIcon, { backgroundColor: "#FFF3E0" }]}> 
                <Ionicons name="document-text" size={13} color="#EF6C00" />
              </View>
            )}
            {item.hasAudio && (
              <View style={[styles.mediaIcon, { backgroundColor: "#F3E5F5" }]}> 
                <Ionicons name="volume-high" size={13} color="#7B1FA2" />
              </View>
            )}
          </View>
          <Text style={[styles.bibleDetails, { color: theme.subText }]}> 
            {item.languageName} · {item.bibleId}
          </Text>
          {item.packageSize && (
            <Text style={[styles.bibleSize, { color: theme.subText }]}>
              {(item.packageSize / 1024 / 1024).toFixed(1)} MB
            </Text>
          )}
          {statusText && (
            <Text style={[styles.bibleDetails, { color: statusColor, marginTop: 4 }]}> 
              {statusText}
            </Text>
          )}
        </View>

        <View style={styles.bibleActions}>
          {downloaded && localBible ? (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveDownload(localBible)}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.downloadButton,
                (isDownloadingThis || isGenerating || !isConnected) && styles.downloadingButton,
              ]}
              onPress={() => handleDownloadBbBible(item)}
              disabled={isDownloadingThis || isGenerating || !isConnected}
            >
              {isDownloadingThis ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : !isConnected ? (
                <Ionicons name="cloud-offline" size={20} color="#fff" />
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

  const renderLocalOnlyBible = ({ item }: { item: Bible }) => (
    <View style={[styles.bibleCard, { backgroundColor: theme.card }]}>
      <View style={styles.bibleInfo}>
        <Text style={[styles.bibleName, { color: theme.text }]}>
          {item.name}
        </Text>
        <View style={styles.sourceRow}>
          <View style={[styles.sourceIcon, { backgroundColor: "#ECEFF1" }]}>
            <Ionicons name="phone-portrait" size={13} color="#546E7A" />
          </View>
        </View>
        <Text style={[styles.bibleDetails, { color: theme.subText }]}>
          {item.abbreviation}
        </Text>
      </View>

      <View style={styles.bibleActions}>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveDownload(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAvailableDownloadBible = ({ item }: { item: AvailableBible }) => {
    if (item.source === "drive") {
      return renderAvailableBible({ item: item.driveFile });
    }

    if (item.source === "biblebrain") {
      return renderBbBible({ item: item.bibleBrainBible });
    }

    return renderLocalOnlyBible({ item: item.bible });
  };

  const getAvailableDownloadKey = (item: AvailableBible) => {
    if (item.source === "drive") return `drive-${item.driveFile.id}`;
    if (item.source === "biblebrain") return `biblebrain-${item.bibleBrainBible.bibleId}`;
    return `local-${item.bible.id}`;
  };

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
        <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 0 }]}>
          Bíblias ({availableDownloadBibles.length})
        </Text>

        <View style={styles.filtersRow}>
          <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.subText} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Pesquisar bíblia por nome..."
              placeholderTextColor={theme.subText}
              value={searchInput}
              onChangeText={setSearchInput}
              autoCorrect={false}
            />
            {searchInput.length > 0 && (
              <TouchableOpacity onPress={() => setSearchInput("")}>
                <Ionicons name="close-circle" size={18} color={theme.subText} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.languageFilterButton,
              { backgroundColor: theme.card, borderColor: languageIso ? theme.primary : theme.border },
            ]}
            onPress={() => setLanguageModalVisible(true)}
          >
            <Ionicons name="language" size={18} color={languageIso ? theme.primary : theme.subText} />
            <Text
              style={[styles.languageFilterText, { color: languageIso ? theme.primary : theme.subText }]}
              numberOfLines={1}
            >
              {languages.find((lang) => lang.iso === languageIso)?.name || "Idioma"}
            </Text>
          </TouchableOpacity>
        </View>

        {!isConnected && (
          <View style={[styles.offlineWarning, { backgroundColor: theme.card }]}> 
            <Ionicons name="cloud-offline" size={24} color="#FF9800" />
            <Text style={[styles.offlineText, { color: theme.text }]}> 
              Sem conexão com a internet. Conecte-se para baixar Bíblias.
            </Text>
          </View>
        )}

        {bbLoading && (
          <View style={styles.inlineLoadingRow}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.inlineLoadingText, { color: theme.subText }]}>Atualizando lista...</Text>
          </View>
        )}

        {availableDownloadBibles.length > 0 ? (
          <FlatList
            data={availableDownloadBibles}
            renderItem={renderAvailableDownloadBible}
            keyExtractor={getAvailableDownloadKey}
            showsVerticalScrollIndicator={false}
            style={styles.biblesList}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-download-outline" size={48} color={theme.subText} />
            <Text style={[styles.emptyText, { color: theme.subText }]}> 
              Nenhuma Bíblia encontrada
            </Text>
          </View>
        )}
      </View>

      <Modal
        visible={languageModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.languageModal, { backgroundColor: theme.card }]}>
            <View style={styles.languageModalHeader}>
              <Text style={[styles.languageModalTitle, { color: theme.text }]}>Filtrar por idioma</Text>
              <TouchableOpacity onPress={() => setLanguageModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.languageSearchInput, { color: theme.text, borderColor: theme.border }]}
              placeholder="Buscar idioma..."
              placeholderTextColor={theme.subText}
              value={languageFilterText}
              onChangeText={setLanguageFilterText}
            />

            <FlatList
              data={[
                { iso: "", name: "Todos os idiomas" },
                ...languages.filter((lang) => {
                  const query = languageFilterText.trim().toLowerCase();
                  if (!query) return true;
                  return (
                    lang.name.toLowerCase().includes(query) ||
                    lang.iso.toLowerCase().includes(query)
                  );
                }),
              ]}
              keyExtractor={(item) => item.iso || "all"}
              renderItem={({ item }) => {
                const selected = item.iso === languageIso;
                return (
                  <TouchableOpacity
                    style={[styles.languageOption, { borderBottomColor: theme.border }]}
                    onPress={() => {
                      setLanguageIso(item.iso);
                      setLanguageModalVisible(false);
                      setLanguageFilterText("");
                    }}
                  >
                    <Text
                      style={[
                        styles.languageOptionText,
                        { color: theme.text },
                        selected && { color: theme.primary, fontWeight: "700" },
                      ]}
                    >
                      {item.name}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={20} color={theme.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
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
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 16 },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16, marginTop: 16 },
  filtersRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, height: "100%" },
  languageFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    maxWidth: 120,
  },
  languageFilterText: { fontSize: 13, fontWeight: "600", flexShrink: 1 },
  inlineLoadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  inlineLoadingText: { fontSize: 13 },
  biblesList: { flex: 1, marginBottom: 16 },
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
  sourceRow: { flexDirection: "row", marginBottom: 6 },
  sourceIcon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 6,
  },
  mediaIcon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 6,
  },
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
  removeButton: {
    backgroundColor: "#f44336",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  languageModal: {
    width: "85%",
    maxHeight: "70%",
    borderRadius: 16,
    padding: 16,
  },
  languageModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  languageModalTitle: { fontSize: 18, fontWeight: "bold" },
  languageSearchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 8,
    fontSize: 14,
  },
  languageOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  languageOptionText: { fontSize: 15 },
});
