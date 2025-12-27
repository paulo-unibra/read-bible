import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../hooks/theme-context";
import DatabaseService from "../services/DatabaseService";
import googleDriveService from "../services/GoogleDriveService";
import { Bible, DriveFile } from "../types";

export default function BibleManagerScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  
  // Criar compatibilidade com a estrutura theme antiga
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

  useEffect(() => {
    loadData();
  }, []);

  // Recarregar dados sempre que a tela ganhar foco
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      await DatabaseService.init();

      // Load available bibles from Google Drive
      const driveFiles = await googleDriveService.listBibleFiles();
      setAvailableBibles(driveFiles);

      // Load local bibles
      const localBiblesData = await DatabaseService.getBibles();
      console.log("Bible-manager loaded bibles:", localBiblesData.length, "bibles found");
      console.log("Bible-manager bibles list:", localBiblesData.map(b => ({ id: b.id, name: b.name, fileName: b.fileName })));
      setLocalBibles(localBiblesData);
    } catch (error) {
      console.error("Error loading bible data:", error);
      Alert.alert("Erro", "Falha ao carregar dados das Bíblias");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBible = async (driveFile: DriveFile) => {
    try {
      setDownloading(driveFile.id);

      // Verificar se é a primeira Bíblia
      const isFirstBible = localBibles.length === 0;

      await googleDriveService.downloadBible(driveFile);

      const bibleInfo = googleDriveService.parseBibleInfo(driveFile.name);

      console.log("Downloaded bible info:", bibleInfo);

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

      // Refresh local bibles list
      const updatedLocalBibles = await DatabaseService.getBibles();
      setLocalBibles(updatedLocalBibles);

      // Se for a primeira Bíblia, redirecionar para Gênesis 1
      if (isFirstBible) {
        Alert.alert(
          "Sucesso",
          `Bíblia "${bible.name}" baixada com sucesso!`,
          [
            {
              text: "OK",
              onPress: () => router.push({
                pathname: "/chapter-reader",
                params: { 
                  bibleId: bible.id,
                  bookId: "1", 
                  chapterNumber: "1" 
                }
              }),
            },
          ]
        );
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

  const handleDeleteBible = async (bible: Bible) => {
    Alert.alert(
      "Confirmar Exclusão",
      `Deseja excluir a Bíblia "${bible.name}"?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await DatabaseService.deleteBible(bible.id);
              await googleDriveService.deleteBibleFile(bible.fileName);

              // Refresh local bibles list
              const updatedLocalBibles = await DatabaseService.getBibles();
              setLocalBibles(updatedLocalBibles);

              Alert.alert("Sucesso", "Bíblia excluída com sucesso!");
            } catch (error) {
              console.error("Error deleting bible:", error);
              Alert.alert("Erro", "Falha ao excluir a Bíblia");
            }
          },
        },
      ]
    );
  };

  const isDownloaded = (driveFile: DriveFile) => {
    return localBibles.some((bible) => bible.fileName === driveFile.name);
  };

  const renderAvailableBible = ({ item }: { item: DriveFile }) => {
    const downloaded = isDownloaded(item);
    const bibleInfo = googleDriveService.parseBibleInfo(item.name);
    const isDownloadingThis = downloading === item.id;

    return (
      <View style={[styles.bibleCard, { backgroundColor: theme.card }]}>
        <View style={styles.bibleInfo}>
          <Text style={[styles.bibleName, { color: theme.text }]}>{bibleInfo.name}</Text>
          <Text style={[styles.bibleDetails, { color: theme.subText }]}>{bibleInfo.abbreviation}</Text>
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
                isDownloadingThis && styles.downloadingButton,
              ]}
              onPress={() => handleDownloadBible(item)}
              disabled={isDownloadingThis}
            >
              {isDownloadingThis ? (
                <ActivityIndicator color="#fff" size="small" />
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
        <Text style={[styles.bibleName, { color: theme.text }]}>{item.name}</Text>
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Gerenciar Bíblias</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.subText }]}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Gerenciar Bíblias</Text>
        <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={theme.text} />
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
            <Text style={[styles.emptyText, { color: theme.subText }]}>Nenhuma Bíblia baixada</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Disponíveis para Download ({availableBibles.length})
        </Text>
        <FlatList
          data={availableBibles}
          renderItem={renderAvailableBible}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          style={styles.biblesList}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  refreshButton: {
    padding: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    marginTop: 16,
  },
  biblesList: {
    // metade da altura da tela
    maxHeight: Dimensions.get("window").height / 2,
    marginBottom: 16,
  },
  bibleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  bibleInfo: {
    flex: 1,
  },
  bibleName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  bibleDetails: {
    fontSize: 14,
    marginBottom: 2,
  },
  bibleSize: {
    fontSize: 12,
  },
  downloadDate: {
    fontSize: 12,
  },
  bibleActions: {
    marginLeft: 16,
  },
  downloadButton: {
    backgroundColor: "#2196F3",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  downloadingButton: {
    backgroundColor: "#999",
  },
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
  downloadedText: {
    color: "#4CAF50",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
});
