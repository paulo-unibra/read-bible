import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../hooks/theme-context";
import bibleBrainService, { VideoBible } from "../services/BibleBrainService";
import AdBanner from "../components/AdBanner";
import DatabaseService from "../services/DatabaseService";
import { formatBibleAbbreviation } from "../utils/bibleAbbreviation";

export default function VideoListScreen() {
  const { colors, isDark } = useTheme();
  const [videoBibles, setVideoBibles] = useState<VideoBible[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastVideo, setLastVideo] = useState<{
    bibleId: string; bibleName: string; bookId: string;
    chapter: number; positionMs: number; duration: number;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadVideoBibles();
      loadLastVideo();
    }, [])
  );

  const loadVideoBibles = async () => {
    try {
      setLoading(true);
      const bibles = await bibleBrainService.listVideoBibles("por");
      setVideoBibles(bibles);
    } catch (error) {
      console.error("Erro ao carregar vídeos:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadLastVideo = async () => {
    try {
      const progress = await DatabaseService.getLastVideoProgress();
      setLastVideo(progress);
    } catch {}
  };

  const renderBible = ({ item }: { item: VideoBible }) => (
    <TouchableOpacity
      style={[styles.bibleCard, { backgroundColor: colors.card }]}
      onPress={() =>
        router.push({
          pathname: "/video-player",
          params: { bibleId: item.bibleId, bibleName: item.name },
        })
      }
    >
      <View style={styles.bibleInfo}>
        <Text style={[styles.bibleName, { color: colors.textPrimary }]}>
          {item.name}
        </Text>
        <Text style={[styles.bibleLang, { color: colors.textSecondary }]}>
          {item.languageName} · {formatBibleAbbreviation(item.bibleId)}
        </Text>
        <Text style={[styles.bibleMeta, { color: colors.textSecondary }]}>
          {item.videoFilesets.length} disponíveis
        </Text>
      </View>
      <Ionicons name="play-circle" size={32} color={colors.primary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Filmes</Text>
        <TouchableOpacity onPress={loadVideoBibles} style={styles.backButton}>
          <Ionicons name="refresh" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={videoBibles}
          renderItem={renderBible}
          keyExtractor={(item) => item.bibleId}
          contentContainerStyle={styles.list}
          ListHeaderComponent={lastVideo ? (
            <TouchableOpacity
              style={[styles.continueCard, { backgroundColor: colors.accent + "15", borderColor: colors.accent }]}
              onPress={() =>
                router.push({
                  pathname: "/video-player",
                  params: {
                    bibleId: lastVideo.bibleId,
                    bibleName: lastVideo.bibleName,
                    resumeBookId: lastVideo.bookId,
                    resumeChapter: String(lastVideo.chapter),
                    resumePositionMs: String(lastVideo.positionMs),
                  },
                })
              }
            >
              <Ionicons name="play-skip-back" size={24} color={colors.accent} />
              <View style={styles.continueInfo}>
                <Text style={[styles.continueTitle, { color: colors.textPrimary }]}>
                  Continuar assistindo
                </Text>
                <Text style={[styles.continueSub, { color: colors.textSecondary }]}>
                  {lastVideo.bibleName} · Capítulo {lastVideo.chapter}
                  {lastVideo.duration > 0 && ` · ${Math.round(lastVideo.positionMs / 1000 / 60)}:${(Math.round(lastVideo.positionMs / 1000) % 60).toString().padStart(2, "0")} / ${Math.floor(lastVideo.duration / 1000 / 60)}:${(Math.floor(lastVideo.duration / 1000) % 60).toString().padStart(2, "0")}`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="film-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Nenhum filme disponível no momento
              </Text>
            </View>
          }
        />
      )}
      <AdBanner />
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
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16 },
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
  bibleName: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  bibleLang: { fontSize: 13, marginBottom: 2 },
  bibleMeta: { fontSize: 12 },
  emptyState: { alignItems: "center", paddingVertical: 64 },
  emptyText: { fontSize: 16, marginTop: 16, textAlign: "center" },
  continueCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  continueInfo: { flex: 1 },
  continueTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  continueSub: { fontSize: 12 },
});
