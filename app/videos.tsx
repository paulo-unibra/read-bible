import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../hooks/theme-context";
import bibleBrainService, { VideoBible } from "../services/BibleBrainService";
import DatabaseService from "../services/DatabaseService";
import AdBanner from "../components/AdBanner";
import { USFM_BOOKS } from "./usfm-books";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 3.5;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

export default function VideosScreen() {
  const { colors, isDark } = useTheme();
  const [videoBible, setVideoBible] = useState<VideoBible | null>(null);
  const [availableBookIds, setAvailableBookIds] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [thumbnails, setThumbnails] = useState<Record<string, Record<number, string>>>({});

  const [activeVideo, setActiveVideo] = useState<{
    url: string; bibleId: string; bibleName: string; bookId: string; chapter: number; positionMs?: number;
  } | null>(null);
  const resumePosRef = useRef(0);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.audioMixingMode = "auto";
  });

  useEffect(() => {
    if (!activeVideo?.url) return;
    player.replace({ uri: activeVideo.url });
    if (resumePosRef.current > 0) {
      player.currentTime = resumePosRef.current;
      resumePosRef.current = 0;
    }
    player.play();
  }, [activeVideo]);

  const playVideo = async (bookId: string, chapter: number, resumePositionMs?: number) => {
    if (!videoBible) return;
    if (resumePositionMs) {
      resumePosRef.current = resumePositionMs / 1000;
    }
    try {
      const segs = await bibleBrainService.getVideoSegments(videoBible.bibleId, bookId, chapter);
      if (segs.length === 0) return;
      setActiveVideo({
        url: segs[0].url, bibleId: videoBible.bibleId, bibleName: videoBible.name,
        bookId, chapter, positionMs: resumePositionMs,
      });
    } catch {}
  };

  const closePlayer = () => {
    if (activeVideo?.bookId && activeVideo?.chapter) {
      try {
        player.pause();
        DatabaseService.saveVideoProgress({
          bibleId: activeVideo.bibleId,
          bibleName: activeVideo.bibleName,
          bookId: activeVideo.bookId,
          chapter: activeVideo.chapter,
          positionMs: Math.round(player.currentTime * 1000),
          duration: Math.round(player.duration * 1000),
        });
      } catch {}
    }
    setActiveVideo(null);
    resumePosRef.current = 0;
  };

  useFocusEffect(
    useCallback(() => {
      init();
    }, [])
  );

  const init = async () => {
    try {
      setLoading(true);
      setThumbnails({});
      setAvailableBookIds(null);
      const bibles = await bibleBrainService.listVideoBibles("por");
      if (bibles.length === 0) {
        setVideoBible(null);
        return;
      }
      for (const bible of bibles) {
        try {
          const books = await bibleBrainService.getVideoBooks(bible.bibleId);
          if (books.length > 0) {
            const ids = new Set(books.map((b) => b.bookId));
            setVideoBible(bible);
            setAvailableBookIds(ids);
            loadThumbnails(bible.bibleId, [...ids]);
            return;
          }
        } catch {}
      }
      setVideoBible(bibles[0]);
      setAvailableBookIds(null);
    } catch (error) {
      console.error("Erro ao carregar filmes:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadThumbnails = async (bibleId: string, bookIds: string[]) => {
    const BATCH_SIZE = 5;
    const tasks: { bookId: string; chapter: number }[] = [];
    for (const bookId of bookIds) {
      const book = USFM_BOOKS.find((b) => b.id === bookId);
      if (!book) continue;
      for (let ch = 1; ch <= book.chapters; ch++) {
        tasks.push({ bookId, chapter: ch });
      }
    }
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async ({ bookId, chapter }) => {
          try {
            const thumb = await bibleBrainService.getVideoThumbnail(bibleId, bookId, chapter);
            if (thumb) {
              setThumbnails((prev) => ({
                ...prev,
                [bookId]: { ...prev[bookId], [chapter]: thumb },
              }));
            }
          } catch {}
        })
      );
    }
  };

  const booksToShow = availableBookIds
    ? USFM_BOOKS.filter((b) => availableBookIds.has(b.id))
    : USFM_BOOKS;

  const handlePlayChapter = (bookId: string, chapter: number) => {
    playVideo(bookId, chapter);
  };

  const renderBookRow = ({ item }: { item: typeof USFM_BOOKS[0] }) => {
    const chapters = Array.from({ length: item.chapters }, (_, i) => i + 1);

    return (
      <View style={styles.bookSection}>
        <Text style={[styles.bookTitle, { color: colors.textPrimary }]}>
          {item.name}
        </Text>
        <FlatList
          data={chapters}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chapterRow}
          keyExtractor={(ch) => String(ch)}
          renderItem={({ item: ch }) => {
            const thumb = thumbnails[item.id]?.[ch];
            return (
            <TouchableOpacity
              style={[styles.chapterCard, { backgroundColor: colors.card, borderColor: colors.border, overflow: "hidden" }]}
              onPress={() => handlePlayChapter(item.id, ch)}
            >
              {thumb && (
                <Image source={{ uri: thumb }} style={styles.chapterThumb} />
              )}
              <View style={styles.chapterOverlay}>
                <View style={[styles.chapterNumberBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.chapterNumberText}>{ch}</Text>
                </View>
                <Ionicons name="play-circle" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  };

  const loadLastVideo = async () => {
    try {
      return await DatabaseService.getLastVideoProgress();
    } catch { return null; }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Filmes</Text>
        <TouchableOpacity onPress={init} style={styles.backButton}>
          <Ionicons name="refresh" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Carregando filmes...
          </Text>
        </View>
      ) : !videoBible ? (
        <View style={styles.emptyState}>
          <Ionicons name="film-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Nenhum filme disponível no momento
          </Text>
        </View>
      ) : (
        <FlatList
          data={booksToShow}
          keyExtractor={(item) => item.id}
          renderItem={renderBookRow}
          ListHeaderComponent={
            <LastVideoCard loadLastVideo={loadLastVideo} onPlay={playVideo} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="film-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Nenhum filme disponível
              </Text>
            </View>
          }
        />
      )}
      <AdBanner />

      <Modal visible={!!activeVideo} animationType="slide" onRequestClose={closePlayer}>
        <View style={[styles.modalContainer, { backgroundColor: isDark ? "#000" : "#000" }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closePlayer} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {activeVideo && (
              <Text style={styles.modalTitle} numberOfLines={1}>
                {USFM_BOOKS.find((b) => b.id === activeVideo.bookId)?.name || activeVideo.bookId} - Capítulo {activeVideo.chapter}
              </Text>
            )}
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.modalVideoWrapper}>
            {activeVideo && (
              <VideoView
                player={player}
                style={styles.modalVideo}
                nativeControls
                contentFit="contain"
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function LastVideoCard({
  loadLastVideo, onPlay,
}: {
  loadLastVideo: () => Promise<any>;
  onPlay: (bookId: string, chapter: number, positionMs?: number) => void;
}) {
  const { colors } = useTheme();
  const [lastVideo, setLastVideo] = useState<{
    bibleId: string; bibleName: string; bookId: string;
    chapter: number; positionMs: number; duration: number;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadLastVideo().then(setLastVideo);
    }, [])
  );

  if (!lastVideo) return null;

  return (
    <TouchableOpacity
      style={[styles.continueCard, { backgroundColor: colors.accent + "15", borderColor: colors.accent }]}
      onPress={() => onPlay(lastVideo.bookId, lastVideo.chapter, lastVideo.positionMs)}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14 },
  emptyState: { alignItems: "center", paddingVertical: 64 },
  emptyText: { fontSize: 16, marginTop: 16, textAlign: "center" },
  bookSection: { marginBottom: 8 },
  bookTitle: { fontSize: 18, fontWeight: "700", paddingHorizontal: 16, marginBottom: 8, marginTop: 12 },
  chapterRow: { paddingHorizontal: 12, gap: 8 },
  chapterCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chapterThumb: {
    position: "absolute",
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  chapterOverlay: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  chapterNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  chapterNumberText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  continueCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    margin: 16,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  continueInfo: { flex: 1 },
  continueTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  continueSub: { fontSize: 12 },

  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
  },
  modalCloseBtn: { padding: 8 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#fff", flex: 1, textAlign: "center", marginHorizontal: 8 },
  modalVideoWrapper: { flex: 1, justifyContent: "center" },
  modalVideo: { width: "100%", height: "100%" },
});
