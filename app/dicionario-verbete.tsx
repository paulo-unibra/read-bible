import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../hooks/theme-context";
import bibleReaderService from "../services/BibleReaderService";
import DatabaseService from "../services/DatabaseService";
import dictionaryOfflineService from "../services/DictionaryOfflineService";
import AdBanner from "../components/AdBanner";

interface ContentSegment {
  type: "text" | "bold" | "italic" | "boldItalic" | "verseLink" | "dictLink";
  text: string;
  bookId?: number;
  chapter?: number;
  verse?: number;
  term?: string;
}

interface Verse {
  bookId: number;
  chapterNumber: number;
  verseNumber: number;
  text: string;
}

const BOOK_NAMES = [
  "", "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio",
  "Josué", "Juízes", "Rute", "1 Samuel", "2 Samuel", "1 Reis", "2 Reis",
  "1 Crônicas", "2 Crônicas", "Esdras", "Neemias", "Ester", "Jó",
  "Salmos", "Provérbios", "Eclesiastes", "Cantares", "Isaías", "Jeremias",
  "Lamentações", "Ezequiel", "Daniel", "Oséias", "Joel", "Amós",
  "Obadias", "Jonas", "Miquéias", "Naum", "Habacuque", "Sofonias",
  "Ageu", "Zacarias", "Malaquias", "Mateus", "Marcos", "Lucas", "João",
  "Atos", "Romanos", "1 Coríntios", "2 Coríntios", "Gálatas", "Efésios",
  "Filipenses", "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses",
  "1 Timóteo", "2 Timóteo", "Tito", "Filemom", "Hebreus", "Tiago",
  "1 Pedro", "2 Pedro", "1 João", "2 João", "3 João", "Judas", "Apocalipse",
];

function parseDefinitionHTML(html: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let i = 0;

  function addText(text: string) {
    if (!text) return;
    const parts = text.split(/(\u201c[^\u201d]*\u201d|\u201c[^\u201d]*\u201d|"[^"]*")/);
    for (const part of parts) {
      if (!part) continue;
      if ((part.startsWith('"') && part.endsWith('"')) ||
          (part.startsWith('\u201c') && part.endsWith('\u201d')) ||
          (part.startsWith('\u201c') && part.endsWith('\u201d'))) {
        segments.push({ type: "boldItalic", text: part.slice(1, -1) });
      } else {
        segments.push({ type: "text", text: part });
      }
    }
  }

  while (i < html.length) {
    if (html[i] === "<") {
      const tagEnd = html.indexOf(">", i);
      if (tagEnd === -1) break;
      const tag = html.slice(i, tagEnd + 1);
      i = tagEnd + 1;

      if (tag.startsWith("<a ")) {
        const hrefMatch = tag.match(/href='([^']+)'/);
        const closeEnd = html.indexOf("</a>", i);
        const linkText =
          closeEnd !== -1 ? html.slice(i, closeEnd) : "";
        const href = hrefMatch ? hrefMatch[1] : "";
        i = closeEnd !== -1 ? closeEnd + 4 : i;

        if (href.startsWith("#b")) {
          const parts = href.slice(2).split(".").map(Number);
          segments.push({
            type: "verseLink",
            text: linkText,
            bookId: parts[0],
            chapter: parts[1],
            verse: parts[2],
          });
        } else if (href.startsWith("#d")) {
          segments.push({
            type: "dictLink",
            text: linkText,
            term: href.slice(2),
          });
        }
      } else if (tag === "<strong>" || tag === "<b>") {
        const closeTag = tag === "<strong>" ? "</strong>" : "</b>";
        const closeEnd = html.indexOf(closeTag, i);
        const inner = closeEnd !== -1 ? html.slice(i, closeEnd) : "";
        segments.push({ type: "bold", text: inner });
        i = closeEnd !== -1 ? closeEnd + closeTag.length : i;
      } else if (tag === "<em>" || tag === "<i>") {
        const closeTag = tag === "<em>" ? "</em>" : "</i>";
        const closeEnd = html.indexOf(closeTag, i);
        const inner = closeEnd !== -1 ? html.slice(i, closeEnd) : "";
        segments.push({ type: "italic", text: inner });
        i = closeEnd !== -1 ? closeEnd + closeTag.length : i;
      } else if (
        tag === "<br>" ||
        tag === "<br/>" ||
        tag === "<br />"
      ) {
        addText("\n");
      } else if (tag === "</p>") {
        addText("\n\n");
      } else if (tag === "<li>") {
        addText("\n\u2022 ");
      } else if (tag.startsWith("<img")) {
      } else if (
        tag.startsWith("<") &&
        (tag.startsWith("</") ||
          tag.startsWith("<?") ||
          tag.startsWith("<!") ||
          tag.startsWith("<p") ||
          tag.startsWith("<ul") ||
          tag.startsWith("</ul") ||
          tag.startsWith("<ol") ||
          tag.startsWith("</ol") ||
          tag.startsWith("</li"))
      ) {
      }
    } else {
      let text = "";
      while (i < html.length && html[i] !== "<") {
        text += html[i];
        i++;
      }
      addText(text);
    }
  }

  return segments;
}

