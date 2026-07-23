import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../hooks/theme-context";
import bibleBrainService from "../services/BibleBrainService";
import AdBanner from "../components/AdBanner";
import DatabaseService from "../services/DatabaseService";
import { USFM_BOOKS } from "./usfm-books";

interface BookChapter {
  bookId: string;
  bookName: string;
  chapter: number;
  maxChapters: number;
}


export default function VideoPlayerScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const bibleId = params.bibleId as string;
  const bibleName = params.bibleName as string;
  const resumeBookId = params.resumeBookId as string | undefined;
  const resumeChapter = params.resumeChapter as string | undefined;
  const resumePositionMs = params.resumePositionMs as string | undefined;

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [availableBooks, setAvailableBooks] = useState<BookChapter[]>([]);
  const [checkingBooks, setCheckingBooks] = useState(true);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [segments, setSegments] = useState<{ verseStart: number; verseEnd: number; duration: number; url: string; thumbnail: string | null }[]>([]);
  const [availableChapters, setAvailableChapters] = useState<number[]>([]);
  const resumePosRef = useRef(0);

  const player = useVideoPlayer(videoUrl ? { uri: videoUrl } : null, (player) => {
    player.loop = false;
    player.audioMixingMode = "auto";
  });

  useEffect(() => {
    if (videoUrl) {
      player.replace({ uri: videoUrl });
      if (resumePosRef.current > 0) {
        player.currentTime = resumePosRef.current;
        resumePosRef.current = 0;
      }
      player.play();
    }
  }, [videoUrl]);

  useEffect(() => {
    discoverAvailableBooks();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        if (player.playing && selectedBook && selectedChapter) {
          DatabaseService.saveVideoProgress({
            bibleId,
            bibleName,
            bookId: selectedBook,
            chapter: selectedChapter,
            positionMs: Math.round(player.currentTime * 1000),
            duration: Math.round(player.duration * 1000),
          });
        }
      } catch {}
    }, 10000);
    return () => {
      try {
        if (player.playing && selectedBook && selectedChapter) {
          DatabaseService.saveVideoProgress({
            bibleId,
            bibleName,
            bookId: selectedBook,
            chapter: selectedChapter,
            positionMs: Math.round(player.currentTime * 1000),
            duration: Math.round(player.duration * 1000),
          });
        }
      } catch {}
      clearInterval(interval);
    };
  }, [selectedBook, selectedChapter]);

  const discoverAvailableBooks = async () => {
    setCheckingBooks(true);
    try {
      const books = await bibleBrainService.getVideoBooks(bibleId);
      const found: BookChapter[] = books.map((b) => {
        const full = USFM_BOOKS.find((bn) => bn.id === b.bookId);
        return { bookId: b.bookId, bookName: full?.name || b.name, chapter: 1, maxChapters: full?.chapters || 28 };
      });
      setAvailableBooks(found);
      if (resumeBookId && resumeChapter && found.some((b) => b.bookId === resumeBookId)) {
        const ch = parseInt(resumeChapter, 10);
        const full = USFM_BOOKS.find((bn) => bn.id === resumeBookId);
        setSelectedBook(resumeBookId);
        setAvailableChapters(Array.from({ length: full?.chapters || ch }, (_, i) => i + 1));
        if (resumePositionMs) {
          resumePosRef.current = parseInt(resumePositionMs, 10) / 1000;
        }
        loadChapter(resumeBookId, ch);
      }
    } catch {
      setAvailableBooks([]);
    }
    setCheckingBooks(false);
  };

  const loadChapter = async (bookId: string, chapter: number) => {
    try {
      setLoadingVideo(true);
      setSelectedBook(bookId);
      setSelectedChapter(chapter);
      setSegments([]);
      const segs = await bibleBrainService.getVideoSegments(bibleId, bookId, chapter);
      setSegments(segs);
      if (segs.length === 1) {
        setShowThumbnail(true);
        setVideoUrl(segs[0].url);
        setThumbnail(segs[0].thumbnail || null);
        setDuration(segs[0].duration);
      } else if (segs.length > 1) {
        setVideoUrl(null);
        setThumbnail(null);
        setDuration(0);
      } else {
        Alert.alert("Info", "Nenhum vídeo disponível para este capítulo");
      }
    } catch (error) {
      Alert.alert("Erro", "Não foi possível carregar este vídeo");
    } finally {
      setLoadingVideo(false);
    }
  };

  const playSegment = (segment: { verseStart: number; verseEnd: number; duration: number; url: string; thumbnail: string | null }) => {
    setShowThumbnail(true);
    setVideoUrl(segment.url);
    setThumbnail(segment.thumbnail || null);
    setDuration(segment.duration);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {bibleName}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {checkingBooks ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Verificando livros disponíveis...
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.videoContainer}>
            {videoUrl ? (
              <>
                {showThumbnail && thumbnail && (
                  <Image source={{ uri: thumbnail }} style={styles.thumbnailOverlay} />
                )}
                <VideoView
                  player={player}
                  style={styles.video}
                  nativeControls
                  contentFit="contain"
                  onFirstFrameRender={() => setShowThumbnail(false)}
                />
              </>
            ) : thumbnail ? (
              <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
            ) : (
              <View style={[styles.placeholderVideo, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="film-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.selectText, { color: colors.textSecondary }]}>
                  Selecione um capítulo
                </Text>
              </View>
            )}
          </View>

          {selectedBook && selectedChapter && (
            <View style={[styles.currentInfo, { backgroundColor: colors.card }]}>
              <Text style={[styles.currentText, { color: colors.textPrimary }]}>
                {USFM_BOOKS.find((b) => b.id === selectedBook)?.name || selectedBook} - Capítulo {selectedChapter}
              </Text>
              {duration > 0 && (
                <Text style={[styles.durationText, { color: colors.textSecondary }]}>
                  {Math.floor(duration / 60)}:{(Math.floor(duration) % 60).toString().padStart(2, "0")}
                </Text>
              )}
            </View>
          )}

          {segments.length > 1 && (
            <View style={[styles.segmentsContainer, { paddingHorizontal: 16 }]}>
              {segments.map((seg, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.segmentCard, { backgroundColor: colors.card }]}
                  onPress={() => playSegment(seg)}
                >
                  <View style={styles.segmentInfo}>
                    <Text style={[styles.segmentTitle, { color: colors.textPrimary }]}>
                      {seg.verseStart === seg.verseEnd
                        ? `Versículo ${seg.verseStart}`
                        : `${seg.verseStart}–${seg.verseEnd}`}
                    </Text>
                    {seg.duration > 0 && (
                      <Text style={[styles.segmentDuration, { color: colors.textSecondary }]}>
                        {Math.floor(seg.duration / 60)}:{(Math.floor(seg.duration) % 60).toString().padStart(2, "0")}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="play-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <FlatList
            data={availableBooks}
            keyExtractor={(item) => item.bookId}
            contentContainerStyle={styles.bookList}
            renderItem={({ item }) => (
              <View>
                <TouchableOpacity
                  style={[styles.bookCard, { backgroundColor: colors.card }]}
                  onPress={() => {
                    setSelectedBook(item.bookId);
                    setAvailableChapters(Array.from({ length: item.maxChapters }, (_, i) => i + 1));
                  }}
                >
                  <Ionicons name="film-outline" size={20} color={colors.primary} />
                  <Text style={[styles.bookName, { color: colors.textPrimary }]}>
                    {item.bookName}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                {selectedBook === item.bookId && availableChapters.length > 0 && (
                  <View style={styles.chaptersGrid}>
                    {availableChapters.slice(0, 28).map((ch) => (
                      <TouchableOpacity
                        key={ch}
                        style={[
                          styles.chapterButton,
                          { borderColor: colors.border },
                          selectedChapter === ch && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => loadChapter(item.bookId, ch)}
                        disabled={loadingVideo}
                      >
                        <Text style={[
                          styles.chapterText,
                          { color: selectedChapter === ch ? "#fff" : colors.textPrimary },
                        ]}>
                          {ch}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          />
        </>
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
  headerTitle: { fontSize: 20, fontWeight: "bold", flex: 1, marginHorizontal: 8 },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14 },
  videoContainer: { width: "100%", aspectRatio: 16 / 9 },
  video: { width: "100%", height: "100%" },
  thumbnail: { width: "100%", height: "100%", resizeMode: "cover" },
  thumbnailOverlay: { ...StyleSheet.absoluteFillObject, resizeMode: "cover", zIndex: 1 },
  placeholderVideo: {
    width: "100%", height: "100%",
    justifyContent: "center", alignItems: "center",
  },
  selectText: { marginTop: 12, fontSize: 14 },
  currentInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  currentText: { fontSize: 14, fontWeight: "600" },
  durationText: { fontSize: 12 },
  bookList: { padding: 16, paddingBottom: 32 },
  bookCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 4,
    borderRadius: 10,
    gap: 10,
  },
  bookName: { flex: 1, fontSize: 15, fontWeight: "500" },
  chaptersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingLeft: 30,
    marginBottom: 8,
    gap: 6,
  },
  chapterButton: {
    width: 40,
    height: 36,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  chapterText: { fontSize: 13, fontWeight: "500" },
  segmentsContainer: { marginTop: 4, marginBottom: 8, gap: 6 },
  segmentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
  },
  segmentInfo: { flex: 1 },
  segmentTitle: { fontSize: 14, fontWeight: "600" },
  segmentDuration: { fontSize: 12, marginTop: 2 },
});
