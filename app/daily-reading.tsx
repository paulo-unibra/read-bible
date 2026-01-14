import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IntroductionRenderer } from "../components/IntroductionRenderer";
import authService, { TodayReading } from "../services/AuthService";
import bibleReaderService from "../services/BibleReaderService";
import DatabaseService from "../services/DatabaseService";
import readingPlanService from "../services/ReadingPlanService";

interface ChapterContent {
  bookName: string;
  chapterNumber: number;
  verses: { 
    number: number; 
    text: string;
    verseReferences?: {text: string; reference: string; position: number}[];
    notes?: string[];
  }[];
}

interface Bible {
  id: string;
  name: string;
  abbreviation: string;
  fileName: string;
  isDownloaded: boolean;
}

interface Reference {
  verseNumber: number;
  bookName: string;
  chapterNumber: number;
  text: string;
}

interface Note {
  verseNumber: number;
  bookName: string;
  chapterNumber: number;
  text: string;
}

export default function DailyReadingScreen() {
  const params = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);
  const [chapters, setChapters] = useState<ChapterContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [fontSizePref, setFontSizePref] = useState<"small" | "medium" | "large">("medium");
  const [hasLocalPlan, setHasLocalPlan] = useState(false);
  const [todayDayId, setTodayDayId] = useState<string | null>(null);
  const [dayNumber, setDayNumber] = useState<number | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [readings, setReadings] = useState<TodayReading[]>([]);
  const [availableBibles, setAvailableBibles] = useState<Bible[]>([]);
  const [currentBible, setCurrentBible] = useState<Bible | null>(null);
  const [showBibleSelector, setShowBibleSelector] = useState(false);
  const [changingBible, setChangingBible] = useState(false);
  
  // Estados para referências
  const [currentReferences, setCurrentReferences] = useState<{text: string; reference: string; position: number}[]>([]);
  const [selectedReferenceIndex, setSelectedReferenceIndex] = useState(0);
  const [selectedReferenceVerse, setSelectedReferenceVerse] = useState<any>(null);
  const [selectedReferenceBookName, setSelectedReferenceBookName] = useState("");
  const [referenceVerseLoading, setReferenceVerseLoading] = useState(false);
  const [showAllReferences, setShowAllReferences] = useState(false);
  const [referencesModalVisible, setReferencesModalVisible] = useState(false);
  
  // Estados para notas
  const [currentNotes, setCurrentNotes] = useState<string[]>([]);
  const [notesModalVisible, setNotesModalVisible] = useState(false);

  useEffect(() => {
    loadSettings();
    loadBibles();
  }, []);

  useEffect(() => {
    if (currentBible) {
      loadChapters();
    }
  }, [currentBible]);

  const loadSettings = async () => {
    try {
      const settings = await DatabaseService.getMultipleSettings(["fontSize", "theme"]);
      const userFont = settings.fontSize as "small" | "medium" | "large" | null;
      const userTheme = settings.theme as "light" | "dark" | null;
      if (userFont) setFontSizePref(userFont);
      if (userTheme) setTheme(userTheme);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    }
  };

  const loadBibles = async () => {
    try {
      const bibles = await DatabaseService.getBibles();
      const downloaded = bibles.filter((b) => b.isDownloaded);
      setAvailableBibles(downloaded);

      if (downloaded.length > 0) {
        // Tentar recuperar a última Bíblia usada na leitura diária
        const lastBibleId = await DatabaseService.getSetting("lastDailyReadingBibleId");
        
        if (lastBibleId) {
          const lastBible = downloaded.find((b) => b.id === lastBibleId);
          if (lastBible) {
            setCurrentBible(lastBible);
            return;
          }
        }
        
        // Se não encontrou a última usada, usa a primeira disponível
        setCurrentBible(downloaded[0]);
      } else {
        Alert.alert(
          "Nenhuma Bíblia Disponível",
          "Você precisa baixar pelo menos uma Bíblia.",
          [
            { text: "Cancelar", style: "cancel", onPress: () => router.back() },
            {
              text: "Baixar Bíblias",
              onPress: () => router.push("/bible-manager"),
            },
          ]
        );
      }
    } catch (error) {
      console.error("Erro ao carregar Bíblias:", error);
    }
  };

  const loadChapters = async () => {
    if (!currentBible) return;

    try {
      setLoading(true);
      // Parsear os readings do params
      const readingsParam = params.readings as string;
      const hasLocalPlanParam = params.hasLocalPlan === "true";
      const todayDayIdParam = params.todayDayId as string | undefined;
      const dayNumberParam = params.dayNumber ? parseInt(params.dayNumber as string) : null;

      setHasLocalPlan(hasLocalPlanParam);
      setTodayDayId(todayDayIdParam || null);
      setDayNumber(dayNumberParam);

      if (!readingsParam) {
        Alert.alert("Erro", "Leituras não encontradas");
        router.back();
        return;
      }

      const parsedReadings: TodayReading[] = JSON.parse(readingsParam);
      setReadings(parsedReadings);
      console.log("Readings to load:", parsedReadings);

      await bibleReaderService.openBible(currentBible.id, currentBible.fileName);

      // Carregar todos os capítulos
      const allChapters: ChapterContent[] = [];

      for (const reading of parsedReadings) {
        const books = await bibleReaderService.getBooks(currentBible.id);
        const book = books.find(
          (b) => b.name.toLowerCase() === reading.bookName.toLowerCase()
        );

        if (!book) {
          console.warn(`Livro não encontrado: ${reading.bookName}`);
          continue;
        }

        // Carregar todos os capítulos do range
        for (
          let chapterNum = reading.startChapter;
          chapterNum <= reading.endChapter;
          chapterNum++
        ) {
          const verses = await bibleReaderService.getVerses(
            currentBible.id,
            book.id,
            chapterNum
          );

          allChapters.push({
            bookName: reading.bookName,
            chapterNumber: chapterNum,
            verses: verses.map((v) => ({
              number: v.number,
              text: v.text,
              verseReferences: v.verseReferences,
              notes: v.notes,
            })),
          });
        }
      }

      setChapters(allChapters);
      
      // Reset scroll position when changing bible
      if (scrollViewRef.current && changingBible) {
        scrollViewRef.current.scrollTo({ y: 0, animated: false });
        setScrollProgress(0);
        setHasReachedEnd(false);
        setChangingBible(false);
      }
    } catch (error) {
      console.error("Erro ao carregar capítulos:", error);
      Alert.alert("Erro", "Não foi possível carregar os capítulos");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollPosition = contentOffset.y;
    const scrollViewHeight = layoutMeasurement.height;
    const contentHeight = contentSize.height;

    // Calcular progresso de leitura (0-100)
    const progress = Math.round(
      (scrollPosition / (contentHeight - scrollViewHeight)) * 100
    );
    setScrollProgress(Math.min(100, Math.max(0, progress)));

    // Verificar se chegou ao fim (95% para dar uma margem)
    if (progress >= 95 && !hasReachedEnd) {
      setHasReachedEnd(true);
    }
  };

  const handleMarkComplete = async () => {
    if (markingComplete) {
      console.log('⚠️ [handleMarkComplete] Já está marcando, ignorando...');
      return;
    }

    try {
      console.log('✅ [handleMarkComplete] Iniciando marcação de leitura como concluída');
      console.log('  hasLocalPlan:', hasLocalPlan);
      console.log('  todayDayId:', todayDayId);
      console.log('  dayNumber:', dayNumber);
      
      setMarkingComplete(true);

      if (hasLocalPlan && todayDayId) {
        // Plano local
        console.log('📱 [handleMarkComplete] Marcando plano local, dayId:', todayDayId);
        await readingPlanService.markDayAsCompleted(todayDayId);
        console.log('✅ [handleMarkComplete] Plano local marcado com sucesso');
      } else if (dayNumber) {
        // Plano do backend
        console.log('☁️ [handleMarkComplete] Marcando plano backend, day:', dayNumber);
        const response = await authService.completeDay(dayNumber);
        console.log('📥 [handleMarkComplete] Resposta do backend:', response);
        
        if (!response.success) {
          console.error('❌ [handleMarkComplete] Erro do backend:', response.message);
          Alert.alert("Erro", response.message);
          setMarkingComplete(false);
          return;
        }
        console.log('✅ [handleMarkComplete] Plano backend marcado com sucesso');
      } else {
        console.error('❌ [handleMarkComplete] Nenhum ID de dia ou número de dia disponível');
        Alert.alert("Erro", "ID do dia não encontrado");
        setMarkingComplete(false);
        return;
      }

      console.log('🎉 [handleMarkComplete] Leitura marcada com sucesso, voltando...');
      
      // Resetar estado antes de voltar
      setMarkingComplete(false);
      
      // Voltar para a tela anterior
      console.log('🔙 [handleMarkComplete] Chamando router.back()...');
      
      // Usar setTimeout para garantir que o estado seja atualizado
      setTimeout(() => {
        router.back();
        console.log('✅ [handleMarkComplete] router.back() executado');
      }, 100);
      
      // Alert.alert(
      //   "🎉 Parabéns!",
      //   "Leitura marcada como concluída!\n\nContinue firme em sua jornada de leitura bíblica.",
      //   [
      //     {
      //       text: "Voltar",
      //       style: "default",
      //       onPress: () => router.back(),
      //     },
      //   ]
      // );
    } catch (error) {
      console.error("❌ [handleMarkComplete] Erro ao marcar leitura:", error);
      Alert.alert("Erro", "Não foi possível marcar a leitura como concluída");
      setMarkingComplete(false);
    }
  };

  const handleChangeBible = async (bible: Bible) => {
    try {
      // Salvar a escolha do usuário
      await DatabaseService.saveSetting("lastDailyReadingBibleId", bible.id);
      
      setCurrentBible(bible);
      setShowBibleSelector(false);
      setChangingBible(true);
    } catch (error) {
      console.error("Erro ao salvar preferência de Bíblia:", error);
      // Continua mesmo com erro ao salvar
      setCurrentBible(bible);
      setShowBibleSelector(false);
      setChangingBible(true);
    }
  };

  // Função para abrir modal de referências (similar à tela de Bíblia)
  const openReferencesModal = async (
    references: { text: string; reference: string; position: number }[]
  ) => {
    if (!references || references.length === 0 || !currentBible) return;

    setCurrentReferences(references);
    setSelectedReferenceIndex(0);
    setShowAllReferences(false);
    setReferencesModalVisible(true);

    // Load the first reference immediately
    await loadSelectedReference(0, references);
  };

  const loadSelectedReference = async (
    index: number,
    references?: { text: string; reference: string; position: number }[]
  ) => {
    const refs = references || currentReferences;
    if (index < 0 || index >= refs.length || !currentBible) return;

    try {
      setReferenceVerseLoading(true);
      const verse = await bibleReaderService.getVerseByReference(
        currentBible.id,
        refs[index].reference
      );

      if (verse) {
        setSelectedReferenceVerse(verse);
        setSelectedReferenceIndex(index);
        // Buscar nome do livro
        const books = await bibleReaderService.getBooks(currentBible.id);
        const book = books.find((b) => b.id === verse.bookId);
        if (book) {
          setSelectedReferenceBookName(book.name);
        }
      }
    } catch (error) {
      console.error("Error loading selected reference:", error);
      Alert.alert("Erro", "Falha ao carregar referência do versículo");
    } finally {
      setReferenceVerseLoading(false);
    }
  };

  const selectReference = async (index: number) => {
    if (index === selectedReferenceIndex) return;
    await loadSelectedReference(index);
  };

  // Função para abrir modal de notas (similar à tela de Bíblia)
  const openNotes = (notes: string[]) => {
    setCurrentNotes(notes);
    setNotesModalVisible(true);
  };

  const renderVerseText = (verse: { number: number; text: string; verseReferences?: any[]; notes?: string[] }, bookName: string, chapterNumber: number) => {
    const { text, verseReferences, notes } = verse;
    
    // Usar os mesmos símbolos da tela de leitura da Bíblia: ✚ para referências e ℕ para notas
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    const symbolRegex = /([✚ℕ])/g;
    let match: RegExpExecArray | null;
    
    while ((match = symbolRegex.exec(text)) !== null) {
      // Adicionar texto antes do símbolo
      if (match.index > cursor) {
        parts.push(
          <React.Fragment key={`text-${cursor}`}>
            {text.substring(cursor, match.index)}
          </React.Fragment>
        );
      }
      
      const symbol = match[1];
      
      if (symbol === "✚") {
        // Referência cruzada - usar as referências do verso
        const pos = match.index;
        const refsAtPos = verseReferences?.filter((r) => r.position === pos) || verseReferences || [];
        
        parts.push(
          <Text
            key={`ref-${match.index}`}
            style={styles.referenceMarker}
            onPress={() => refsAtPos.length && openReferencesModal(refsAtPos)}
          >
            {symbol}
          </Text>
        );
      } else if (symbol === "ℕ") {
        // Nota de rodapé - usar as notas do verso
        parts.push(
          <Text
            key={`note-${match.index}`}
            style={styles.noteMarker}
            onPress={() => notes && notes.length && openNotes(notes)}
          >
            {symbol}
          </Text>
        );
      }
      
      cursor = match.index + match[0].length;
    }
    
    // Adicionar texto restante
    if (cursor < text.length) {
      parts.push(
        <React.Fragment key={`tail-${cursor}`}>
          {text.substring(cursor)}
        </React.Fragment>
      );
    }
    
    return <>{parts}</>;
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
    [fontSizePref]
  );

  const isDark = theme === "dark";
  const colors = {
    bg: isDark ? "#121212" : "#f5f5f5",
    headerBg: isDark ? "#1d1d1d" : "#fff",
    border: isDark ? "#2b2b2b" : "#e0e0e0",
    card: isDark ? "#1e1e1e" : "#fff",
    textPrimary: isDark ? "#e0e0e0" : "#333",
    textSecondary: isDark ? "#b0b0b0" : "#666",
    accent: isDark ? "#90caf9" : "#2196F3",
    verseNumber: isDark ? "#64b5f6" : "#1976D2",
    chapterDivider: isDark ? "#2b2b2b" : "#e0e0e0",
    progressBg: isDark ? "#2c2c2c" : "#e0e0e0",
    progressFill: "#4CAF50",
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Carregando leitura...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.textPrimary, fontSize: applyFontScale(18) },
          ]}
        >
          Leitura do Dia
        </Text>
        <TouchableOpacity 
          onPress={() => setShowBibleSelector(true)}
          style={styles.bibleButton}
        >
          <Ionicons name="book" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressContainer, { backgroundColor: colors.progressBg }]}>
        <View
          style={[
            styles.progressBar,
            { backgroundColor: colors.progressFill, width: `${scrollProgress}%` },
          ]}
        />
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {chapters.map((chapter, index) => (
          <View key={`${chapter.bookName}-${chapter.chapterNumber}`}>
            {/* Chapter header */}
            <View
              style={[
                styles.chapterHeader,
                index > 0 && styles.chapterHeaderSpacing,
              ]}
            >
              <Text
                style={[
                  styles.chapterTitle,
                  { color: colors.accent, fontSize: applyFontScale(20) },
                ]}
              >
                {chapter.bookName} {chapter.chapterNumber === 0 ? ' - Introdução' : ` ${chapter.chapterNumber}`}
              </Text>
            </View>

            {/* Introdução ou Verses */}
            {chapter.chapterNumber === 0 && chapter.verses.length > 0 && chapter.verses[0].text ? (
              <View style={styles.introductionContainer}>
                <IntroductionRenderer
                  htmlContent={chapter.verses[0].text}
                  isDark={theme === 'dark'}
                  fontSize={applyFontScale(16)}
                />
              </View>
            ) : (
            <View style={styles.versesContainer}>
              {chapter.verses.map((verse, index) => (
                <View key={verse.number || index} style={styles.verseContainer}>
                  {/* Titles (if any) */}
                  {verse.titles && verse.titles.length > 0 && (
                    <View style={{ marginBottom: 6, marginLeft: 32 }}>
                      {verse.titles.map((title, titleIndex) => {
                        const cleanedTitle = title.text.includes("|") 
                          ? title.text.substring(title.text.lastIndexOf("|") + 1).trim()
                          : title.text;
                        
                        const levelSizes: Record<number, number> = { 1: 16, 2: 15, 3: 14 };
                        const fontSize = levelSizes[title.level] || 16;

                        return (
                          <View key={titleIndex} style={styles.verseTitleContainer}>
                            <Text
                              style={[
                                styles.verseTitle,
                                {
                                  color: colors.accent,
                                  fontSize: applyFontScale(fontSize),
                                  fontWeight: "700",
                                },
                              ]}
                            >
                              {cleanedTitle}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Verse number and text */}
                  <View style={styles.verseRow}>
                    <Text
                      style={[
                        styles.verseNumber,
                        { color: colors.verseNumber, fontSize: applyFontScale(12) },
                      ]}
                    >
                      {verse.number || index + 1}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.verseText, { color: colors.textPrimary, fontSize: applyFontScale(16) }]}>
                        {renderVerseText(verse, chapter.bookName, chapter.chapterNumber)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
            )}

            {/* Divider between chapters */}
            {index < chapters.length - 1 && (
              <View
                style={[
                  styles.chapterDivider,
                  { backgroundColor: colors.chapterDivider },
                ]}
              />
            )}
          </View>
        ))}

        {/* Complete button at the end */}
        {hasReachedEnd && (
          <View style={styles.completeButtonContainer}>
            <TouchableOpacity
              style={[
                styles.completeButton,
                markingComplete && { opacity: 0.7 },
              ]}
              onPress={handleMarkComplete}
              disabled={markingComplete}
            >
              {markingComplete ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              )}
              <Text style={[styles.completeButtonText, { fontSize: applyFontScale(18) }]}>
                {markingComplete ? "Marcando..." : "Marcar como Lida"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Spacing at the end */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Floating progress indicator */}
      {scrollProgress > 0 && scrollProgress < 95 && (
        <View style={styles.progressIndicator}>
          <Text style={styles.progressText}>{scrollProgress}%</Text>
        </View>
      )}

      {/* Bible Selector Modal */}
      <Modal
        visible={showBibleSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBibleSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: colors.textPrimary, fontSize: applyFontScale(20) },
                ]}
              >
                Escolher Versão
              </Text>
              <TouchableOpacity onPress={() => setShowBibleSelector(false)}>
                <Ionicons name="close" size={28} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.bibleList}>
              {availableBibles.map((bible) => (
                <TouchableOpacity
                  key={bible.id}
                  style={[
                    styles.bibleItem,
                    currentBible?.id === bible.id && styles.bibleItemSelected,
                    currentBible?.id === bible.id && {
                      backgroundColor: isDark ? "#2a4a5c" : "#e3f2fd",
                    },
                  ]}
                  onPress={() => handleChangeBible(bible)}
                >
                  <View style={styles.bibleItemContent}>
                    <Text
                      style={[
                        styles.bibleItemName,
                        { color: colors.textPrimary, fontSize: applyFontScale(16) },
                      ]}
                    >
                      {bible.name}
                    </Text>
                    <Text
                      style={[
                        styles.bibleItemAbbr,
                        { color: colors.textSecondary, fontSize: applyFontScale(14) },
                      ]}
                    >
                      {bible.abbreviation}
                    </Text>
                  </View>
                  {currentBible?.id === bible.id && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.downloadMoreButton, { backgroundColor: colors.accent }]}
              onPress={() => {
                setShowBibleSelector(false);
                router.push("/bible-manager");
              }}
            >
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={[styles.downloadMoreText, { fontSize: applyFontScale(16) }]}>
                Baixar Mais Bíblias
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* References Modal */}
      <Modal
        visible={referencesModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setReferencesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.referencesModal, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Referências Bíblicas
              </Text>
              <TouchableOpacity onPress={() => setReferencesModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Reference Links */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.referenceLinksContainer, { backgroundColor: colors.background }]}
              contentContainerStyle={styles.referenceLinksContent}
            >
              <View style={styles.referenceTabs}>
                {currentReferences.length > 6 && !showAllReferences ? (
                  // Compact view for many references
                  <>
                    {currentReferences.slice(0, 4).map((ref, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => selectReference(index)}
                        style={[
                          styles.referenceTabCompact,
                          { backgroundColor: colors.card },
                          index === selectedReferenceIndex && styles.selectedReferenceTab,
                        ]}
                      >
                        <Text
                          style={[
                            styles.referenceTabText,
                            { color: colors.textPrimary },
                            index === selectedReferenceIndex && styles.selectedReferenceTabText,
                          ]}
                        >
                          {ref.text}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.moreReferencesTab, { backgroundColor: colors.card }]}
                      onPress={() => setShowAllReferences(true)}
                    >
                      <Text style={[styles.moreReferencesText, { color: colors.textPrimary }]}>
                        +{currentReferences.length - 4}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  // Normal view for fewer references or when showing all
                  currentReferences.map((ref, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => selectReference(index)}
                      style={[
                        currentReferences.length > 6
                          ? styles.referenceTabCompact
                          : styles.referenceTab,
                        { backgroundColor: colors.card },
                        index === selectedReferenceIndex && styles.selectedReferenceTab,
                      ]}
                    >
                      <Text
                        style={[
                          styles.referenceTabText,
                          { color: colors.textPrimary },
                          index === selectedReferenceIndex && styles.selectedReferenceTabText,
                        ]}
                      >
                        {ref.text}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </ScrollView>

            {/* Reference Content */}
            {referenceVerseLoading ? (
              <View style={styles.referenceLoadingContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
                  Carregando referência...
                </Text>
              </View>
            ) : selectedReferenceVerse ? (
              <View style={styles.referenceContentContainer}>
                <View style={[styles.referenceVerseCard, { backgroundColor: colors.background }]}>
                  <View style={styles.referenceVerseHeader}>
                    <Text style={[styles.referenceVerseTitle, { color: colors.textPrimary }]}>
                      {`${selectedReferenceBookName} ${selectedReferenceVerse.chapterNumber}:${selectedReferenceVerse.verseNumber}`}
                    </Text>
                  </View>
                  <ScrollView
                    showsVerticalScrollIndicator={true}
                    style={{ maxHeight: 400 }}
                    contentContainerStyle={{ paddingBottom: 8 }}
                  >
                    <Text style={[styles.referenceVerseText, { color: colors.textSecondary }]}>
                      {selectedReferenceVerse.text}
                    </Text>
                  </ScrollView>
                </View>
              </View>
            ) : (
              <View style={styles.referenceErrorContainer}>
                <Text style={[styles.referenceErrorText, { color: colors.textSecondary }]}>
                  Versículo não encontrado.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Notes Modal */}
      <Modal
        visible={notesModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setNotesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.notesModal, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <View style={styles.infoModalTitleContainer}>
                <Ionicons name="document-text-outline" size={24} color="#FF9800" />
                <Text style={[styles.modalTitle, { color: colors.textPrimary, fontSize: applyFontScale(18) }]}>
                  Notas de Rodapé
                </Text>
              </View>
              <TouchableOpacity onPress={() => setNotesModalVisible(false)}>
                <Ionicons name="close" size={28} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.infoModalScroll}>
              {currentNotes.map((note, index) => (
                <View key={index} style={styles.noteItem}>
                  <Text
                    style={[
                      styles.infoModalText,
                      { color: colors.textPrimary, fontSize: applyFontScale(16) },
                    ]}
                  >
                    {note}
                  </Text>
                  {index < currentNotes.length - 1 && (
                    <View style={[styles.noteSeparator, { backgroundColor: colors.border }]} />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  bibleButton: {
    padding: 4,
  },
  progressContainer: {
    height: 3,
    backgroundColor: "#e0e0e0",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#4CAF50",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  chapterHeader: {
    marginBottom: 16,
  },
  chapterHeaderSpacing: {
    marginTop: 32,
  },
  chapterTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2196F3",
  },
  versesContainer: {
    gap: 12,
  },
  verseContainer: {
    marginBottom: 4,
  },
  verseTitleContainer: {
    marginBottom: 5,
  },
  verseTitle: {
    fontWeight: "bold",
  },
  verseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  verseNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1976D2",
    marginRight: 8,
    marginTop: 2,
    minWidth: 24,
  },
  verseText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
  },
  referenceMarker: {
    color: "#2196F3",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  noteMarker: {
    color: "#FF9800",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  chapterDivider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 24,
  },
  introductionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  completeButtonContainer: {
    marginTop: 32,
    alignItems: "center",
  },
  completeButton: {
    backgroundColor: "#4CAF50",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  completeButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
  },
  progressIndicator: {
    position: "absolute",
    bottom: 50,
    right: 20,
    backgroundColor: "rgba(33, 150, 243, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  progressText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  bibleList: {
    padding: 16,
  },
  bibleItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "rgba(0, 0, 0, 0.02)",
  },
  bibleItemSelected: {
    backgroundColor: "#e3f2fd",
    borderWidth: 2,
    borderColor: "#2196F3",
  },
  bibleItemContent: {
    flex: 1,
  },
  bibleItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  bibleItemAbbr: {
    fontSize: 14,
    color: "#666",
  },
  downloadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2196F3",
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  downloadMoreText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  infoModalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    margin: 20,
    maxHeight: "70%",
  },
  infoModalTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoModalScroll: {
    padding: 20,
  },
  infoModalBody: {
    gap: 12,
  },
  infoModalVerse: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  infoModalText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
  },
  // Estilos para modal de referências
  referencesModal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    margin: 20,
    maxHeight: "80%",
    overflow: "hidden",
  },
  referenceLinksContainer: {
    maxHeight: 80,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  referenceLinksContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  referenceTabs: {
    flexDirection: "row",
    gap: 8,
  },
  referenceTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  referenceTabCompact: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  selectedReferenceTab: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  referenceTabText: {
    fontSize: 14,
    color: "#333",
  },
  selectedReferenceTabText: {
    color: "#fff",
    fontWeight: "600",
  },
  moreReferencesTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  moreReferencesText: {
    fontSize: 14,
    color: "#2196F3",
    fontWeight: "600",
  },
  referenceLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  referenceContentContainer: {
    flex: 1,
    padding: 16,
  },
  referenceVerseCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
  },
  referenceVerseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  referenceVerseTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  referenceVerseText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#666",
  },
  referenceErrorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  referenceErrorText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  // Estilos para modal de notas
  notesModal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    margin: 20,
    maxHeight: "70%",
  },
  noteItem: {
    marginBottom: 16,
  },
  noteSeparator: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginTop: 16,
  },
});