function mergeTextSegments(segments: ContentSegment[]): ContentSegment[] {
  const merged: ContentSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.type === "text" &&
      seg.type === "text" &&
      last.text.endsWith("\n\n") &&
      seg.text.startsWith("\n\n")
    ) {
      last.text += seg.text;
    } else {
      merged.push(seg);
    }
  }
  return merged.filter((s) => s.type !== "text" || s.text.length > 0);
}

export default function DicionarioVerbeteScreen() {
  const { colors, isDark } = useTheme();
  const { word: encodedWord, dict: encodedDict } = useLocalSearchParams<{
    word: string;
    dict?: string;
  }>();
  const word = encodedWord ? decodeURIComponent(encodedWord) : "";
  const dictKey = encodedDict ? decodeURIComponent(encodedDict) : undefined;
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<{
    word: string;
    definition: string;
    dictionary?: string;
  } | null>(null);
  const [segments, setSegments] = useState<ContentSegment[]>([]);

  const [verseModalVisible, setVerseModalVisible] = useState(false);
  const [verseLoading, setVerseLoading] = useState(false);
  const [currentVerse, setCurrentVerse] = useState<Verse | null>(null);
  const [currentVerseRef, setCurrentVerseRef] = useState("");

  const [veuDictModalVisible, setVeiuDictModalVisible] = useState(false);
  const [veuDictData, setVeiuDictData] = useState<{
    word: string;
    definition: string;
  } | null>(null);
  const [veuDictLoading, setVeiuDictLoading] = useState(false);

  useEffect(() => {
    loadEntry();
  }, [word]);

  const loadEntry = async () => {
    if (!word) return;
    try {
      setLoading(true);
      let data = await dictionaryOfflineService.getWord(word, dictKey);
      if (!data && dictKey) {
        data = await dictionaryOfflineService.getWord(word);
      }
      if (data) {
        setEntry(data);
        const parsed = parseDefinitionHTML(data.definition);
        const merged = mergeTextSegments(parsed);
        setSegments(merged);
      } else {
        setEntry(null);
      }
    } catch (error) {
      console.error("Erro ao carregar verbete:", error);
    } finally {
      setLoading(false);
    }
  };

  const getBibleId = async (): Promise<string | null> => {
    const preferred = await DatabaseService.getSetting("preferredBibleId");
    if (preferred) return preferred;
    const daily = await DatabaseService.getSetting(
      "lastDailyReadingBibleId"
    );
    if (daily) return daily;
    const bibles = await DatabaseService.getBibles();
    const downloaded = bibles.filter((b) => b.isDownloaded);
    if (downloaded.length > 0) return downloaded[0].id;
    return null;
  };

  const handleVersePress = async (
    bookId: number,
    chapter: number,
    verse: number
  ) => {
    try {
      setVerseLoading(true);
      setVerseModalVisible(true);

      const bibleId = await getBibleId();
      if (!bibleId) {
        Alert.alert(
          "Bíblia não encontrada",
          "Selecione uma Bíblia em Gerenciar Bíblias primeiro."
        );
        setVerseModalVisible(false);
        return;
      }

      const bibles = await DatabaseService.getBibles();
      const bible = bibles.find((b) => b.id === bibleId);
      if (!bible || !bible.fileName) {
        Alert.alert(
          "Bíblia não encontrada",
          "Arquivo da Bíblia não encontrado."
        );
        setVerseModalVisible(false);
        return;
      }

      await bibleReaderService.openBible(bible.id, bible.fileName);
      const verses = await bibleReaderService.getVerses(
        bible.id,
        bookId,
        chapter
      );
      const found = verses.find((v) => v.verseNumber === verse);
      if (found) {
        setCurrentVerse(found);
        const bookName = BOOK_NAMES[bookId] || `Livro ${bookId}`;
        setCurrentVerseRef(
          `${bookName} ${chapter}:${verse}`
        );
      } else {
        setCurrentVerse(null);
        setCurrentVerseRef("");
        Alert.alert(
          "Versículo não encontrado",
          "Não foi possível encontrar este versículo."
        );
        setVerseModalVisible(false);
      }
    } catch (error) {
      console.error("Erro ao carregar versículo:", error);
      Alert.alert("Erro", "Falha ao carregar o versículo.");
      setVerseModalVisible(false);
    } finally {
      setVerseLoading(false);
    }
  };

  const handleDictLinkPress = async (term: string) => {
    try {
      setVeiuDictLoading(true);
      const data = await dictionaryOfflineService.getWord(term);
      if (data) {
        setVeiuDictData(data);
        setVeiuDictModalVisible(true);
      } else {
        Alert.alert(
          "Verbete não encontrado",
          `Não foi possível encontrar: ${term}`
        );
      }
    } catch (error) {
      console.error("Erro ao carregar verbete:", error);
      Alert.alert("Erro", "Falha ao carregar o verbete.");
    } finally {
      setVeiuDictLoading(false);
    }
  };

  const renderSegments = () => {
    return segments.map((seg, index) => {
      switch (seg.type) {
        case "bold":
          return (
            <Text
              key={index}
              style={[styles.contentBold, { color: colors.textPrimary }]}
            >
              {seg.text}
            </Text>
          );
        case "italic":
          return (
            <Text
              key={index}
              style={[styles.contentItalic, { color: colors.textPrimary }]}
            >
              {seg.text}
            </Text>
          );
        case "boldItalic":
          return (
            <Text
              key={index}
              style={[
                styles.contentBoldItalic,
                { color: colors.textPrimary },
              ]}
            >
              {seg.text}
            </Text>
          );
        case "verseLink":
          return (
            <Text
              key={index}
              style={styles.verseLink}
              onPress={() =>
                handleVersePress(
                  seg.bookId!,
                  seg.chapter!,
                  seg.verse!
                )
              }
            >
              {seg.text}
            </Text>
          );
        case "dictLink":
          return (
            <Text
              key={index}
              style={styles.dictLink}
              onPress={() => handleDictLinkPress(seg.term!)}
            >
              {seg.text}
            </Text>
          );
        default:
          return (
            <Text
              key={index}
              style={[styles.contentText, { color: colors.textPrimary }]}
            >
              {seg.text}
            </Text>
          );
      }
    });
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.bg }]}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
          <Text
            style={[styles.headerTitle, { color: colors.textPrimary }]}
          >
            Dicionário
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <AdBanner />
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.bg }]}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
          <Text
            style={[styles.headerTitle, { color: colors.textPrimary }]}
          >
            Dicionário
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons
            name="book-outline"
            size={64}
            color={colors.textSecondary}
          />
          <Text
            style={[
              styles.emptyText,
              { color: colors.textSecondary },
            ]}
          >
            Verbete não encontrado.
          </Text>
        </View>
        <AdBanner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {entry.word}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
      >
        <View
          style={[
            styles.definitionCard,
            { backgroundColor: colors.card },
          ]}
        >
          {entry.dictionary ? (
            <Text
              style={[
                styles.dictionaryLabel,
                { color: colors.primary },
              ]}
            >
              {entry.dictionary}
            </Text>
          ) : null}
          <Text
            style={[styles.definitionText]}
          >
            {renderSegments()}
          </Text>
        </View>
      </ScrollView>

      {/* Verse Modal */}
      <Modal
        visible={verseModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setVerseModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View
              style={[
                styles.modalHeader,
                { backgroundColor: colors.card, borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Referência Bíblica
              </Text>
              <TouchableOpacity onPress={() => setVerseModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {verseLoading ? (
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                  style={{ padding: 20 }}
                />
              ) : currentVerse ? (
                <View>
                  <Text style={[styles.verseRef, { color: colors.accent }]}>
                    {currentVerseRef}
                  </Text>
                  <Text style={[styles.verseText, { color: colors.textPrimary }]}>
                    {currentVerse.text}
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Dictionary Link Modal */}
      <Modal
        visible={veuDictModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setVeiuDictModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View
              style={[
                styles.modalHeader,
                { backgroundColor: colors.card, borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {veuDictData?.word || "Dicionário"}
              </Text>
              <TouchableOpacity onPress={() => setVeiuDictModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {veuDictLoading ? (
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                  style={{ padding: 20 }}
                />
              ) : veuDictData ? (
                <Text style={[styles.verseText, { color: colors.textPrimary }]}>
                  {veuDictData.definition.replace(/<[^>]*>/g, "")}
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    marginHorizontal: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: { marginTop: 12, fontSize: 15, textAlign: "center" },
  scrollContent: { flex: 1 },
  scrollInner: { padding: 16, paddingBottom: 40 },
  definitionCard: {
    borderRadius: 10,
    padding: 16,
  },
  dictionaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  definitionText: {
    fontSize: 15,
    lineHeight: 24,
  },
  contentText: { fontSize: 15, lineHeight: 24 },
  contentBold: { fontSize: 15, lineHeight: 24, fontWeight: "bold" },
  contentItalic: { fontSize: 15, lineHeight: 24, fontStyle: "italic" },
  contentBoldItalic: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "bold",
    fontStyle: "italic",
  },
  verseLink: {
    fontSize: 15,
    lineHeight: 24,
    color: "#2196F3",
    textDecorationLine: "underline",
  },
  dictLink: {
    fontSize: 15,
    lineHeight: 24,
    color: "#4CAF50",
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: 14,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalBody: { padding: 16, maxHeight: 400 },
  verseRef: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  verseText: { fontSize: 15, lineHeight: 24 },
});
