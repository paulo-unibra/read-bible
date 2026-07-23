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

interface BookChapter {
  bookId: string;
  bookName: string;
  chapter: number;
}

const BOOKS_NT = [
  { id: "MAT", name: "Mateus" }, { id: "MRK", name: "Marcos" },
  { id: "LUK", name: "Lucas" }, { id: "JHN", name: "João" },
  { id: "ACT", name: "Atos" }, { id: "ROM", name: "Romanos" },
  { id: "1CO", name: "1 Coríntios" }, { id: "2CO", name: "2 Coríntios" },
  { id: "GAL", name: "Gálatas" }, { id: "EPH", name: "Efésios" },
  { id: "PHP", name: "Filipenses" }, { id: "COL", name: "Colossenses" },
  { id: "1TH", name: "1 Tessalonicenses" }, { id: "2TH", name: "2 Tessalonicenses" },
  { id: "1TI", name: "1 Timóteo" }, { id: "2TI", name: "2 Timóteo" },
  { id: "TIT", name: "Tito" }, { id: "PHM", name: "Filemom" },
  { id: "HEB", name: "Hebreus" }, { id: "JAS", name: "Tiago" },
  { id: "1PE", name: "1 Pedro" }, { id: "2PE", name: "2 Pedro" },
  { id: "1JN", name: "1 João" }, { id: "2JN", name: "2 João" },
  { id: "3JN", name: "3 João" }, { id: "JUD", name: "Judas" },
  { id: "REV", name: "Apocalipse" },
];

export default function VideoPlayerScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const bibleId = params.bibleId as string;
  const bibleName = params.bibleName as string;

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [availableChapters, setAvailableChapters] = useState<number[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [availableBooks, setAvailableBooks] = useState<BookChapter[]>([]);
  const [checkingBooks, setCheckingBooks] = useState(true);
  const [showThumbnail, setShowThumbnail] = useState(true);

  const player = useVideoPlayer(videoUrl ? { uri: videoUrl } : null, (player) => {
    player.loop = false;
    player.audioMixingMode = "auto";
  });

  useEffect(() => {
    if (videoUrl) {
      player.replace({ uri: videoUrl });
      player.play();
    }
  }, [videoUrl]);

  useEffect(() => {
    discoverAvailableBooks();
  }, []);

  const discoverAvailableBooks = async () => {
    setCheckingBooks(true);
    const found: BookChapter[] = [];

    for (const book of BOOKS_NT) {
      for (const ch of [1, 2, 3]) {
        try {
          const info = await bibleBrainService.getVideoChapterUrl(bibleId, book.id, ch);
          found.push({ bookId: book.id, bookName: book.name, chapter: ch });
          break;
        } catch {
          continue;
        }
      }
    }
    setAvailableBooks(found);
    setCheckingBooks(false);
  };

  const loadChapter = async (bookId: string, chapter: number) => {
    try {
      setLoadingVideo(true);
      setSelectedBook(bookId);
      setSelectedChapter(chapter);
      setShowThumbnail(true);
      const info = await bibleBrainService.getVideoChapterUrl(bibleId, bookId, chapter);
      setVideoUrl(info.url);
      setThumbnail(info.thumbnail);
      setDuration(info.duration);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível carregar este vídeo");
    } finally {
      setLoadingVideo(false);
    }
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
                {BOOKS_NT.find((b) => b.id === selectedBook)?.name || selectedBook} - Capítulo {selectedChapter}
              </Text>
              {duration > 0 && (
                <Text style={[styles.durationText, { color: colors.textSecondary }]}>
                  {Math.floor(duration / 60)}:{(Math.floor(duration) % 60).toString().padStart(2, "0")}
                </Text>
              )}
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
                    setAvailableChapters(Array.from({ length: 28 }, (_, i) => i + 1));
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
                          selectedChapter === ch && { backgroundColor: colors.primary },
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
    borderColor: "#ddd",
  },
  chapterText: { fontSize: 13, fontWeight: "500" },
});
