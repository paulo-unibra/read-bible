import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import AudioPlayer from "../components/AudioPlayer";
import { IntroductionRenderer } from "../components/IntroductionRenderer";
import QuizButton from "../components/QuizButton";
import AudioService from "../services/AudioService";
import AuthService from "../services/AuthService";
import bibleReaderService from "../services/BibleReaderService";
import DatabaseService from "../services/DatabaseService";
import googleDriveService from "../services/GoogleDriveService";
import NotesService from "../services/NotesService";
import {
    Bible,
    Book,
    BookIntroduction,
    DriveFile,
    SearchResult,
    Verse,
} from "../types";

export default function ChapterReaderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [chaptersForSelectedBook, setChaptersForSelectedBook] = useState<
    number[]
  >([]);

  const [selectedBookInModal, setSelectedBookInModal] = useState<Book | null>(
    null,
  );

  const bibleId = params.bibleId as string;
  const initialBookId = parseInt(params.bookId as string);
  const initialChapter = parseInt(params.chapterNumber as string);

  const [bibleAbbrev, setBibleAbbrev] = useState<string>("");
  const [book, setBook] = useState<Book | null>(null);
  const [currentBookId, setCurrentBookId] = useState(initialBookId);
  const [currentChapter, setCurrentChapter] = useState(initialChapter);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [bookIntroduction, setBookIntroduction] =
    useState<BookIntroduction | null>(null);
  const [totalChapters, setTotalChapters] = useState(0);
  const [loading, setLoading] = useState(true); // Loading inicial completo
  const [initializing, setInitializing] = useState(true);
  const [lastLoadedChapter, setLastLoadedChapter] = useState<number | null>(
    null,
  );
  const [chapterLoading, setChapterLoading] = useState(false); // Loading apenas para troca de capítulo

  const [navigating, setNavigating] = useState(false); // Prevent rapid navigation
  const [isFirstOfBible, setIsFirstOfBible] = useState(false);
  const [isLastOfBible, setIsLastOfBible] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [currentNarratedVerse, setCurrentNarratedVerse] = useState<
    number | null
  >(null);
  const versesListRef = useRef<FlatList>(null);

  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTestamentFilter, setSearchTestamentFilter] = useState<
    "all" | "ot" | "nt"
  >("all");
  const [rawSearchResults, setRawSearchResults] = useState<
    SearchResult[] | null
  >(null);
  const [searchCounts, setSearchCounts] = useState<{
    all: number;
    ot: number;
    nt: number;
  }>({ all: 0, ot: 0, nt: 0 });
  const [bookTestamentMap, setBookTestamentMap] = useState<Map<
    number,
    "old" | "new"
  > | null>(null);

  const buildTestamentMap = (booksList: Book[]): Map<number, "old" | "new"> => {
    const map = new Map<number, "old" | "new">();
    if (!booksList || booksList.length === 0) return map;
    const oldCount = booksList.filter((b) => b.testament === "old").length;
    const newCount = booksList.filter((b) => b.testament === "new").length;
    if (oldCount > 0 && newCount > 0) {
      booksList.forEach((b) => map.set(b.id, b.testament));
      return map;
    }
    let newStartIndex = booksList.findIndex((b) =>
      /Mateus|Matthew/i.test(b.name),
    );
    if (newStartIndex === -1) {
      if (booksList.length >= 66) newStartIndex = 39;
      else newStartIndex = Math.round(booksList.length * 0.6);
    }
    booksList.forEach((b, idx) =>
      map.set(b.id, idx < newStartIndex ? "old" : "new"),
    );
    return map;
  };

  // Bible selector modal state
  const [bibleSelectorVisible, setBibleSelectorVisible] = useState(false);
  const [availableBibles, setAvailableBibles] = useState<Bible[]>([]);
  const [availableDriveBibles, setAvailableDriveBibles] = useState<DriveFile[]>(
    [],
  );
  const [downloading, setDownloading] = useState<string | null>(null);
  // const [downloadProgress, setDownloadProgress] = useState<string>("");

  // Book selector modal state
  const [bookSelectorVisible, setBookSelectorVisible] = useState(false);
  const [availableBooks, setAvailableBooks] = useState<Book[]>([]);

  // Verse note modal state
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [isEditingExistingNote, setIsEditingExistingNote] = useState(false);
  const [isViewOnlyMode, setIsViewOnlyMode] = useState(false);
  const [isNotePrivate, setIsNotePrivate] = useState(true);
  const [textSelection, setTextSelection] = useState({ start: 0, end: 0 });
  const noteInputRef = useRef<TextInput>(null);

  // Verse notes tracking
  const [verseNotes, setVerseNotes] = useState<Map<string, string>>(new Map());

  // Notes modal state
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [currentNotes, setCurrentNotes] = useState<string[]>([]);

  // Verse reference modal state (for single reference display)
  const [verseRefModalVisible, setVerseRefModalVisible] = useState(false);
  const [currentVerseRef, setCurrentVerseRef] = useState<Verse | null>(null);
  const [currentVerseRefBookName, setCurrentVerseRefBookName] =
    useState<string>("");
  const [verseRefLoading, setVerseRefLoading] = useState(false);

  // References modal state
  const [referencesModalVisible, setReferencesModalVisible] = useState(false);
  const [currentReferences, setCurrentReferences] = useState<
    { text: string; reference: string; position: number }[]
  >([]);
  const [selectedReferenceIndex, setSelectedReferenceIndex] = useState(0);
  const [selectedReferenceVerse, setSelectedReferenceVerse] =
    useState<Verse | null>(null);
  const [selectedReferenceBookName, setSelectedReferenceBookName] =
    useState<string>("");
  const [referenceVerseLoading, setReferenceVerseLoading] = useState(false);
  const [showAllReferences, setShowAllReferences] = useState(false);

  // Reader Preferences (fonte e tema)
  const [readerFontSize, setReaderFontSize] = useState<
    "small" | "medium" | "large"
  >("medium");
  const [readerTheme, setReaderTheme] = useState<"light" | "dark">("light");
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // Verse options bottom sheet state
  const [verseOptionsVisible, setVerseOptionsVisible] = useState(false);
  const [selectedVerseForOptions, setSelectedVerseForOptions] =
    useState<Verse | null>(null);
  const [verseHighlighted, setVerseHighlighted] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<
    string | null
  >(null);

  // Verse highlights storage - key: "bookId-chapter-verse", value: color
  const [verseHighlights, setVerseHighlights] = useState<
    Record<string, string>
  >({});

  // Highlight colors available
  const highlightColors = [
    { id: "yellow", color: "#FFF59D", label: "Amarelo" },
    { id: "green", color: "#A5D6A7", label: "Verde" },
    { id: "blue", color: "#90CAF9", label: "Azul" },
    { id: "pink", color: "#F48FB1", label: "Rosa" },
    { id: "purple", color: "#CE93D8", label: "Roxo" },
    { id: "orange", color: "#FFCC80", label: "Laranja" },
  ];

  useEffect(() => {
    (async () => {
      try {
        const settings = await DatabaseService.getMultipleSettings([
          "fontSize",
          "theme",
        ]);
        const fs = settings.fontSize as "small" | "medium" | "large" | null;
        const th = settings.theme as "light" | "dark" | null;
        if (fs) setReaderFontSize(fs);
        if (th) setReaderTheme(th);
      } catch (e) {
        console.warn("Falha ao carregar preferências de leitura", e);
      }
    })();

    // Carregar destaques de versículos
    loadVerseHighlights();
  }, []);

  const applyFontScale = (base: number) => {
    switch (readerFontSize) {
      case "small":
        return base * 0.9;
      case "large":
        return base * 1.2;
      default:
        return base;
    }
  };

  const isDark = readerTheme === "dark";
  // Paleta ajustada para suavizar o branco e links no modo escuro
  const colorScheme = {
    verseText: isDark ? "#d4d4d4" : "#333",
    verseNumber: isDark ? "#7fb4e8" : "#2196F3",
    refSymbol: isDark ? "#6fa87b" : "#1b5e20",
    noteSymbol: isDark ? "#6a8fbf" : "#1565c0",
    dash: isDark ? "#b0b0b0" : "#222",
    icon: isDark ? "#e0e6ed" : "#2196F3", // ícone claro suave no dark
    iconInactive: isDark ? "#b0b6bd" : "#666", // ícone inativo no dark
  } as const;
  const verseTextDynamic = {
    fontSize: applyFontScale(16),
    color: colorScheme.verseText,
    lineHeight: applyFontScale(24),
  } as const;
  const screenBackground = { backgroundColor: isDark ? "#121212" : "#f5f5f5" };
  const versesListBg = { backgroundColor: isDark ? "#121212" : "#fff" };
  const headerBg = {
    backgroundColor: isDark ? "#1d1d1d" : "#fff",
    borderBottomColor: isDark ? "#2b2b2b" : "#e0e0e0",
  };
  const chapterHeaderBg = { backgroundColor: isDark ? "#1d1d1d" : "#fff" };
  const iconColor = colorScheme.icon;

  const openSettings = () => setSettingsModalVisible(true);
  const closeSettings = () => setSettingsModalVisible(false);
  const saveSettings = async (
    fs: "small" | "medium" | "large",
    theme: "light" | "dark",
  ) => {
    try {
      setReaderFontSize(fs);
      setReaderTheme(theme);
      await DatabaseService.saveSetting("fontSize", fs);
      await DatabaseService.saveSetting("theme", theme);
    } catch (e) {
      console.error("Erro salvando preferências:", e);
      Alert.alert("Erro", "Falha ao salvar preferências");
    }
  };

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState<Set<string>>(new Set());

  const HEADER_HEIGHT = 38;

  const loadChapterVerses = React.useCallback(async () => {
    if (!bibleId || !currentBookId) return;

    try {
      // Se for capítulo 0, carregamos a introdução
      if (currentChapter === 0) {
        const introduction = await bibleReaderService.getBookIntroduction(
          bibleId,
          currentBookId,
        );
        setBookIntroduction(introduction);
        setVerses([]); // Limpa os versículos pois é introdução
      } else {
        // Capítulo normal - carrega versículos
        setBookIntroduction(null); // Limpa introdução
        const versesData = await bibleReaderService.getVerses(
          bibleId,
          currentBookId,
          currentChapter,
        );
        console.log(
          "[getVerses] Retornou:",
          versesData?.length || 0,
          "versículos para capítulo",
          currentChapter,
        );
        setVerses(versesData);
      }
    } catch (error) {
      console.error("Error loading chapter content:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Alert.alert(
        "Erro",
        `Falha ao carregar conteúdo do capítulo: ${errorMessage}`,
      );
    }
  }, [bibleId, currentBookId, currentChapter]);

  // Load verse notes for current chapter
  const loadVerseNotes = React.useCallback(async () => {
    if (!currentBookId || currentChapter === null) return;

    try {
      console.log("🔍 [loadVerseNotes] Carregando notas para:", {
        currentBookId,
        currentChapter,
      });

      const notes = await NotesService.getNotesByChapter(
        currentBookId,
        currentChapter,
      );

      console.log("📝 [loadVerseNotes] Notas recebidas:", notes.length);

      const notesMap = new Map<string, string>();

      notes.forEach((note) => {
        try {
          // Armazenar apenas o primeiro versículo da nota
          // Isso garante que o ícone apareça apenas uma vez

          console.log(
            "🔍 [loadVerseNotes] Processando nota:",
            note.id,
            "verseNumbers tipo:",
            typeof note.verseNumbers,
            "valor:",
            note.verseNumbers,
          );

          // Garantir que verseNumbers é um array
          let verseNumbers: number[];

          if (Array.isArray(note.verseNumbers)) {
            verseNumbers = note.verseNumbers;
          } else if (typeof note.verseNumbers === "string") {
            try {
              const parsed = JSON.parse(note.verseNumbers);
              verseNumbers = Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
              console.error(
                "❌ [loadVerseNotes] Erro ao parsear verseNumbers:",
                e,
              );
              return; // Pula esta nota
            }
          } else if (typeof note.verseNumbers === "number") {
            verseNumbers = [note.verseNumbers];
          } else {
            console.error(
              "❌ [loadVerseNotes] Formato inválido de verseNumbers:",
              note.verseNumbers,
            );
            return; // Pula esta nota
          }

          console.log(
            "✅ [loadVerseNotes] verseNumbers parseado:",
            verseNumbers,
          );

          const firstVerse = Math.min(...verseNumbers);
          const key = `${note.bookId}-${note.chapterNumber}-${firstVerse}`;

          console.log(
            "🔑 [loadVerseNotes] Criando chave:",
            key,
            "para nota ID:",
            note.id,
          );

          notesMap.set(key, note.id.toString()); // Armazena o ID da nota, não o texto
        } catch (noteError) {
          console.error(
            "❌ [loadVerseNotes] Erro ao processar nota individual:",
            noteError,
          );
        }
      });

      console.log(
        "✅ [loadVerseNotes] Map criado com",
        notesMap.size,
        "entradas",
      );
      console.log("🗺️ [loadVerseNotes] Chaves:", Array.from(notesMap.keys()));

      setVerseNotes(notesMap);
    } catch (error) {
      console.error("❌ [loadVerseNotes] Error loading verse notes:", error);
    }
  }, [currentBookId, currentChapter]);

  const checkAudioAvailability = React.useCallback(async () => {
    if (
      !currentBookId ||
      currentChapter === null ||
      currentChapter === undefined
    )
      return;
    try {
      const available = await AudioService.isAudioAvailable(
        currentBookId,
        currentChapter,
      );
      setAudioAvailable(available);
    } catch (error) {
      console.log("Error checking audio availability:", error);
      setAudioAvailable(false);
    }
  }, [currentBookId, currentChapter]);

  const updateNavigationState = React.useCallback(
    async (newChapter?: number) => {
      try {
        const books = await bibleReaderService.getBooks(bibleId);
        const firstBook = books[0];
        const lastBook = books[books.length - 1];
        const chapter = newChapter || currentChapter;

        let isFirstOfBible = false;
        if (currentBookId === firstBook?.id) {
          const chapters = await bibleReaderService.getChapters(
            bibleId,
            firstBook.id,
          );
          const hasIntroduction = chapters.some((ch) => ch.chapterNumber === 0);
          const firstChapter = hasIntroduction ? 0 : 1;
          isFirstOfBible = chapter === firstChapter;
        }
        setIsFirstOfBible(isFirstOfBible);

        // Verificar se é o último da Bíblia
        if (currentBookId === lastBook?.id) {
          const chapters = await bibleReaderService.getChapters(
            bibleId,
            lastBook.id,
          );
          const atLastOfBible =
            chapter === chapters[chapters.length - 1]?.chapterNumber;
          setIsLastOfBible(atLastOfBible);
        } else {
          setIsLastOfBible(false);
        }
      } catch (error) {
        console.error("Error updating navigation state:", error);
      }
    },
    [bibleId, currentBookId, currentChapter],
  );

  const initializeReader = React.useCallback(async () => {
    try {
      setLoading(true);

      const bibles = await DatabaseService.getBibles();
      const currentBible = bibles.find((b) => b.id === bibleId);
      if (!currentBible) throw new Error("Bible not found");
      setBibleAbbrev(currentBible.abbreviation || "");

      await bibleReaderService.openBible(bibleId, currentBible.fileName);

      const books = await bibleReaderService.getBooks(bibleId);
      const currentBook = books.find((b) => b.id === currentBookId);
      if (!currentBook) throw new Error("Book not found");
      setBook(currentBook);

      const chapters = await bibleReaderService.getChapters(
        bibleId,
        currentBookId,
      );
      // Calcular totalChapters corretamente: se tem introdução (capítulo 0), remove 1 do length
      const hasIntroduction = chapters.some((ch) => ch.chapterNumber === 0);
      const actualTotalChapters = hasIntroduction
        ? chapters.length - 1
        : chapters.length;
      setTotalChapters(actualTotalChapters);

      // Load initial verses - use the current chapter state
      const chapterToLoad = currentChapter ?? initialChapter ?? 1;

      const versesData = await bibleReaderService.getVerses(
        bibleId,
        currentBookId,
        chapterToLoad,
      );
      setVerses(versesData);

      // Update navigation state and check audio availability
      await updateNavigationState();
      await checkAudioAvailability();
      await loadVerseNotes();

      // Save reading position (non-blocking)
      DatabaseService.saveLastReading(
        bibleId,
        currentBookId,
        chapterToLoad,
      ).catch((error) => {
        console.warn(
          "[DEBUG] Erro ao salvar posição de leitura (não crítico):",
          error,
        );
        // Don't show alert for this non-critical operation
      });
    } catch (error) {
      console.error("Error initializing reader:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Alert.alert("Erro", `Falha ao carregar capítulo: ${errorMessage}`);
      router.back();
    } finally {
      setLoading(false);
    }
  }, [
    bibleId,
    currentBookId,
    currentChapter,
    initialChapter,
    router,
    updateNavigationState,
    checkAudioAvailability,
  ]);

  useEffect(() => {
    // Só inicializar completamente quando mudar a Bíblia ou o livro, não o capítulo
    if (bibleId && currentBookId) {
      initializeReader();
    }
  }, [bibleId, currentBookId, initializeReader]);

  // Função para carregar dados do capítulo
  const loadChapterData = useCallback(
    async (isInitialLoad: boolean = false) => {
      console.log("🔄 loadChapterData CHAMADA:");
      console.log("  isInitialLoad:", isInitialLoad);
      console.log("  bibleId:", bibleId);
      console.log("  currentBookId:", currentBookId);
      console.log("  currentChapter:", currentChapter);
      console.log("  book:", book?.name);
      console.log("  lastLoadedChapter:", lastLoadedChapter);

      // Validar se temos todos os dados necessários
      if (
        !bibleId ||
        !currentBookId ||
        currentChapter === null ||
        currentChapter === undefined ||
        !book
      ) {
        console.log("❌ Retornando - dados incompletos");
        return;
      }

      // Verificar se já carregamos este capítulo (exceto na inicialização)
      if (!isInitialLoad && lastLoadedChapter === currentChapter) {
        console.log("⏭️ Capítulo já carregado, pulando...");
        return;
      }

      console.log(
        "✅ Carregando capítulo",
        currentChapter,
        "do livro",
        book.name,
      );

      // Se for carregamento inicial, usa loading completo; se for navegação, usa chapterLoading
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setChapterLoading(true);
      }

      try {
        await loadChapterVerses();
        await checkAudioAvailability();
        await loadVerseNotes();
        setLastLoadedChapter(currentChapter);
        console.log("✅ Capítulo carregado com sucesso!");

        // Salvar a última posição de leitura
        DatabaseService.saveLastReading(
          bibleId,
          currentBookId,
          currentChapter,
        ).catch((error) => {
          console.warn("Failed to save last reading position:", error);
        });
      } catch (error) {
        console.error("Error loading chapter data:", error);
      } finally {
        if (isInitialLoad) {
          setLoading(false);
          setInitializing(false);
        } else {
          setChapterLoading(false);
        }
      }
    },
    [
      bibleId,
      currentBookId,
      currentChapter,
      book,
      lastLoadedChapter,
      loadChapterVerses,
      checkAudioAvailability,
    ],
  );

  // Efeito para inicialização
  useEffect(() => {
    console.log("🔵 useEffect INICIALIZAÇÃO:");
    console.log("  initializing:", initializing);
    console.log("  currentChapter:", currentChapter);
    if (initializing && (currentChapter || currentChapter === 0)) {
      console.log("✅ Carregando dados iniciais...");
      loadChapterData(true);
    }
  }, [initializing, currentChapter, loadChapterData]);

  // Efeito para navegação entre capítulos
  useEffect(() => {
    console.log("🟢 useEffect NAVEGAÇÃO:");
    console.log("  initializing:", initializing);
    console.log("  currentChapter:", currentChapter);
    console.log("  lastLoadedChapter:", lastLoadedChapter);
    console.log(
      "  currentChapter !== lastLoadedChapter:",
      currentChapter !== lastLoadedChapter,
    );

    if (
      !initializing &&
      currentChapter !== null &&
      currentChapter !== undefined &&
      currentChapter !== lastLoadedChapter
    ) {
      console.log("✅ Carregando novo capítulo...");
      loadChapterData(false);
    } else {
      console.log("⏭️ Pulando - condições não atendidas");
    }
  }, [currentChapter, initializing, lastLoadedChapter, loadChapterData]);

  useEffect(() => {
    return () => {
      AudioService.cleanup();
    };
  }, []);

  // Configurar total de versículos no AudioService quando carregar o capítulo
  // DESATIVADO: Sincronização de versículos com áudio
  /*
  useEffect(() => {
    if (verses.length > 0 && currentChapter > 0) {
      AudioService.setTotalVerses(verses.length);
      // Buscar timestamps sincronizados do backend
      AudioService.fetchVerseTimestamps(currentBookId, currentChapter);
    }
  }, [verses, currentChapter, currentBookId]);
  */

  // Escutar mudanças no AudioService para atualizar versículo atual
  // DESATIVADO: Sincronização de versículos com áudio
  /*
  useEffect(() => {
    const unsubscribe = AudioService.addListener((state) => {
      if (
        state.currentBookId === currentBookId &&
        state.currentChapter === currentChapter &&
        state.isPlaying
      ) {
        setCurrentNarratedVerse(state.currentVerseNumber);
      } else {
        setCurrentNarratedVerse(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentBookId, currentChapter]);
  */

  // Auto-scroll para o versículo sendo narrado
  // DESATIVADO: Sincronização de versículos com áudio
  /*
  useEffect(() => {
    if (currentNarratedVerse && verses.length > 0 && versesListRef.current) {
      const index = verses.findIndex(v => v.verseNumber === currentNarratedVerse);
      if (index >= 0) {
        try {
          versesListRef.current.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.3, // Posiciona o versículo a 30% da tela
          });
        } catch (error) {
          // Fallback se scrollToIndex falhar
          console.log("Auto-scroll error:", error);
        }
      }
    }
  }, [currentNarratedVerse, verses]);
  */

  // Monitorar mudanças no estado do modal da Bíblia
  useEffect(() => {
    console.log("bibleSelectorVisible changed to:", bibleSelectorVisible);
  }, [bibleSelectorVisible]);

  // Recarregar notas quando a tela recebe foco (volta de note-editor)
  useFocusEffect(
    useCallback(() => {
      if (!initializing && currentBookId && currentChapter) {
        console.log("🔄 Tela recebeu foco - recarregando notas");
        loadVerseNotes();
      }
    }, [currentBookId, currentChapter, initializing, loadVerseNotes]),
  );

  // Função para testar download (desenvolvimento) - DESABILITADA
  /*
  const testDownload = async (driveFile: DriveFile) => {
    console.log("Testing download simulation for:", driveFile.name);
    setDownloading(driveFile.id);
    
    try {
      // Simular delay de download
      await new Promise(resolve => setTimeout(resolve, 3000));
      await new Promise(resolve => setTimeout(resolve, 1000));
      await new Promise(resolve => setTimeout(resolve, 500));
      
      Alert.alert("Sucesso", "Download simulado com sucesso!");
    } catch (error) {
      Alert.alert("Erro", "Falha na simulação");
    } finally {
      setDownloading(null);
    }
  };
  */

  // Função para diagnóstico do banco de dados
  const diagnoseDatabaseIssue = async () => {
    try {
      console.log("=== DATABASE DIAGNOSIS START ===");

      // Testar conexão básica
      console.log("Testing basic database connection...");
      const testStart = Date.now();
      const bibles = await DatabaseService.getBibles();
      const testEnd = Date.now();
      console.log(`Database query took: ${testEnd - testStart}ms`);
      console.log("Current bibles in database:", bibles.length);

      // Testar operação de salvar simples
      console.log("Testing simple save operation...");
      const testBible = {
        id: "test-bible-" + Date.now(),
        name: "Test Bible",
        abbreviation: "TST",
        fileName: "test.db",
        isDownloaded: true,
      };

      const saveStart = Date.now();
      await DatabaseService.saveBible(testBible);
      const saveEnd = Date.now();
      console.log(`Save operation took: ${saveEnd - saveStart}ms`);

      console.log("=== DATABASE DIAGNOSIS END ===");
      Alert.alert(
        "Diagnóstico",
        "Check console for database diagnosis results",
      );
    } catch (error) {
      console.error("Database diagnosis failed:", error);
      Alert.alert(
        "Erro",
        "Falha no diagnóstico do banco: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  };

  // Função alternativa para forçar a abertura do modal
  const forceOpenBibleSelector = async () => {
    console.log("forceOpenBibleSelector called - forcing modal open");

    // Criar uma bíblia básica se não houver dados
    const basicBible = {
      id: bibleId || "basic",
      abbreviation: bibleAbbrev || "BEP",
      name: "Bíblia Atual",
      description: "Versão atualmente em uso",
      fileName: "",
      isDownloaded: true,
    };

    setAvailableBibles([basicBible]);
    setBibleSelectorVisible(true);

    // Tentar carregar bíblias do Drive em background
    try {
      console.log("Loading Drive bibles...");
      const driveFiles = await googleDriveService.listBibleFiles();
      console.log("Found Drive bibles:", driveFiles.length);
      setAvailableDriveBibles(driveFiles);
    } catch (error) {
      console.log("Failed to load Drive bibles:", error);
      setAvailableDriveBibles([]);
    }
  };

  const navigateChapter = async (direction: "prev" | "next") => {
    if (navigating) {
      console.log("Navigation blocked - already navigating");
      return;
    }

    console.log("Starting navigation:", direction);
    setNavigating(true);

    try {
      let newChapter = currentChapter;

      console.log(
        "currentChapter:",
        currentChapter,
        "totalChapters:",
        totalChapters,
      );

      if (direction === "prev") {
        if (currentChapter > 1) {
          newChapter = currentChapter - 1;
        } else if (currentChapter === 1) {
          // Verificar se existe capítulo 0 (introdução)
          const chapters = await bibleReaderService.getChapters(
            bibleId,
            currentBookId,
          );
          const hasIntroduction = chapters.some((ch) => ch.chapterNumber === 0);
          if (hasIntroduction) {
            newChapter = 0;
          } else {
            setIsFirstOfBible(true);
            await navigateToAdjacentBook("prev");
            return;
          }
        } else if (currentChapter === 0) {
          // Se estamos na introdução e tentamos ir para trás, vai para livro anterior
          setIsFirstOfBible(true);
          await navigateToAdjacentBook("prev");
          return;
        }
      } else {
        if (currentChapter === 0) {
          // Se estamos na introdução, próximo é sempre o capítulo 1
          newChapter = 1;
        } else if (currentChapter < totalChapters) {
          newChapter = currentChapter + 1;
        } else {
          await navigateToAdjacentBook("next");
          return;
        }
      }

      if (newChapter >= 0 && newChapter <= totalChapters) {
        setCurrentChapter(newChapter);
        // Atualizar estado de navegação depois de mudar o capítulo
        setTimeout(async () => {
          await updateNavigationState(newChapter);
        }, 100);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error navigating chapter:", error);

      Alert.alert(
        "Erro de Navegação",
        `Falha ao navegar para o capítulo: ${errorMessage}`,
        [{ text: "OK" }],
      );
    } finally {
      setNavigating(false);
    }
  };

  const openBibleSelector = async () => {
    console.log("openBibleSelector called - starting...");
    try {
      console.log("About to call DatabaseService.getBibles()...");

      // Criar uma promise com timeout para evitar travamento
      const getBiblesWithTimeout = () => {
        return Promise.race([
          DatabaseService.getBibles(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Timeout na consulta de bíblias")),
              5000,
            ),
          ),
        ]);
      };

      const bibles = (await getBiblesWithTimeout()) as any[];
      console.log("PASSOU openBibleSelector - got bibles:", bibles.length);
      setAvailableBibles(bibles);

      // Carregar também as Bíblias disponíveis no Drive
      try {
        const driveFiles = await googleDriveService.listBibleFiles();
        setAvailableDriveBibles(driveFiles);
      } catch (driveError) {
        console.warn("Error loading Drive bibles:", driveError);
        // Não impede a abertura do modal se falhar
      }

      console.log("Setting bibleSelectorVisible to true");
      setBibleSelectorVisible(true);
    } catch (error) {
      console.error("Error in openBibleSelector:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error message:", errorMessage);

      // Se falhar, ainda assim abrir o modal com uma lista vazia ou básica
      console.log("Opening modal with empty bible list due to error");
      setAvailableBibles([]);
      setAvailableDriveBibles([]);
      setBibleSelectorVisible(true);
    }
  };

  // Função de download simplificada baseada no bible-manager
  const handleDownloadBible = async (driveFile: DriveFile) => {
    console.log("🚀 handleDownloadBible FUNCTION CALLED with:", driveFile.name);
    console.log("🚀 DriveFile ID:", driveFile.id);

    // Timeout de segurança para evitar travamentos
    const timeoutId = setTimeout(() => {
      console.error("DOWNLOAD TIMEOUT - Process taking too long");
      setDownloading(null);
      Alert.alert("Timeout", "Download demorou demais. Tente novamente.");
    }, 60000); // 1 minuto

    try {
      console.log("=== STARTING DOWNLOAD PROCESS ===");
      setDownloading(driveFile.id);
      console.log(
        "Download state set, starting googleDriveService.downloadBible...",
      );

      await googleDriveService.downloadBible(driveFile);
      console.log("googleDriveService.downloadBible completed successfully");

      console.log("Starting parseBibleInfo...");
      const bibleInfo = googleDriveService.parseBibleInfo(driveFile.name);
      console.log("parseBibleInfo completed");

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

      console.log("Bible object created:", JSON.stringify(bible, null, 2));
      console.log("About to call DatabaseService.saveBible...");

      try {
        await DatabaseService.saveBible(bible);
        console.log("DatabaseService.saveBible completed successfully");
      } catch (saveError) {
        console.error("Error saving bible to database:", saveError);
        console.error(
          "Save error details:",
          JSON.stringify(saveError, null, 2),
        );
        throw saveError; // Re-throw para ser capturado pelo catch principal
      }
      console.log("Bible saved to database successfully");

      // Refresh local bibles list
      const updatedLocalBibles = await DatabaseService.getBibles();
      console.log(
        "Updated bibles from database:",
        updatedLocalBibles.length,
        "bibles found",
      );
      console.log(
        "Updated bibles list:",
        updatedLocalBibles.map((b) => ({
          id: b.id,
          name: b.name,
          fileName: b.fileName,
        })),
      );

      setAvailableBibles(updatedLocalBibles);
      console.log("availableBibles state updated");

      Alert.alert("Sucesso", `Bíblia "${bible.name}" baixada com sucesso!`);
    } catch (error) {
      console.error("Error downloading bible:", error);
      Alert.alert("Erro", "Falha ao baixar a Bíblia");
    } finally {
      clearTimeout(timeoutId);
      setDownloading(null);
      console.log("=== DOWNLOAD PROCESS FINISHED ===");
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
              const isCurrentBible = bible.id === bibleId;

              await DatabaseService.deleteBible(bible.id);
              await googleDriveService.deleteBibleFile(bible.fileName);

              const updatedLocalBibles = await DatabaseService.getBibles();
              const downloadedBibles = updatedLocalBibles.filter(
                (b) => b.isDownloaded,
              );
              setAvailableBibles(updatedLocalBibles);

              // Se removeu a Bíblia atual e ainda há outras disponíveis
              if (isCurrentBible && downloadedBibles.length > 0) {
                const firstAvailableBible = downloadedBibles[0];

                // Atualizar a configuração preferredBibleId
                await DatabaseService.saveSetting(
                  "preferredBibleId",
                  firstAvailableBible.id,
                );

                // Redirecionar para a primeira Bíblia disponível
                router.replace(
                  `/chapter-reader?bibleId=${firstAvailableBible.id}&bookId=1&chapterNumber=1`,
                );
                setBibleSelectorVisible(false);
                return; // Sair da função para evitar mostrar alert
              }

              // Se não há mais Bíblias disponíveis
              if (downloadedBibles.length === 0) {
                Alert.alert(
                  "Nenhuma Bíblia Disponível",
                  "Você precisa baixar pelo menos uma Bíblia para continuar.",
                  [
                    {
                      text: "OK",
                      onPress: () => {
                        setBibleSelectorVisible(false);
                        router.back(); // Voltar para tela anterior
                      },
                    },
                  ],
                );
                return;
              }

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

  const isDownloaded = (driveFile: DriveFile) => {
    return availableBibles.some((bible) => bible.fileName === driveFile.name);
  };

  const selectBible = async (selectedBible: Bible) => {
    if (selectedBible.id === bibleId) {
      setBibleSelectorVisible(false);
      return;
    }

    try {
      setLoading(true);
      setBibleSelectorVisible(false);

      router.replace(
        `/chapter-reader?bibleId=${selectedBible.id}&bookId=${currentBookId}&chapterNumber=${currentChapter}`,
      );
    } catch (error) {
      console.error("Error switching Bible:", error);
      Alert.alert("Erro", "Falha ao trocar versão da Bíblia");
    } finally {
      setLoading(false);
    }
  };

  const openBookSelector = async () => {
    try {
      const books = await bibleReaderService.getBooks(bibleId);
      console.log("[DEBUG] Livros carregados:", books.length);
      setAvailableBooks(books);
      setBookSelectorVisible(true);
    } catch (error) {
      console.error("Error loading books:", error);
      Alert.alert("Erro", "Falha ao carregar livros da Bíblia");
    }
  };

  const selectBook = async (selectedBook: Book) => {
    if (selectedBook.id === currentBookId) {
      return;
    }

    try {
      setLoading(true);

      setBook(selectedBook);
      setCurrentBookId(selectedBook.id);

      const chapters = await bibleReaderService.getChapters(
        bibleId,
        selectedBook.id,
      );
      // Calcular totalChapters corretamente: se tem introdução (capítulo 0), remove 1 do length
      const hasIntroduction = chapters.some((ch) => ch.chapterNumber === 0);
      const actualTotalChapters = hasIntroduction
        ? chapters.length - 1
        : chapters.length;
      setTotalChapters(actualTotalChapters);
    } catch (error) {
      console.error("Erro ao trocar livro:", error);
      Alert.alert("Erro", "Falha ao carregar capítulos do livro selecionado");
    } finally {
      setLoading(false);
    }
  };

  const navigateToAdjacentBook = async (direction: "prev" | "next") => {
    try {
      // setLoading(true);

      const books = await bibleReaderService.getBooks(bibleId);
      const currentBookIndex = books.findIndex((b) => b.id === currentBookId);

      let newBookIndex =
        direction === "prev" ? currentBookIndex - 1 : currentBookIndex + 1;

      if (newBookIndex < 0 || newBookIndex >= books.length) {
        Alert.alert(
          "Aviso",
          direction === "prev"
            ? "Você já está no primeiro capítulo da Bíblia"
            : "Você já está no último capítulo da Bíblia",
        );
        return;
      }

      const newBook = books[newBookIndex];
      const newBookChapters = await bibleReaderService.getChapters(
        bibleId,
        newBook.id,
      );

      let newChapter: number;
      if (direction === "prev") {
        // Indo para o livro anterior: ir para o último capítulo
        newChapter =
          newBookChapters[newBookChapters.length - 1]?.chapterNumber || 1;
      } else {
        // Indo para o próximo livro: ir para o primeiro capítulo (pode ser 0 se tem introdução)
        newChapter = newBookChapters[0]?.chapterNumber || 1;
      }

      setBook(newBook);
      setCurrentBookId(newBook.id);
      setCurrentChapter(newChapter);
      // Calcular totalChapters corretamente: se tem introdução (capítulo 0), remove 1 do length
      const hasIntroduction = newBookChapters.some(
        (ch) => ch.chapterNumber === 0,
      );
      const actualTotalChapters = hasIntroduction
        ? newBookChapters.length - 1
        : newBookChapters.length;
      setTotalChapters(actualTotalChapters);

      const versesData = await bibleReaderService.getVerses(
        bibleId,
        newBook.id,
        newChapter,
      );
      setVerses(versesData);

      await updateNavigationState();
    } catch (error) {
      console.error("Error navigating to adjacent book:", error);
      Alert.alert("Erro", "Falha ao navegar para o livro adjacente");
    } finally {
      setLoading(false);
    }
  };

  const applySearchFilter = useCallback(
    (
      filter: "all" | "ot" | "nt",
      source: SearchResult[],
      localMap?: Map<number, "old" | "new"> | null,
    ) => {
      if (!source) return [] as SearchResult[];
      if (filter === "all") return source;
      const mapRef = localMap ?? bookTestamentMap;
      return source.filter((r) => {
        const testament = mapRef?.get(r.bookId);
        if (testament)
          return filter === "ot" ? testament === "old" : testament === "new";
        return filter === "ot" ? r.bookId <= 39 : r.bookId > 39;
      });
    },
    [bookTestamentMap],
  );

  const SEARCH_RESULTS_LIMIT = 1000;

  const handleSearch = async () => {
    if (!searchQuery.trim() || !bibleId) return;

    try {
      setSearchLoading(true);
      let localMap = bookTestamentMap;
      if (!localMap) {
        try {
          const booksForMap = await bibleReaderService.getBooks(bibleId);
          localMap = buildTestamentMap(booksForMap);
          setBookTestamentMap(localMap);
        } catch {
          console.warn(
            "Não foi possível carregar mapa de testamentos agora, usando fallback heurístico.",
          );
        }
      }

      let results = await bibleReaderService.searchVerses(
        bibleId,
        searchQuery.trim(),
        SEARCH_RESULTS_LIMIT,
      );
      // Guardar bruto
      setRawSearchResults(results);
      // Calcular contagens
      const otCount = results.filter((r) => {
        const t = localMap?.get(r.bookId);
        return t ? t === "old" : r.bookId <= 39;
      }).length;
      const ntCount = results.filter((r) => {
        const t = localMap?.get(r.bookId);
        return t ? t === "new" : r.bookId > 39;
      }).length;
      setSearchCounts({ all: results.length, ot: otCount, nt: ntCount });
      // Aplicar filtro atual
      setSearchResults(
        applySearchFilter(searchTestamentFilter, results, localMap),
      );
    } catch (error) {
      console.error("Error searching:", error);
      Alert.alert("Erro", "Falha ao realizar busca");
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (rawSearchResults) {
      setSearchResults(
        applySearchFilter(searchTestamentFilter, rawSearchResults),
      );
    }
  }, [searchTestamentFilter, rawSearchResults, applySearchFilter]);

  const navigateToSearchResult = async (result: SearchResult) => {
    setSearchModalVisible(false);
    setSearchQuery("");
    setSearchResults([]);

    try {
      // Se mudou o livro, precisamos recarregar tudo
      if (result.bookId !== currentBookId) {
        setLoading(true);
        const books = await bibleReaderService.getBooks(bibleId);
        const newBook = books.find((b) => b.id === result.bookId);
        if (newBook) {
          setBook(newBook);
          setCurrentBookId(newBook.id);

          const chapters = await bibleReaderService.getChapters(
            bibleId,
            result.bookId,
          );
          // Calcular totalChapters corretamente: se tem introdução (capítulo 0), remove 1 do length
          const hasIntroduction = chapters.some((ch) => ch.chapterNumber === 0);
          const actualTotalChapters = hasIntroduction
            ? chapters.length - 1
            : chapters.length;
          setTotalChapters(actualTotalChapters);
        }

        // Quando mudamos o livro E capítulo, setamos ambos e o useEffect irá carregar
        setCurrentChapter(result.chapterNumber);
      } else {
        // Só mudou o capítulo, o useEffect irá carregar automaticamente
        setCurrentChapter(result.chapterNumber);
      }
    } catch (error) {
      console.error("Error navigating to search result:", error);
      Alert.alert("Erro", "Falha ao navegar para o resultado da busca");
      setLoading(false);
    }
  };

  const navigateToChapter = async (chapterNumber: number, book?: Book) => {
    console.log("=== navigateToChapter CHAMADA ===");
    console.log("Parâmetros recebidos:");
    console.log("  chapterNumber:", chapterNumber);
    console.log("  book:", book?.id, book?.name);
    console.log("Estado atual:");
    console.log("  currentBookId:", currentBookId);
    console.log("  currentChapter:", currentChapter);
    console.log("  bibleId:", bibleId);

    if (!bibleId || chapterNumber < 0) {
      console.log("❌ Retornando: bibleId ou chapterNumber inválido");
      return;
    }

    try {
      // Se mudou o livro, precisamos recarregar tudo
      if (book && book.id !== currentBookId) {
        console.log("📚 MUDOU DE LIVRO - Recarregando tudo...");
        setLoading(true);
        setBook(book);
        setCurrentBookId(book.id);

        // IMPORTANTE: Resetar lastLoadedChapter para forçar o recarregamento
        // mesmo se o número do capítulo for o mesmo (ex: intro → intro)
        console.log("🔄 Resetando lastLoadedChapter para forçar reload");
        setLastLoadedChapter(null);

        const chapters = await bibleReaderService.getChapters(bibleId, book.id);
        // Calcular totalChapters corretamente: se tem introdução (capítulo 0), remove 1 do length
        const hasIntroduction = chapters.some((ch) => ch.chapterNumber === 0);
        const actualTotalChapters = hasIntroduction
          ? chapters.length - 1
          : chapters.length;
        setTotalChapters(actualTotalChapters);

        // Quando mudamos o livro E capítulo, setamos ambos e o useEffect irá carregar
        console.log("✅ Setando capítulo:", chapterNumber);
        setCurrentChapter(chapterNumber);
      } else {
        // Só mudou o capítulo, o useEffect irá carregar automaticamente
        console.log("📖 MESMO LIVRO - Só mudando capítulo");
        console.log("  De:", currentChapter, "Para:", chapterNumber);
        setCurrentChapter(chapterNumber);
      }
    } catch (error) {
      console.error("❌ Error navigating to chapter:", error);
      Alert.alert("Erro", "Falha ao carregar o capítulo");
      setLoading(false);
    }
  };

  const openNotes = (notes: string[]) => {
    setCurrentNotes(notes);
    setNotesModalVisible(true);
  };

  const openReferencesModal = async (
    references: { text: string; reference: string; position: number }[],
  ) => {
    if (!references || references.length === 0 || !bibleId) return;

    setCurrentReferences(references);
    setSelectedReferenceIndex(0);
    setShowAllReferences(false); // Reset to compact view
    setReferencesModalVisible(true);

    // Load the first reference immediately
    await loadSelectedReference(0, references);
  };

  const loadSelectedReference = async (
    index: number,
    references?: { text: string; reference: string; position: number }[],
  ) => {
    const refs = references || currentReferences;
    if (index < 0 || index >= refs.length || !bibleId) return;

    try {
      setReferenceVerseLoading(true);
      const verse = await bibleReaderService.getVerseByReference(
        bibleId,
        refs[index].reference,
      );

      if (verse) {
        setSelectedReferenceVerse(verse);
        setSelectedReferenceIndex(index);
        // Buscar nome do livro
        const bookName = await getBookNameById(verse.bookId);
        setSelectedReferenceBookName(bookName);
      }
    } catch (error) {
      console.error("Error loading selected reference:", error);
      Alert.alert("Erro", "Falha ao carregar referência do versículo");
    } finally {
      setReferenceVerseLoading(false);
    }
  };

  const selectReference = async (index: number) => {
    if (index === selectedReferenceIndex) return; // Already selected
    await loadSelectedReference(index);
  };

  const openSingleReference = async (reference: string) => {
    if (!bibleId) return;

    try {
      setVerseRefLoading(true);
      const verse = await bibleReaderService.getVerseByReference(
        bibleId,
        reference,
      );

      if (verse) {
        setCurrentVerseRef(verse);
        setVerseRefModalVisible(true);
      } else {
        Alert.alert(
          "Versículo não encontrado",
          `Não foi possível encontrar a referência: ${reference}`,
        );
      }
    } catch (error) {
      console.error("Error loading verse reference:", error);
      Alert.alert("Erro", "Falha ao carregar referência do versículo");
    } finally {
      setVerseRefLoading(false);
    }
  };

  // Get book name from bookId
  const getBookNameById = async (bookId: number): Promise<string> => {
    if (!bibleId) return `Livro ${bookId}`;

    try {
      let books = availableBooks;
      if (!books || books.length === 0) {
        books = await bibleReaderService.getBooks(bibleId);
      }

      const book = books.find((b: Book) => b.id === bookId);
      return book ? book.abbreviation || book.name : `Livro ${bookId}`;
    } catch (error) {
      console.error("Error getting book name:", error);
      return `Livro ${bookId}`;
    }
  };

  // Handle reference press from introduction
  const handleIntroductionReferencePress = async (
    bookIdStr: string,
    chapter: number,
    verseStart?: number,
    verseEnd?: number,
  ) => {
    if (!bibleId) return;

    try {
      const bookId = parseInt(bookIdStr);

      // Buscar os versículos do capítulo diretamente com o bookId
      setVerseRefLoading(true);
      const verses = await bibleReaderService.getVerses(
        bibleId,
        bookId,
        chapter,
      );

      if (!verses || verses.length === 0) {
        Alert.alert("Erro", `Capítulo ${chapter} não encontrado`);
        setVerseRefLoading(false);
        return;
      }

      // Filtrar versículo(s) específico(s)
      let selectedVerses: Verse[];
      if (verseStart) {
        if (verseEnd && verseEnd !== verseStart) {
          // Range de versículos
          selectedVerses = verses.filter(
            (v) => v.verseNumber >= verseStart && v.verseNumber <= verseEnd,
          );
        } else {
          // Versículo único
          selectedVerses = verses.filter((v) => v.verseNumber === verseStart);
        }
      } else {
        // Capítulo inteiro
        selectedVerses = verses;
      }

      if (selectedVerses.length === 0) {
        Alert.alert("Erro", `Versículo não encontrado`);
        setVerseRefLoading(false);
        return;
      }

      // Usar o primeiro versículo para o modal (pode ser expandido no futuro para mostrar múltiplos)
      setCurrentVerseRef(selectedVerses[0]);

      // Buscar e armazenar o nome do livro
      const bookName = await getBookNameById(bookId);
      setCurrentVerseRefBookName(bookName);

      setVerseRefModalVisible(true);
    } catch (error) {
      console.error("Error handling introduction reference:", error);
      Alert.alert("Erro", "Falha ao abrir referência");
    } finally {
      setVerseRefLoading(false);
    }
  };

  // Handle verse selection with simple press (only one at a time)
  const handleVersePress = (verse: Verse) => {
    setSelectedVerseForOptions(verse);

    // Verificar se o versículo já está destacado
    const verseKey = `${verse.bookId}-${verse.chapterNumber}-${verse.verseNumber}`;
    const isHighlighted = !!verseHighlights[verseKey];
    setVerseHighlighted(isHighlighted);
    setSelectedHighlightColor(isHighlighted ? verseHighlights[verseKey] : null);

    setVerseOptionsVisible(true);

    // Destacar temporariamente o versículo
    const newSelected = new Set<string>();
    newSelected.add(verseKey);
    setSelectedVerses(newSelected);
    setSelectionMode(false);
  };

  // Load verse highlights from AsyncStorage
  const loadVerseHighlights = async () => {
    try {
      const stored = await AsyncStorage.getItem("verse_highlights");
      if (stored) {
        setVerseHighlights(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Erro ao carregar destaques:", error);
    }
  };

  // Save verse highlights to AsyncStorage
  const saveVerseHighlights = async (highlights: Record<string, string>) => {
    try {
      await AsyncStorage.setItem(
        "verse_highlights",
        JSON.stringify(highlights),
      );
      setVerseHighlights(highlights);
    } catch (error) {
      console.error("Erro ao salvar destaques:", error);
    }
  };

  const toggleVerseHighlight = () => {
    if (!verseHighlighted) {
      // Mostrar seletor de cores
      setShowColorPicker(true);
    } else {
      // Remover destaque
      if (selectedVerseForOptions) {
        const verseKey = `${selectedVerseForOptions.bookId}-${selectedVerseForOptions.chapterNumber}-${selectedVerseForOptions.verseNumber}`;
        const newHighlights = { ...verseHighlights };
        delete newHighlights[verseKey];
        saveVerseHighlights(newHighlights);
      }
      setVerseHighlighted(false);
      setSelectedHighlightColor(null);
      setShowColorPicker(false);
    }
  };

  const handleColorSelect = async (color: string) => {
    if (!selectedVerseForOptions) return;

    const verseKey = `${selectedVerseForOptions.bookId}-${selectedVerseForOptions.chapterNumber}-${selectedVerseForOptions.verseNumber}`;
    const newHighlights = { ...verseHighlights, [verseKey]: color };
    await saveVerseHighlights(newHighlights);

    setSelectedHighlightColor(color);
    setVerseHighlighted(true);
    setShowColorPicker(false);
  };

  const closeVerseOptions = () => {
    setVerseOptionsVisible(false);
    setSelectedVerseForOptions(null);
    // Limpar seleção visual após fechar
    setTimeout(() => {
      if (!selectionMode) {
        setSelectedVerses(new Set());
      }
    }, 300);
  };

  const handleSaveVerse = async () => {
    if (!selectedVerseForOptions) return;

    // Verificar se está logado
    if (!AuthService.isAuthenticated()) {
      closeVerseOptions();
      Alert.alert(
        "Login necessário",
        "Você precisa fazer login para criar anotações.",
        [
          {
            text: "Cancelar",
            style: "cancel",
          },
          {
            text: "Fazer Login",
            onPress: () => router.push("/auth"),
          },
        ],
      );
      return;
    }

    closeVerseOptions();
    // Ativar modo de seleção e abrir modal de nota
    const verseKey = `${selectedVerseForOptions.bookId}-${selectedVerseForOptions.chapterNumber}-${selectedVerseForOptions.verseNumber}`;
    const newSelected = new Set<string>();
    newSelected.add(verseKey);
    setSelectedVerses(newSelected);
    setSelectionMode(true);
    await openNoteModal();
  };

  const handleAnnotateVerse = async () => {
    if (!selectedVerseForOptions) return;

    // Verificar se está logado
    if (!AuthService.isAuthenticated()) {
      closeVerseOptions();
      Alert.alert(
        "Login necessário",
        "Você precisa fazer login para visualizar ou criar anotações.",
        [
          {
            text: "Cancelar",
            style: "cancel",
          },
          {
            text: "Fazer Login",
            onPress: () => router.push("/auth"),
          },
        ],
      );
      return;
    }

    closeVerseOptions();

    // Navegar para a tela de edição de anotação
    router.push({
      pathname: "/note-editor",
      params: {
        bookId: selectedVerseForOptions.bookId.toString(),
        bookName: book?.name || "",
        chapterNumber: selectedVerseForOptions.chapterNumber.toString(),
        verseNumber: selectedVerseForOptions.verseNumber.toString(),
        verseText: selectedVerseForOptions.text,
      },
    });
  };

  const handleViewVerseNotes = async () => {
    if (!selectedVerseForOptions) return;

    // Verificar se está logado
    if (!AuthService.isAuthenticated()) {
      closeVerseOptions();
      Alert.alert(
        "Login necessário",
        "Você precisa fazer login para visualizar anotações.",
        [
          {
            text: "Cancelar",
            style: "cancel",
          },
          {
            text: "Fazer Login",
            onPress: () => router.push("/auth"),
          },
        ],
      );
      return;
    }

    closeVerseOptions();

    // Navegar para a tela de visualização de notas do versículo
    router.push({
      pathname: "/verse-notes",
      params: {
        bookId: selectedVerseForOptions.bookId.toString(),
        bookName: book?.name || "",
        chapterNumber: selectedVerseForOptions.chapterNumber.toString(),
        verseNumber: selectedVerseForOptions.verseNumber.toString(),
        verseText: selectedVerseForOptions.text,
      },
    });
  };

  const handleCopyVerse = async () => {
    if (!selectedVerseForOptions) return;

    const cleanVerseText = (text: string) => {
      return text
        .replace(/[✚ℕ]/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([.,;:!?])/g, "$1")
        .trim();
    };

    const verseText = `${selectedVerseForOptions.verseNumber} - ${cleanVerseText(selectedVerseForOptions.text)}`;
    const reference = `${book?.name} ${currentChapter}:${selectedVerseForOptions.verseNumber}`;

    // Deep link para o app
    // const deepLink = `readbible://chapter?bookId=${selectedVerseForOptions.bookId}&chapter=${currentChapter}&verse=${selectedVerseForOptions.verseNumber}`;
    const deepLink = `https://play.google.com/store/apps/details?id=com.readbible.app`;

    const textToCopy = `${verseText}\n\n${reference}\n\nAplicativo Bíblia em Foco\n${deepLink}`;

    try {
      await Share.share({
        message: textToCopy,
        title: reference,
      });
      closeVerseOptions();
    } catch (error) {
      console.error("Error sharing verse:", error);
      Alert.alert("Erro", "Não foi possível copiar o versículo");
    }
  };

  // Clear selection mode
  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedVerses(new Set());
  };

  // Share selected verses
  const shareSelectedVerses = async () => {
    if (selectedVerses.size === 0) return;

    // Limpa símbolos especiais (referências ✚ e notas ℕ) antes de compartilhar
    const cleanVerseText = (text: string) => {
      return text
        .replace(/[✚ℕ]/g, "") // remove símbolos
        .replace(/\s{2,}/g, " ") // colapsa múltiplos espaços
        .replace(/\s+([.,;:!?])/g, "$1") // remove espaço antes de pontuação comum
        .trim();
    };

    const selectedVersesData = verses.filter((verse) =>
      selectedVerses.has(
        `${verse.bookId}-${verse.chapterNumber}-${verse.verseNumber}`,
      ),
    );

    const sortedVerses = selectedVersesData.sort(
      (a, b) => a.verseNumber - b.verseNumber,
    );

    const versesText = sortedVerses
      .map((verse) => `${verse.verseNumber} - ${cleanVerseText(verse.text)}`)
      .join("\n");

    const verseNumbers = sortedVerses.map((v) => v.verseNumber);
    const verseRange =
      verseNumbers.length === 1
        ? verseNumbers[0].toString()
        : `${Math.min(...verseNumbers)}-${Math.max(...verseNumbers)}`;

    // Deep link para o app
    const firstVerse = Math.min(...verseNumbers);
    const deepLink = `readbible://chapter?bookId=${sortedVerses[0].bookId}&chapter=${currentChapter}&verse=${firstVerse}`;

    const shareText = `${versesText}

${book?.name} ${currentChapter}:${verseRange}

Aplicativo Bíblia em Foco
${deepLink}`;

    const shareTitle =
      selectedVerses.size === 1
        ? `Versículo ${book?.name} ${sortedVerses[0].chapterNumber}:${sortedVerses[0].verseNumber}`
        : `${selectedVerses.size} versículos de ${book?.name} ${
            currentChapter === 0 ? "Introdução" : currentChapter
          }`;

    try {
      const result = await Share.share({
        message: shareText,
        title: shareTitle,
      });

      // Clear selection after successful share
      if (result.action === Share.sharedAction) {
        clearSelection();
      }
    } catch (error) {
      console.error("Error sharing verses:", error);
      Alert.alert("Erro", "Não foi possível compartilhar os versículos");
    }
  };

  // Open note modal for selected verses
  const openNoteModal = async () => {
    if (selectedVerses.size === 0) return;

    const selectedVersesData = verses.filter((verse) =>
      selectedVerses.has(
        `${verse.bookId}-${verse.chapterNumber}-${verse.verseNumber}`,
      ),
    );

    const sortedVerses = selectedVersesData.sort(
      (a, b) => a.verseNumber - b.verseNumber,
    );

    const verseNumbers = sortedVerses.map((v) => v.verseNumber);

    // Verificar se já existe uma anotação para esses versículos
    const existingNote = await NotesService.getNoteByReference(
      currentBookId,
      currentChapter,
      verseNumbers,
    );

    if (existingNote) {
      setNoteText(existingNote.note);
      setIsEditingExistingNote(true);
    } else {
      setNoteText("");
      setIsEditingExistingNote(false);
    }

    setIsViewOnlyMode(false); // Desativar modo visualização ao criar/editar
    setNoteModalVisible(true);
  };

  // Save note for selected verses
  const saveNote = async () => {
    if (selectedVerses.size === 0 || !noteText.trim()) return;

    setSavingNote(true);
    try {
      const selectedVersesData = verses.filter((verse) =>
        selectedVerses.has(
          `${verse.bookId}-${verse.chapterNumber}-${verse.verseNumber}`,
        ),
      );

      const sortedVerses = selectedVersesData.sort(
        (a, b) => a.verseNumber - b.verseNumber,
      );

      const verseNumbers = sortedVerses.map((v) => v.verseNumber);

      // Limpa símbolos especiais do texto dos versículos
      const cleanVerseText = (text: string) => {
        return text
          .replace(/[✚ℕ]/g, "")
          .replace(/\s{2,}/g, " ")
          .replace(/\s+([.,;:!?])/g, "$1")
          .trim();
      };

      const versesText = sortedVerses
        .map((verse) => `${verse.verseNumber} - ${cleanVerseText(verse.text)}`)
        .join(" ");

      await NotesService.saveNote(
        currentBookId,
        book?.name || "",
        currentChapter,
        verseNumbers,
        versesText,
        noteText.trim(),
      );

      // Atualizar o mapa de anotações localmente
      await loadVerseNotes();

      Alert.alert("Sucesso", "Anotação salva com sucesso!");
      setNoteModalVisible(false);
      setNoteText("");
      setIsEditingExistingNote(false);
      clearSelection();
    } catch (error) {
      console.error("Error saving note:", error);
      Alert.alert("Erro", "Não foi possível salvar a anotação");
    } finally {
      setSavingNote(false);
    }
  };

  // Text formatting functions
  const insertFormatting = (
    prefix: string,
    suffix: string,
    placeholder: string = "texto",
  ) => {
    const { start, end } = textSelection;
    const hasSelection = start !== end;

    const before = noteText.slice(0, start);
    const selectedText = hasSelection
      ? noteText.slice(start, end)
      : placeholder;
    const after = noteText.slice(end);

    const newText = `${before}${prefix}${selectedText}${suffix}${after}`;
    setNoteText(newText);

    // Posicionar cursor
    setTimeout(() => {
      if (hasSelection) {
        // Se tinha seleção, posicionar cursor após o texto formatado
        const newCursorPos =
          start + prefix.length + selectedText.length + suffix.length;
        noteInputRef.current?.setNativeProps({
          selection: { start: newCursorPos, end: newCursorPos },
        });
      } else {
        // Se não tinha seleção, selecionar o placeholder
        const newCursorPos = start + prefix.length;
        noteInputRef.current?.setNativeProps({
          selection: {
            start: newCursorPos,
            end: newCursorPos + placeholder.length,
          },
        });
      }
    }, 10);
  };

  const applyBold = () => insertFormatting("**", "**", "negrito");
  const applyItalic = () => insertFormatting("*", "*", "itálico");
  const applyUnderline = () => insertFormatting("__", "__", "sublinhado");
  const applyStrikethrough = () => insertFormatting("~~", "~~", "riscado");
  const applyBulletList = () => {
    const before = noteText.slice(0, cursorPosition);
    const after = noteText.slice(cursorPosition);
    const newLine = before.endsWith("\n") || before === "" ? "" : "\n";
    const newText = `${before}${newLine}- Item da lista${after}`;
    setNoteText(newText);
  };

  // Render formatted text for view mode
  const renderFormattedText = (text: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Regex patterns for markdown
    const patterns = [
      { regex: /\*\*([^*]+)\*\*/g, style: { fontWeight: "bold" } }, // Bold
      { regex: /\*([^*]+)\*/g, style: { fontStyle: "italic" } }, // Italic
      { regex: /__([^_]+)__/g, style: { textDecorationLine: "underline" } }, // Underline
      { regex: /~~([^~]+)~~/g, style: { textDecorationLine: "line-through" } }, // Strikethrough
    ];

    // Split by line to handle lists
    const lines = text.split("\n");

    return lines.map((line, lineIndex) => {
      const isListItem = line.trim().startsWith("- ");
      const lineText = isListItem ? line.trim().substring(2) : line;

      // Apply inline formatting
      let processedLine: React.ReactNode[] = [];
      let remaining = lineText;
      let key = 0;

      while (remaining) {
        let earliestMatch: {
          index: number;
          match: RegExpMatchArray;
          style: any;
        } | null = null;

        // Find earliest match among all patterns
        patterns.forEach(({ regex, style }) => {
          regex.lastIndex = 0;
          const match = regex.exec(remaining);
          if (
            match &&
            (earliestMatch === null || match.index < earliestMatch.index)
          ) {
            earliestMatch = { index: match.index, match, style };
          }
        });

        if (earliestMatch) {
          // Add text before match
          if (earliestMatch.index > 0) {
            processedLine.push(
              <Text key={`${lineIndex}-${key++}`}>
                {remaining.slice(0, earliestMatch.index)}
              </Text>,
            );
          }

          // Add formatted text
          processedLine.push(
            <Text
              key={`${lineIndex}-${key++}`}
              style={earliestMatch.style as any}
            >
              {earliestMatch.match[1]}
            </Text>,
          );

          remaining = remaining.slice(
            earliestMatch.index + earliestMatch.match[0].length,
          );
        } else {
          // No more matches, add remaining text
          processedLine.push(
            <Text key={`${lineIndex}-${key++}`}>{remaining}</Text>,
          );
          remaining = "";
        }
      }

      return (
        <Text
          key={lineIndex}
          style={[styles.noteViewText, { color: isDark ? "#fafafa" : "#222" }]}
        >
          {isListItem && "• "}
          {processedLine}
          {lineIndex < lines.length - 1 && "\n"}
        </Text>
      );
    });
  };

  // Open note for a specific verse (view/edit existing note)
  const openVerseNote = async (verse: Verse) => {
    try {
      // Buscar todas as notas do capítulo
      const notes = await NotesService.getNotesByChapter(
        verse.bookId,
        verse.chapterNumber,
      );

      // Encontrar a nota que contém este versículo
      const note = notes.find((n) =>
        n.verseNumbers.includes(verse.verseNumber),
      );

      if (!note) {
        Alert.alert("Info", "Nenhuma anotação encontrada para este versículo");
        return;
      }

      // Set up for viewing (read-only mode)
      setNoteText(note.note);
      setIsEditingExistingNote(true);
      setIsViewOnlyMode(true); // Ativar modo visualização

      // Store the verse selection internally but don't activate selection mode
      const newSelection = new Set<string>();
      note.verseNumbers.forEach((verseNum) => {
        newSelection.add(`${note.bookId}-${note.chapterNumber}-${verseNum}`);
      });
      setSelectedVerses(newSelection);
      // Don't activate selection mode when viewing/editing notes
      // setSelectionMode(true);

      setNoteModalVisible(true);
    } catch (error) {
      console.error("Error opening verse note:", error);
      Alert.alert("Erro", "Não foi possível carregar a anotação");
    }
  };

  // Delete note
  const deleteNote = async () => {
    if (selectedVerses.size === 0) return;

    Alert.alert(
      "Confirmar exclusão",
      "Tem certeza que deseja excluir esta anotação?",
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
              const selectedVersesData = verses.filter((verse) =>
                selectedVerses.has(
                  `${verse.bookId}-${verse.chapterNumber}-${verse.verseNumber}`,
                ),
              );

              const sortedVerses = selectedVersesData.sort(
                (a, b) => a.verseNumber - b.verseNumber,
              );

              const verseNumbers = sortedVerses.map((v) => v.verseNumber);
              const verseRange =
                verseNumbers.length === 1
                  ? verseNumbers[0].toString()
                  : `${Math.min(...verseNumbers)}-${Math.max(...verseNumbers)}`;
              const noteId = `${currentBookId}-${currentChapter}-${verseRange}`;

              await NotesService.deleteNote(noteId);
              await loadVerseNotes();

              Alert.alert("Sucesso", "Anotação excluída com sucesso!");
              setNoteModalVisible(false);
              setNoteText("");
              setIsEditingExistingNote(false);
              clearSelection();
            } catch (error) {
              console.error("Error deleting note:", error);
              Alert.alert("Erro", "Não foi possível excluir a anotação");
            }
          },
        },
      ],
    );
  };

  const renderVerseText = (text: string, verse: Verse) => {
    // Limpar prefixo "Introdução|LIVRO | " que aparece no primeiro versículo
    // Padrão: "Introdução|APOCALIPSE	|	Título e assunto do livro"
    // Remove até o último "|" incluindo espaços/tabs
    let cleanedText = text.replace(/^[^|]*\|[^|]*\|\s*/, "");

    const parts: React.ReactNode[] = [];
    let cursor = 0;
    const symbolRegex = /([✚ℕ])/g;
    let match: RegExpExecArray | null;
    while ((match = symbolRegex.exec(cleanedText)) !== null) {
      if (match.index > cursor) {
        parts.push(
          <Text key={`seg-${cursor}`}>
            {cleanedText.substring(cursor, match.index)}
          </Text>,
        );
      }
      const symbol = match[1];
      if (symbol === "✚") {
        const pos = match.index;
        const refsAtPos =
          verse.verseReferences?.filter((r) => r.position === pos) ||
          verse.verseReferences ||
          [];
        parts.push(
          <Text
            key={`ref-${pos}`}
            onPress={() =>
              refsAtPos.length && openReferencesModal(refsAtPos as any)
            }
            style={{
              color: colorScheme.refSymbol,
              fontWeight: "600",
              fontSize: 13,
            }}
          >
            {symbol}
          </Text>,
        );
      } else if (symbol === "ℕ") {
        parts.push(
          <Text
            key={`note-${match.index}`}
            onPress={() =>
              verse.notes && verse.notes.length && openNotes(verse.notes)
            }
            style={{
              color: colorScheme.noteSymbol,
              fontWeight: "600",
              fontSize: 13,
            }}
          >
            ℕ
          </Text>,
        );
      }
      cursor = match.index + match[0].length;
    }
    if (cursor < cleanedText.length) {
      parts.push(
        <Text key={`tail-${cursor}`}>{cleanedText.substring(cursor)}</Text>,
      );
    }

    return <>{parts}</>;
  };

  // Renderização dos títulos já com estilo neutro
  const renderTitleText = (titleText: string, level: number = 1) => {
    // Mostrar apenas o que vem depois do último "|"
    // Padrão: "Introdução|APOCALIPSE | Título e assunto do livro" -> "Título e assunto do livro"
    const cleanedTitle = titleText.includes("|")
      ? titleText.substring(titleText.lastIndexOf("|") + 1).trim()
      : titleText;

    const levelSizes: Record<number, number> = { 1: 16, 2: 15, 3: 14 };
    const lightColors: Record<number, string> = {
      1: "#444",
      2: "#555",
      3: "#666",
    };
    const darkColors: Record<number, string> = {
      1: "#e0e0e0",
      2: "#cfcfcf",
      3: "#bdbdbd",
    };
    const palette = isDark ? darkColors : lightColors;
    return (
      <Text
        style={{
          fontSize: applyFontScale(levelSizes[level] || 20),
          fontWeight: "700",
          color: palette[level] || (isDark ? "#d0d0d0" : "#555"),
        }}
      >
        {cleanedTitle}
      </Text>
    );
  };

  const renderVerse = ({ item }: { item: Verse }) => {
    const favoriteKey = `${item.bookId}-${item.chapterNumber}-${item.verseNumber}`;
    const isSelected = selectedVerses.has(favoriteKey);
    const hasNote = verseNotes.has(favoriteKey);

    // Debug log para primeiro versículo
    if (item.verseNumber === 1) {
      console.log("🔍 [renderVerse] Verificando nota para v1:", {
        favoriteKey,
        hasNote,
        verseNotesSize: verseNotes.size,
        verseNotesKeys: Array.from(verseNotes.keys()),
        itemBookId: item.bookId,
        currentBookId,
      });
    }

    // DESATIVADO: Sincronização de versículos com áudio
    // const isBeingNarrated = currentNarratedVerse === item.verseNumber;
    const isBeingNarrated = false; // Sempre false - funcionalidade desativada

    // Verificar se o versículo está destacado
    const highlightColor = verseHighlights[favoriteKey];

    return (
      <View
        style={[
          styles.verseContainer,
          { flexDirection: "column" }, // títulos acima
          isDark && { backgroundColor: "#121212" },
          // isBeingNarrated && styles.verseBeingNarrated,
          // isBeingNarrated && isDark && styles.verseBeingNarratedDark,
        ]}
      >
        {/* TÍTULOS (fora da área clicável) */}
        {item.titles && item.titles.length > 0 && (
          <View style={{ marginBottom: 6 }}>
            {item.titles.map((title, index) => (
              <View key={index} style={styles.verseTitleContainer}>
                {renderTitleText(title.text, title.level)}
              </View>
            ))}
          </View>
        )}

        {/* ÁREA CLICÁVEL APENAS DO VERSÍCULO */}
        <Pressable
          style={[
            {
              flexDirection: "row",
              alignItems: "flex-start",
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              position: "relative",
            },
            isSelected && styles.verseContainerSelected,
            isSelected && isDark && { backgroundColor: "#263850" },
            highlightColor && { backgroundColor: highlightColor },
          ]}
          onPress={() => handleVersePress(item)}
        >
          <View style={[styles.verseTextContainer, { flex: 1 }]}>
            <Text style={[styles.verseText, verseTextDynamic]}>
              {/* Não mostrar número do versículo para introdução (capítulo 0) */}
              {item.chapterNumber !== 0 && (
                <>
                  <Text
                    style={[
                      styles.verseNumber,
                      isDark && { color: colorScheme.verseNumber },
                      highlightColor && { color: "#1565C0" },
                    ]}
                  >
                    {item.verseNumber}
                  </Text>
                  <Text
                    style={{
                      fontWeight: "bold",
                      color: highlightColor ? "#333" : colorScheme.dash,
                    }}
                  >
                    {" "}
                    -{" "}
                  </Text>
                </>
              )}
              {renderVerseText(item.text, item)}
            </Text>

            {/* Indicador visual de nota existente */}
            {hasNote && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 4,
                  marginLeft: 2,
                }}
              >
                <View
                  style={[
                    styles.inlineIconButton,
                    {
                      borderColor: isDark ? "#FFB74D" : "#FF9800",
                      backgroundColor: isDark
                        ? "rgba(255, 183, 77, 0.1)"
                        : "rgba(255, 152, 0, 0.05)",
                    },
                  ]}
                >
                  <Ionicons
                    name="document-text"
                    size={14}
                    color={isDark ? "#FFB74D" : "#FF9800"}
                  />
                </View>
              </View>
            )}

            <View style={styles.verseButtonsRow}>
              {/* Área onde aparecerão referências e notas inline */}
            </View>
          </View>
        </Pressable>
      </View>
    );
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.searchResultContainer}
      onPress={() => navigateToSearchResult(item)}
    >
      <Text style={styles.searchResultRef}>
        {item.bookName} {item.chapterNumber}:{item.verseNumber}
      </Text>
      <Text style={styles.searchResultText}>{item.text}</Text>
    </TouchableOpacity>
  );

  // Só mostra tela de loading completa durante a inicialização inicial
  if (loading && initializing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Carregando capítulo...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectBookInModal = async (selectedBook: Book) => {
    setSelectedBookInModal(selectedBook);
    setLoadingChapters(true);
    try {
      const chapters = await bibleReaderService.getChapters(
        bibleId,
        selectedBook.id,
      );
      // Incluir todos os capítulos, incluindo o 0 se existir introdução
      const chapterNumbers = chapters.map((ch) => ch.chapterNumber);
      setChaptersForSelectedBook(chapterNumbers);
    } catch (error) {
      console.error("Error loading chapters for selected book:", error);
      Alert.alert("Erro", "Falha ao carregar capítulos do livro selecionado");
    } finally {
      setLoadingChapters(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, screenBackground]}>
      {/* Header */}
      <View style={[styles.header, headerBg]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={iconColor} />
          </TouchableOpacity>
          {bibleAbbrev ? (
            <TouchableOpacity
              onPress={async () => {
                console.log("Bible badge clicked!", bibleAbbrev);

                try {
                  // Abrir modal e carregar dados
                  await forceOpenBibleSelector();

                  // Carregar bíblias locais em paralelo
                  setTimeout(async () => {
                    try {
                      console.log("Loading local bibles in background...");
                      const bibles = await DatabaseService.getBibles();
                      console.log("Got local bibles:", bibles.length);
                      setAvailableBibles(bibles);
                    } catch (e) {
                      console.log("Failed to load local bibles:", e);
                    }
                  }, 100);
                } catch (error) {
                  console.error("Error in bible selector click:", error);
                }
              }}
              style={styles.versionHeaderBadge}
            >
              <Text style={styles.versionHeaderBadgeText}>{bibleAbbrev}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.headerActions}>
          {selectionMode && selectedVerses.size > 0 && (
            <TouchableOpacity
              onPress={clearSelection}
              style={styles.headerButton}
            >
              <Ionicons
                name="close"
                size={24}
                color={colorScheme.iconInactive}
              />
            </TouchableOpacity>
          )}
          {/* Botões de pesquisar e selecionar livro sempre visíveis */}
          <TouchableOpacity
            onPress={() => setSearchModalVisible(true)}
            style={styles.headerButton}
          >
            <Ionicons name="search" size={24} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openBookSelector}
            style={styles.headerButton}
          >
            <Ionicons name="library" size={24} color={iconColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chapter Header fixo */}
      <View
        style={[
          styles.fixedChapterHeader,
          chapterHeaderBg,
          { minHeight: HEADER_HEIGHT },
        ]}
      >
        <View style={styles.chapterHeaderContent}>
          {/* Botão Introdução - só aparece quando não está na introdução */}

          {currentChapter !== 0 ? (
            <TouchableOpacity
              onPress={() => {
                console.log("Navegando para introdução...");
                navigateToChapter(0);
              }}
              style={[
                styles.introButton,
                {
                  backgroundColor: isDark ? "#2a2a2a" : "#e8e8e8",
                  borderColor: isDark ? "#444" : "#ccc",
                },
              ]}
              accessibilityLabel="Ver introdução do livro"
            >
              <Ionicons
                name="book-outline"
                size={18}
                color={isDark ? "#64B5F6" : "#1976D2"}
              />
            </TouchableOpacity>
          ) : (
            <View></View>
          )}
          <View style={styles.chapterHeaderActions}>
            {book && (
              <>
                {/* Quiz - só aparece em capítulos normais */}
                {currentChapter !== 0 && (
                  <QuizButton
                    bookId={currentBookId}
                    chapterNumber={currentChapter}
                    bookName={book.name}
                    bibleVersion={bibleAbbrev}
                    isDark={isDark}
                  />
                )}

                {/* Áudio - só aparece em capítulos normais */}
                {currentChapter !== 0 && audioAvailable && (
                  <AudioPlayer
                    bookId={currentBookId}
                    chapterNumber={currentChapter}
                    bookName={book.name}
                    isDark={isDark}
                    onRequestNext={async () => {
                      console.log("[ChapterReader] onRequestNext called", {
                        navigating,
                        loading,
                        currentChapter,
                      });
                      if (navigating || loading) {
                        console.log(
                          "[ChapterReader] Skipping - already navigating or loading",
                        );
                        return;
                      }
                      const prevChapter = currentChapter;
                      console.log(
                        "[ChapterReader] Navigating to next chapter from",
                        prevChapter,
                      );
                      await navigateChapter("next");
                      const targetChapter = prevChapter + 1;
                      console.log(
                        "[ChapterReader] Starting audio for chapter",
                        targetChapter,
                      );

                      // Chamar diretamente sem setTimeout para funcionar com tela bloqueada
                      try {
                        await AudioService.loadAndPlay(
                          currentBookId,
                          targetChapter,
                          { bookName: book.name },
                        );
                        console.log(
                          "[ChapterReader] Next audio loaded and playing successfully",
                        );
                      } catch (err) {
                        console.error(
                          "[ChapterReader] Error loading next audio:",
                          err,
                        );
                      }
                    }}
                  />
                )}
              </>
            )}

            {/* Botão Settings - sempre visível */}
            <TouchableOpacity
              onPress={openSettings}
              style={styles.settingsButton}
              accessibilityLabel="Abrir configurações de leitura"
            >
              <Ionicons
                name="settings-outline"
                size={22}
                color={isDark ? "#ddd" : "#555"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Content Area - Introduction or Verses */}
      <View style={styles.versesContainer}>
        {currentChapter === 0 ? (
          /* Introduction View */
          <ScrollView
            style={[styles.versesList, versesListBg]}
            contentContainerStyle={[
              styles.introductionContent,
              { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 80 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {bookIntroduction ? (
              <IntroductionRenderer
                htmlContent={bookIntroduction.data}
                isDark={isDark}
                fontSize={applyFontScale(16)}
                onReferencePress={handleIntroductionReferencePress}
              />
            ) : (
              <View
                style={[
                  styles.introductionContainer,
                  isDark && { backgroundColor: "#1a1a1a" },
                ]}
              >
                <Text
                  style={[
                    styles.introductionTitle,
                    isDark && { color: "#e0e0e0" },
                  ]}
                >
                  Introdução
                </Text>
                <View
                  style={[
                    styles.introductionTextContainer,
                    isDark && { backgroundColor: "#242424" },
                  ]}
                >
                  <Text
                    style={[
                      styles.introductionText,
                      verseTextDynamic,
                      isDark && { color: "#888" },
                    ]}
                  >
                    Não há introdução disponível para este livro.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        ) : (
          /* Normal Verses List */
          <FlatList
            ref={versesListRef}
            data={verses}
            renderItem={renderVerse}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            style={[styles.versesList, versesListBg]}
            onScrollToIndexFailed={(info) => {
              // Fallback se o item não estiver renderizado ainda
              const wait = new Promise((resolve) => setTimeout(resolve, 500));
              wait.then(() => {
                versesListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: true,
                  viewPosition: 0.3,
                });
              });
            }}
            contentContainerStyle={[
              styles.versesListContent,
              { paddingTop: 8 },
            ]}
            ListHeaderComponent={
              <View style={styles.chapterTitleContainer}>
                <Text
                  style={[
                    styles.chapterTitleH1,
                    { color: isDark ? "#e8e8e8" : "#222" },
                  ]}
                >
                  {book?.name} {currentChapter}
                </Text>
              </View>
            }
          />
        )}

        {/* Indicador discreto de carregamento de capítulo */}
        {chapterLoading && (
          <View style={styles.chapterLoadingOverlay}>
            <View style={styles.chapterLoadingIndicator}>
              <ActivityIndicator size="small" color="#2196F3" />
            </View>
          </View>
        )}
      </View>

      {/* Floating Navigation Buttons */}
      <View
        style={[
          styles.floatingNavigation,
          {
            bottom: Math.max(30, insets.bottom + 20),
            backgroundColor: isDark ? "#1e1e1e" : "#fff",
            borderWidth: isDark ? 1 : 0,
            borderColor: isDark ? "#2b2b2b" : "transparent",
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.floatingNavButton,
            isDark && { backgroundColor: "#2a2a2a" },
            (isFirstOfBible || navigating) && [
              styles.floatingNavButtonDisabled,
              isDark && { backgroundColor: "#333" },
            ],
          ]}
          onPress={() => {
            if (!navigating) {
              navigateChapter("prev");
            }
          }}
          disabled={isFirstOfBible || navigating}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={
              isFirstOfBible || navigating
                ? colorScheme.iconInactive
                : colorScheme.icon
            }
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.floatingNavButton,
            isDark && { backgroundColor: "#2a2a2a" },
            (isLastOfBible || navigating) && [
              styles.floatingNavButtonDisabled,
              isDark && { backgroundColor: "#333" },
            ],
          ]}
          onPress={() => {
            if (!navigating) {
              navigateChapter("next");
            }
          }}
          disabled={isLastOfBible || navigating}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={
              isLastOfBible || navigating
                ? colorScheme.iconInactive
                : colorScheme.icon
            }
          />
        </TouchableOpacity>
      </View>

      {/* Search Modal */}
      <Modal
        visible={searchModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSearchModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Buscar Versículos</Text>
            <TouchableOpacity onPress={() => setSearchModalVisible(false)}>
              <Ionicons name="close" size={24} color={iconColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Digite o texto que deseja buscar..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              disabled={searchLoading}
            >
              {searchLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="search" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Filtros de Testamento */}
          <View style={styles.testamentFilterBar}>
            {(
              [
                { key: "all", label: "Tudo", count: searchCounts.all },
                { key: "ot", label: "AT", count: searchCounts.ot },
                { key: "nt", label: "NT", count: searchCounts.nt },
              ] as const
            ).map((f) => {
              const active = searchTestamentFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.testamentFilterButton,
                    active && styles.testamentFilterButtonActive,
                  ]}
                  onPress={() => setSearchTestamentFilter(f.key)}
                  disabled={searchLoading}
                >
                  <Text
                    style={[
                      styles.testamentFilterText,
                      active && styles.testamentFilterTextActive,
                    ]}
                  >
                    {f.label}
                    {rawSearchResults ? ` (${f.count})` : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item, index) =>
              `${item.bookId}-${item.chapterNumber}-${item.verseNumber}-${index}`
            }
            showsVerticalScrollIndicator={false}
            style={styles.searchResultsList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="search" size={48} color="#ccc" />
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? "Nenhum resultado encontrado"
                    : "Digite um termo para buscar versículos"}
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Book Selector Modal (agora inclui capítulos) */}
      <Modal
        visible={bookSelectorVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setBookSelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.selectorModal,
              isDark && { backgroundColor: "#1e1e1e" },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                isDark && {
                  backgroundColor: "#1d1d1d",
                  borderBottomColor: "#2b2b2b",
                },
              ]}
            >
              <Text style={[styles.modalTitle, isDark && { color: "#e0e0e0" }]}>
                Escolher Livro e Capítulo
              </Text>
              <TouchableOpacity onPress={() => setBookSelectorVisible(false)}>
                <Ionicons name="close" size={24} color={iconColor} />
              </TouchableOpacity>
            </View>

            <View style={styles.booksContainer}>
              {/* Coluna dos Livros */}
              <View style={styles.booksColumn}>
                <Text
                  style={[styles.columnTitle, isDark && { color: "#e0e0e0" }]}
                >
                  Livros
                </Text>
                <FlatList
                  data={availableBooks}
                  keyExtractor={(item) => item.id.toString()}
                  showsVerticalScrollIndicator={true}
                  style={styles.booksList}
                  renderItem={({ item }) => {
                    console.log("[DEBUG] Renderizando livro:", item.name);
                    const selected = item.id === selectedBookInModal?.id;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.selectorItem,
                          isDark && { borderBottomColor: "#2a2a2a" },
                          selected &&
                            (isDark
                              ? { backgroundColor: "#263850" }
                              : styles.selectedSelectorItem),
                        ]}
                        onPress={() => selectBookInModal(item)}
                      >
                        <View style={styles.selectorItemContent}>
                          <Text
                            style={[
                              styles.selectorItemTitle,
                              isDark && { color: "#e0e0e0" },
                              selected &&
                                (isDark
                                  ? { color: "#90caf9", fontWeight: "600" }
                                  : styles.selectedSelectorItemTitle),
                            ]}
                          >
                            {item.name}
                          </Text>
                        </View>
                        {selected && (
                          <Ionicons
                            name="checkmark"
                            size={24}
                            color={isDark ? "#90caf9" : "#2196F3"}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>

              {/* Coluna dos Capítulos */}
              <View style={styles.chaptersColumn}>
                <Text
                  style={[styles.columnTitle, isDark && { color: "#e0e0e0" }]}
                >
                  Capítulos{" "}
                  {selectedBookInModal ? `- ${selectedBookInModal.name}` : ""}
                </Text>

                {loadingChapters ? (
                  <View style={styles.loadingChapters}>
                    <ActivityIndicator size="small" color="#2196F3" />
                    <Text
                      style={[
                        styles.loadingText,
                        isDark && { color: "#b0b0b0" },
                      ]}
                    >
                      Carregando capítulos...
                    </Text>
                  </View>
                ) : selectedBookInModal ? (
                  <FlatList
                    data={chaptersForSelectedBook}
                    keyExtractor={(item) => item.toString()}
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={styles.chaptersGrid}
                    renderItem={({ item: chapterNumber }) => {
                      const isCurrentChapter =
                        selectedBookInModal.id === currentBookId &&
                        chapterNumber === currentChapter;
                      return (
                        <TouchableOpacity
                          style={[
                            styles.chapterNumberItem,
                            isDark && { backgroundColor: "#2a2a2a" },
                            isCurrentChapter && styles.currentChapterItem,
                          ]}
                          onPress={() => {
                            console.log("=== MODAL CHAPTER CLICK ===");
                            console.log("Capítulo clicado:", chapterNumber);
                            console.log(
                              "Livro do modal:",
                              selectedBookInModal.id,
                              selectedBookInModal.name,
                            );
                            console.log("Livro atual:", currentBookId);
                            console.log("Capítulo atual:", currentChapter);
                            console.log(
                              "É o mesmo livro?",
                              selectedBookInModal.id === currentBookId,
                            );
                            console.log(
                              "É o mesmo capítulo?",
                              chapterNumber === currentChapter,
                            );

                            setBookSelectorVisible(false);
                            // Se o livro selecionado for diferente do atual, mudamos o livro ANTES de navegar
                            if (selectedBookInModal.id !== currentBookId) {
                              console.log("🔄 Trocando livro ANTES...");
                              selectBook(selectedBookInModal);
                            }
                            // Agora navegamos para o capítulo (já com o livro correto)
                            console.log(
                              "📍 Navegando para capítulo:",
                              chapterNumber,
                            );
                            navigateToChapter(
                              chapterNumber,
                              selectedBookInModal,
                            );
                          }}
                        >
                          <Text
                            style={[
                              styles.chapterNumberText,
                              isDark && { color: "#e0e0e0" },
                              isCurrentChapter && styles.currentChapterText,
                            ]}
                          >
                            {chapterNumber === 0 ? "Intro" : chapterNumber}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                ) : (
                  <View style={styles.emptyChapters}>
                    <Ionicons
                      name="book-outline"
                      size={48}
                      color={isDark ? "#555" : "#ccc"}
                    />
                    <Text
                      style={[styles.emptyText, isDark && { color: "#b0b0b0" }]}
                    >
                      Selecione um livro para ver os capítulos
                    </Text>
                  </View>
                )}
              </View>
            </View>
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
          <View
            style={[
              styles.notesModal,
              isDark
                ? { backgroundColor: "#232323" }
                : { backgroundColor: "#fff" },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                isDark
                  ? { backgroundColor: "#232323", borderBottomColor: "#333" }
                  : {},
              ]}
            >
              <Text
                style={[
                  styles.modalTitle,
                  isDark ? { color: "#fafafa" } : { color: "#333" },
                ]}
              >
                Notas do Versículo
              </Text>
              <TouchableOpacity onPress={() => setNotesModalVisible(false)}>
                <Ionicons name="close" size={24} color={iconColor} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.notesContent}>
              {currentNotes.map((note, index) => {
                const isLastItem = index === currentNotes.length - 1;
                return (
                  <View
                    key={index}
                    style={[styles.noteItem, isLastItem && styles.lastNoteItem]}
                  >
                    <Text
                      style={[
                        styles.noteText,
                        isDark ? { color: "#e0e0e0" } : { color: "#333" },
                      ]}
                    >
                      {note}
                    </Text>
                    {index < currentNotes.length - 1 && (
                      <View style={styles.noteDivider} />
                    )}
                  </View>
                );
              })}
            </ScrollView>
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
          <View
            style={[
              styles.referencesModal,
              isDark && { backgroundColor: "#1e1e1e" },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                isDark && {
                  backgroundColor: "#1d1d1d",
                  borderBottomColor: "#333",
                },
              ]}
            >
              <Text
                style={[
                  styles.modalTitle,
                  { color: isDark ? "#e0e0e0" : "#333" },
                ]}
              >
                Referências Bíblicas
              </Text>
              <TouchableOpacity
                onPress={() => setReferencesModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={iconColor} />
              </TouchableOpacity>
            </View>

            {/* Reference Links */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[
                styles.referenceLinksContainer,
                isDark && {
                  backgroundColor: "#2a2a2a",
                  borderBottomColor: "#444",
                },
              ]}
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
                          isDark && { backgroundColor: "#2a2a2a" },
                          index === selectedReferenceIndex &&
                            styles.selectedReferenceTab,
                        ]}
                      >
                        <Text
                          style={[
                            styles.referenceTabText,
                            { color: isDark ? "#e0e0e0" : "#333" },
                            index === selectedReferenceIndex &&
                              styles.selectedReferenceTabText,
                          ]}
                        >
                          {ref.text}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[
                        styles.moreReferencesTab,
                        isDark && { backgroundColor: "#2a2a2a" },
                      ]}
                      onPress={() => setShowAllReferences(true)}
                    >
                      <Text
                        style={[
                          styles.moreReferencesText,
                          { color: isDark ? "#e0e0e0" : "#333" },
                        ]}
                      >
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
                        isDark && { backgroundColor: "#2a2a2a" },
                        index === selectedReferenceIndex &&
                          styles.selectedReferenceTab,
                      ]}
                    >
                      <Text
                        style={[
                          styles.referenceTabText,
                          { color: isDark ? "#e0e0e0" : "#333" },
                          index === selectedReferenceIndex &&
                            styles.selectedReferenceTabText,
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
                <ActivityIndicator size="large" color="#2196F3" />
                <Text
                  style={[
                    styles.loadingText,
                    { color: isDark ? "#e0e0e0" : "#333" },
                  ]}
                >
                  Carregando referência...
                </Text>
              </View>
            ) : selectedReferenceVerse ? (
              <View style={styles.referenceContentContainer}>
                <View
                  style={[
                    styles.referenceVerseCard,
                    isDark && { backgroundColor: "#2a2a2a" },
                  ]}
                >
                  <View style={styles.referenceVerseHeader}>
                    <Text
                      style={[
                        styles.referenceVerseTitle,
                        { color: isDark ? "#e0e0e0" : "#333" },
                      ]}
                    >
                      {`${selectedReferenceBookName} ${selectedReferenceVerse.chapterNumber}:${selectedReferenceVerse.verseNumber}`}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        openSingleReference(
                          currentReferences[selectedReferenceIndex].reference,
                        )
                      }
                      style={styles.expandButton}
                    >
                      <Ionicons
                        name="expand-outline"
                        size={16}
                        color="#2196F3"
                      />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    showsVerticalScrollIndicator={true}
                    style={{ maxHeight: 400 }}
                    contentContainerStyle={{ paddingBottom: 8 }}
                  >
                    <Text
                      style={[
                        styles.referenceVerseText,
                        { color: isDark ? "#d4d4d4" : "#666" },
                      ]}
                    >
                      {selectedReferenceVerse.text}
                    </Text>
                  </ScrollView>
                </View>
              </View>
            ) : (
              <View style={styles.referenceErrorContainer}>
                <Text
                  style={[
                    styles.referenceErrorText,
                    { color: isDark ? "#b0b0b0" : "#666" },
                  ]}
                >
                  Versículo não encontrado.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Verse Reference Modal */}
      <Modal
        visible={verseRefModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setVerseRefModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.notesModal,
              isDark && { backgroundColor: "#1e1e1e" },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                isDark && {
                  backgroundColor: "#1d1d1d",
                  borderBottomColor: "#2b2b2b",
                },
              ]}
            >
              <Text style={[styles.modalTitle, isDark && { color: "#e0e0e0" }]}>
                Referência Bíblica
              </Text>
              <TouchableOpacity onPress={() => setVerseRefModalVisible(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? "#e0e0e0" : iconColor}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={[
                styles.notesContent,
                isDark && { backgroundColor: "#1e1e1e" },
              ]}
            >
              {verseRefLoading ? (
                <ActivityIndicator size="large" color="#2196F3" />
              ) : currentVerseRef ? (
                <View>
                  <Text
                    style={[
                      styles.referenceTitle,
                      isDark && { color: "#64B5F6" },
                    ]}
                  >
                    {currentVerseRefBookName
                      ? `${currentVerseRefBookName} ${currentVerseRef.chapterNumber}:${currentVerseRef.verseNumber}`
                      : `${currentVerseRef.bookId} ${currentVerseRef.chapterNumber}:${currentVerseRef.verseNumber}`}
                  </Text>
                  <Text
                    style={[styles.noteText, isDark && { color: "#d0d0d0" }]}
                  >
                    {currentVerseRef.text}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.noteText, isDark && { color: "#d0d0d0" }]}>
                  Versículo não encontrado.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bible Selector Modal */}
      <Modal
        visible={bibleSelectorVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setBibleSelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.selectorModal,
              isDark && { backgroundColor: "#1e1e1e" },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                isDark && {
                  backgroundColor: "#1d1d1d",
                  borderBottomColor: "#2b2b2b",
                },
              ]}
            >
              <View style={styles.modalHeaderLeft}>
                <Text
                  style={[styles.modalTitle, isDark && { color: "#e0e0e0" }]}
                >
                  Escolher Versão da Bíblia
                </Text>
              </View>
              <View style={styles.modalHeaderActions}>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={forceOpenBibleSelector}
                >
                  <Ionicons name="refresh" size={20} color={iconColor} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setBibleSelectorVisible(false)}
                >
                  <Ionicons name="close" size={24} color={iconColor} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.modalScrollContent}
            >
              {/* Indicador de carregamento */}
              {availableBibles.length === 0 &&
                availableDriveBibles.length === 0 && (
                  <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#2196F3" />
                    <Text
                      style={[styles.loadingText, isDark && { color: "#999" }]}
                    >
                      Carregando bíblias...
                    </Text>
                  </View>
                )}

              {/* Bíblias Baixadas */}
              {availableBibles.length > 0 && (
                <View style={styles.modalSection}>
                  <Text
                    style={[
                      styles.modalSectionTitle,
                      isDark && { color: "#e0e0e0" },
                    ]}
                  >
                    Bíblias Baixadas ({availableBibles.length})
                  </Text>

                  {availableBibles.map((item) => {
                    const selected = item.id === bibleId;
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.bibleCard,
                          isDark && {
                            backgroundColor: "#2d2d2d",
                            borderColor: "#404040",
                          },
                          selected && {
                            borderColor: isDark ? "#90caf9" : "#2196F3",
                            backgroundColor: isDark ? "#263850" : "#e3f2fd",
                          },
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.bibleCardContent}
                          onPress={() => selectBible(item)}
                        >
                          <View style={styles.bibleInfo}>
                            <Text
                              style={[
                                styles.bibleName,
                                isDark && { color: "#e0e0e0" },
                                selected && {
                                  color: isDark ? "#90caf9" : "#1976d2",
                                  fontWeight: "600",
                                },
                              ]}
                            >
                              {item.name}
                            </Text>
                            <Text
                              style={[
                                styles.bibleDetails,
                                isDark && { color: "#b0b0b0" },
                              ]}
                            >
                              {item.abbreviation}
                              {item.downloadDate && (
                                <Text style={styles.downloadDate}>
                                  {" • Baixada em "}
                                  {new Date(
                                    item.downloadDate,
                                  ).toLocaleDateString("pt-BR")}
                                </Text>
                              )}
                            </Text>
                          </View>

                          {selected && (
                            <Ionicons
                              name="checkmark-circle"
                              size={24}
                              color={isDark ? "#90caf9" : "#2196F3"}
                            />
                          )}
                        </TouchableOpacity>

                        {availableBibles.length > 1 && !selected && (
                          <TouchableOpacity
                            style={[
                              styles.deleteButton,
                              isDark && { backgroundColor: "#d32f2f" },
                            ]}
                            onPress={() => handleDeleteBible(item)}
                          >
                            <Ionicons name="trash" size={18} color="#fff" />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Bíblias Disponíveis para Download */}
              {availableDriveBibles.length > 0 && (
                <View style={styles.modalSection}>
                  <Text
                    style={[
                      styles.modalSectionTitle,
                      isDark && { color: "#e0e0e0" },
                    ]}
                  >
                    Disponíveis para Download (
                    {
                      availableDriveBibles.filter((df) => !isDownloaded(df))
                        .length
                    }
                    )
                  </Text>

                  {availableDriveBibles
                    .filter((driveFile) => !isDownloaded(driveFile))
                    .map((driveFile) => {
                      const bibleInfo = googleDriveService.parseBibleInfo(
                        driveFile.name,
                      );
                      const isDownloadingThis = downloading === driveFile.id;

                      return (
                        <View
                          key={driveFile.id}
                          style={[
                            styles.bibleCard,
                            isDark && {
                              backgroundColor: "#2d2d2d",
                              borderColor: "#404040",
                            },
                          ]}
                        >
                          <View style={styles.bibleCardContent}>
                            <View style={styles.bibleInfo}>
                              <Text
                                style={[
                                  styles.bibleName,
                                  isDark && { color: "#e0e0e0" },
                                ]}
                              >
                                {bibleInfo.name}
                              </Text>
                              <Text
                                style={[
                                  styles.bibleDetails,
                                  isDark && { color: "#b0b0b0" },
                                ]}
                              >
                                `${bibleInfo.abbreviation}$
                                {driveFile.size
                                  ? ` • ${(
                                      parseInt(driveFile.size) /
                                      1024 /
                                      1024
                                    ).toFixed(1)} MB`
                                  : ""}
                                `
                              </Text>
                            </View>
                          </View>

                          <View style={styles.bibleActions}>
                            {isDownloadingThis ? (
                              <View style={styles.downloadingContainer}>
                                <ActivityIndicator
                                  color="#2196F3"
                                  size="small"
                                />
                                <TouchableOpacity
                                  style={[
                                    styles.cancelButton,
                                    isDark && { backgroundColor: "#d32f2f" },
                                  ]}
                                  onPress={() => {
                                    setDownloading(null);
                                    Alert.alert("Info", "Download cancelado");
                                  }}
                                >
                                  <Ionicons
                                    name="close"
                                    size={14}
                                    color="#fff"
                                  />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={[
                                  styles.downloadButton,
                                  isDark && { backgroundColor: "#2196F3" },
                                ]}
                                onPress={() => {
                                  console.log(
                                    "📱 DOWNLOAD BUTTON PRESSED for:",
                                    driveFile.id,
                                    driveFile.name,
                                  );
                                  console.log(
                                    "🔍 handleDownloadBible function exists:",
                                    typeof handleDownloadBible,
                                  );
                                  handleDownloadBible(driveFile);
                                }}
                              >
                                <Ionicons
                                  name="download"
                                  size={18}
                                  color="#fff"
                                />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}

                  {/* Mensagem quando não há bíblias para download */}
                  {availableDriveBibles.filter((df) => !isDownloaded(df))
                    .length === 0 && (
                    <View style={styles.emptyState}>
                      <Ionicons
                        name="checkmark-circle"
                        size={48}
                        color="#4CAF50"
                      />
                      <Text
                        style={[styles.emptyText, isDark && { color: "#999" }]}
                      >
                        Todas as bíblias disponíveis já foram baixadas
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Estado vazio quando não há bíblias */}
              {availableBibles.length === 0 &&
                availableDriveBibles.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name="book-outline"
                      size={48}
                      color={isDark ? "#555" : "#ccc"}
                    />
                    <Text
                      style={[styles.emptyText, isDark && { color: "#999" }]}
                    >
                      Nenhuma Bíblia encontrada
                    </Text>
                  </View>
                )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Book Selector Modal */}
      {/* <Modal
          visible={bookSelectorVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setBookSelectorVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.selectorModal,
                isDark && { backgroundColor: "#1e1e1e" },
              ]}
            >
              <View
                style={[
                  styles.modalHeader,
                  isDark && {
                    backgroundColor: "#1d1d1d",
                    borderBottomColor: "#2b2b2b",
                  },
                ]}
              >
                <Text style={[styles.modalTitle, isDark && { color: "#e0e0e0" }]}>
                  Escolher Livro
                </Text>
                <TouchableOpacity onPress={() => setBookSelectorVisible(false)}>
                  <Ionicons name="close" size={24} color={iconColor} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={availableBooks}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const selected = item.id === currentBookId;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.selectorItem,
                        isDark && { borderBottomColor: "#2a2a2a" },
                        selected &&
                          (isDark
                            ? { backgroundColor: "#263850" }
                            : styles.selectedSelectorItem),
                      ]}
                      onPress={() => selectBook(item)}
                    >
                      <View style={styles.selectorItemContent}>
                        <Text
                          style={[
                            styles.selectorItemTitle,
                            isDark && { color: "#e0e0e0" },
                            selected &&
                              (isDark
                                ? { color: "#90caf9", fontWeight: "600" }
                                : styles.selectedSelectorItemTitle),
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={[
                            styles.selectorItemSubtitle,
                            isDark && { color: "#b0b0b0" },
                          ]}
                        >
                          {item.testament === "old"
                            ? "Antigo Testamento"
                            : "Novo Testamento"}
                        </Text>
                      </View>
                      {selected && (
                        <Ionicons
                          name="checkmark"
                          size={24}
                          color={isDark ? "#90caf9" : "#2196F3"}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        </Modal> */}

      {/* Settings Modal */}
      <Modal
        visible={settingsModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeSettings}
      >
        <View style={styles.settingsOverlay}>
          <View
            style={[
              styles.settingsModal,
              { backgroundColor: isDark ? "#1f1f1f" : "#fff" },
            ]}
          >
            <Text
              style={[
                styles.settingsTitle,
                { color: isDark ? "#fafafa" : "#222" },
              ]}
            >
              Configurações de Leitura
            </Text>
            <Text
              style={[
                styles.settingsSectionLabel,
                { color: isDark ? "#ddd" : "#333" },
              ]}
            >
              Tamanho da Fonte
            </Text>
            <View style={styles.settingsRow}>
              {(["small", "medium", "large"] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => saveSettings(opt, readerTheme)}
                  style={[
                    styles.optionChip,
                    readerFontSize === opt && styles.optionChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      readerFontSize === opt && styles.optionChipTextActive,
                    ]}
                  >
                    {opt === "small"
                      ? "Pequena"
                      : opt === "medium"
                        ? "Média"
                        : "Grande"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text
              style={[
                styles.settingsSectionLabel,
                { marginTop: 18, color: isDark ? "#ddd" : "#333" },
              ]}
            >
              Tema
            </Text>
            <View style={styles.settingsRow}>
              {(["light", "dark"] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => saveSettings(readerFontSize, opt)}
                  style={[
                    styles.optionChip,
                    readerTheme === opt && styles.optionChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      readerTheme === opt && styles.optionChipTextActive,
                    ]}
                  >
                    {opt === "light" ? "Claro" : "Escuro"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.settingsFooter}>
              <TouchableOpacity
                onPress={closeSettings}
                style={styles.closeSettingsButton}
              >
                <Text style={styles.closeSettingsText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Verse Options Bottom Sheet */}
      <Modal
        visible={verseOptionsVisible}
        animationType="slide"
        transparent
        onRequestClose={closeVerseOptions}
      >
        <Pressable
          style={styles.verseOptionsOverlay}
          onPress={closeVerseOptions}
        >
          <Pressable
            style={[
              styles.verseOptionsSheet,
              { backgroundColor: isDark ? "#1f1f1f" : "#fff" },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <View style={styles.sheetHandle} />

            {/* Verse reference */}
            {selectedVerseForOptions && (
              <View style={styles.sheetHeader}>
                <Text
                  style={[
                    styles.sheetTitle,
                    { color: isDark ? "#fafafa" : "#222" },
                  ]}
                >
                  {book?.name} {currentChapter}:
                  {selectedVerseForOptions.verseNumber}
                </Text>
              </View>
            )}

            {/* Options */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sheetOptionsContainer}
              style={styles.sheetOptions}
            >
              {/* Highlight toggle */}
              <TouchableOpacity
                style={styles.optionRow}
                onPress={toggleVerseHighlight}
              >
                <View
                  style={[
                    styles.optionIconContainer,
                    verseHighlighted &&
                      selectedHighlightColor && {
                        backgroundColor: selectedHighlightColor,
                      },
                  ]}
                >
                  <Ionicons
                    name={
                      verseHighlighted ? "color-fill" : "color-fill-outline"
                    }
                    size={24}
                    color={
                      verseHighlighted ? "#333" : isDark ? "#64B5F6" : "#2196F3"
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.optionLabel,
                    { color: isDark ? "#e0e0e0" : "#666" },
                  ]}
                >
                  {verseHighlighted ? "Remover" : "Destacar"}
                </Text>
              </TouchableOpacity>

              {/* Save (Bookmark) */}
              {/* <TouchableOpacity 
                style={styles.optionRow}
                onPress={handleSaveVerse}
              >
                <View style={[
                  styles.optionIconContainer,
                  { backgroundColor: isDark ? "rgba(33, 150, 243, 0.1)" : "#e3f2fd" }
                ]}>
                  <Ionicons 
                    name="bookmark-outline" 
                    size={24} 
                    color={isDark ? "#64B5F6" : "#2196F3"} 
                  />
                </View>
                <Text style={[
                  styles.optionLabel,
                  { color: isDark ? "#fafafa" : "#222" }
                ]}>
                  Salvar
                </Text>
              </TouchableOpacity> */}

              {/* Annotation */}
              <TouchableOpacity
                style={styles.optionRow}
                onPress={handleAnnotateVerse}
              >
                <View
                  style={[
                    styles.optionIconContainer,
                    {
                      backgroundColor: isDark
                        ? "rgba(33, 150, 243, 0.1)"
                        : "#e3f2fd",
                    },
                  ]}
                >
                  <Ionicons
                    name="reader-outline"
                    size={24}
                    color={isDark ? "#64B5F6" : "#2196F3"}
                  />
                </View>
                <Text
                  style={[
                    styles.optionLabel,
                    { color: isDark ? "#fafafa" : "#222" },
                  ]}
                >
                  Anotação
                </Text>
              </TouchableOpacity>

              {/* Ver Notas - apenas se o versículo tiver notas */}
              {selectedVerseForOptions &&
                (() => {
                  const verseKey = `${selectedVerseForOptions.bookId}-${selectedVerseForOptions.chapterNumber}-${selectedVerseForOptions.verseNumber}`;
                  const hasNote = verseNotes.has(verseKey);

                  if (hasNote) {
                    return (
                      <TouchableOpacity
                        style={styles.optionRow}
                        onPress={handleViewVerseNotes}
                      >
                        <View
                          style={[
                            styles.optionIconContainer,
                            {
                              backgroundColor: isDark
                                ? "rgba(255, 183, 77, 0.1)"
                                : "rgba(255, 152, 0, 0.05)",
                            },
                          ]}
                        >
                          <Ionicons
                            name="document-text"
                            size={24}
                            color={isDark ? "#FFB74D" : "#FF9800"}
                          />
                        </View>
                        <Text
                          style={[
                            styles.optionLabel,
                            { color: isDark ? "#fafafa" : "#222" },
                          ]}
                        >
                          Ver notas
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                  return null;
                })()}

              {/* Copy/Share */}
              <TouchableOpacity
                style={styles.optionRow}
                onPress={handleCopyVerse}
              >
                <View
                  style={[
                    styles.optionIconContainer,
                    {
                      backgroundColor: isDark
                        ? "rgba(33, 150, 243, 0.1)"
                        : "#e3f2fd",
                    },
                  ]}
                >
                  <Ionicons
                    name="copy-outline"
                    size={24}
                    color={isDark ? "#64B5F6" : "#2196F3"}
                  />
                </View>
                <Text
                  style={[
                    styles.optionLabel,
                    { color: isDark ? "#fafafa" : "#222" },
                  ]}
                >
                  Copiar
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Color Picker Section */}
            {showColorPicker && (
              <View
                style={[
                  styles.colorPickerSection,
                  {
                    backgroundColor: isDark ? "#2d2d2d" : "#f8f8f8",
                    borderTopColor: isDark ? "#444" : "#e0e0e0",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.colorPickerTitle,
                    { color: isDark ? "#e0e0e0" : "#666" },
                  ]}
                >
                  Escolha uma cor:
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.colorOptionsContainer}
                >
                  {highlightColors.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.colorOption}
                      onPress={() => handleColorSelect(item.color)}
                    >
                      <View
                        style={[
                          styles.colorCircle,
                          { backgroundColor: item.color },
                        ]}
                      >
                        {/* <Ionicons name="checkmark" size={20} color="#333" /> */}
                      </View>

                      <Text
                        style={[
                          styles.colorLabel,
                          { color: isDark ? "#ccc" : "#666" },
                        ]}
                      >
                        {item.label} {selectedHighlightColor}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  checkboxColumn: {
    marginRight: 8,
    alignItems: "center",
    paddingTop: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
    textAlign: "left",
  },
  headerActions: {
    flexDirection: "row",
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  navigationBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f8ff",
  },
  navButtonDisabled: {
    backgroundColor: "#f5f5f5",
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2196F3",
    marginHorizontal: 4,
  },
  navButtonTextDisabled: {
    color: "#ccc",
  },
  chapterInfo: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  versesList: {
    flex: 1,
    backgroundColor: "#fff",
  },
  versesContainer: {
    flex: 1,
    position: "relative",
  },
  chapterLoadingOverlay: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 999,
  },
  chapterLoadingIndicator: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    padding: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  verseContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  verseContainerSelected: {
    backgroundColor: "#e3f2fd",
    borderWidth: 1,
    borderColor: "#90caf9",
  },
  verseBeingNarrated: {
    backgroundColor: "#fff9c4",
    borderLeftWidth: 3,
    borderLeftColor: "#fbc02d",
    paddingLeft: 5,
  },
  verseBeingNarratedDark: {
    backgroundColor: "#3e3519",
    borderLeftColor: "#fdd835",
  },
  checkboxContainer: {
    marginRight: 8,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#2196F3",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxSelected: {
    backgroundColor: "#2196F3",
  },
  verseTextContainer: {},
  verseTextWithCheckbox: {
    paddingRight: 8,
  },
  verseNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2196F3",
  },
  verseText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
    flexWrap: "wrap",
  },
  verseButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 6,
    paddingLeft: 16,
    gap: 6,
    marginTop: 2,
  },
  inlineButton: {
    flexDirection: "row",
    width: 28,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e3f2fd",
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  inlineButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#2196F3",
  },
  inlineIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineActionButton: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(33, 150, 243, 0.05)",
  },
  verseActionButtons: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginLeft: 8,
  },
  verseActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modalHeaderLeft: {
    flex: 1,
  },
  modalHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(33, 150, 243, 0.1)",
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 0, 0, 0.1)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
    letterSpacing: 0.3,
  },
  searchContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 16,
    backgroundColor: "#f8f8f8",
  },
  searchButton: {
    width: 40,
    height: 40,
    backgroundColor: "#2196F3",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  searchResultsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchResultContainer: {
    backgroundColor: "#fff",
    padding: 16,
    marginVertical: 4,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchResultRef: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2196F3",
    marginBottom: 4,
  },
  searchResultText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 22,
  },
  testamentFilterBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  testamentFilterButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: "#f0f4f8",
    borderWidth: 1,
    borderColor: "#d0d7de",
  },
  testamentFilterButtonActive: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  testamentFilterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2196F3",
  },
  testamentFilterTextActive: {
    color: "#fff",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  verseSelectorModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    margin: 16,
    maxHeight: "75%",
    width: "95%",
  },
  verseNumberGrid: {
    maxHeight: 450,
    paddingHorizontal: 4,
    paddingBottom: 16,
  },
  verseNumbersContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    justifyContent: "space-between",
  },
  verseNumberItem: {
    width: "22%",
    height: 48,
    backgroundColor: "#f0f8ff",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    marginHorizontal: 2,
  },
  verseNumberItemText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2196F3",
  },
  currentChapterItem: {
    backgroundColor: "#2196F3",
  },
  currentChapterText: {
    color: "#fff",
  },
  notesModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    margin: 16,
    maxHeight: "85%",
    width: "95%",
  },
  notesContent: {
    maxHeight: 600,
    padding: 16,
    paddingBottom: 32,
  },
  noteItem: {
    marginBottom: 16,
  },
  lastNoteItem: {
    marginBottom: 24,
  },
  noteText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
  },
  noteDivider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginTop: 16,
  },
  referenceTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2196F3",
    marginBottom: 8,
  },
  // References Modal Styles
  referencesModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    margin: 16,
    width: "95%",
    maxHeight: "85%",
  },
  referenceLinksContainer: {
    maxHeight: 45,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  referenceLinksContent: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
  },
  referenceTabs: {
    flexDirection: "row",
    alignItems: "center",
  },
  referenceTab: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    backgroundColor: "#e3f2fd",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bbdefb",
    minWidth: 35,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  referenceTabCompact: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginRight: 3,
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbdefb",
    minWidth: 30,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  moreReferencesTab: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    minWidth: 30,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedReferenceTab: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  referenceTabText: {
    fontSize: 10,
    color: "#2196F3",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 12,
  },
  selectedReferenceTabText: {
    color: "#fff",
    fontWeight: "600",
  },
  moreReferencesText: {
    fontSize: 9,
    color: "#666",
    fontWeight: "500",
    textAlign: "center",
  },
  referenceContent: {
    flex: 1,
    padding: 16,
    minHeight: 100,
  },
  referenceLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  referenceContentContainer: {
    flex: 1,
  },
  referenceVerseCard: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  referenceVerseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  referenceVerseTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2196F3",
    flex: 1,
  },
  expandButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: "#e3f2fd",
  },
  referenceVerseText: {
    fontSize: 18,
    color: "#333",
    lineHeight: 26,
  },
  referenceErrorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  referenceErrorText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },
  // Floating Navigation Styles
  floatingNavigation: {
    position: "absolute",
    left: "50%",
    marginLeft: -67, // Half of the component width (8+50+16+50+8 = 132, so -66)
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    gap: 16,
  },
  floatingNavButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  floatingNavButtonDisabled: {
    backgroundColor: "#e9ecef",
    opacity: 0.5,
  },
  versesListContent: {
    paddingTop: 0,
    paddingBottom: 120, // Space for floating navigation buttons
  },

  // Bible/Book Selector Modal Styles
  selectorModal: {
    backgroundColor: "white",
    borderRadius: 16,
    height: "85%",
    width: "90%",
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },

  selectorItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },

  selectedSelectorItem: {
    backgroundColor: "#e3f2fd",
  },

  selectorItemContent: {
    flex: 1,
  },

  selectorItemTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },

  selectedSelectorItemTitle: {
    color: "#2196F3",
    fontWeight: "600",
  },

  selectorItemSubtitle: {
    fontSize: 12,
    color: "#666",
  },

  fixedChapterHeader: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: "#fff",
  },

  chapterHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  chapterHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  versionBadge: {
    backgroundColor: "#4b4f52ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  versionBadgeText: {
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 0.5,
    fontSize: 13,
  },
  versionHeaderBadge: {
    marginLeft: 4,
    backgroundColor: "#2196F3",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  versionHeaderBadgeText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
    letterSpacing: 0.5,
  },

  chapterTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
  },
  settingsButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "transparent",
  },

  verseTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2196F3",
    marginBottom: 2, // Reduced from 8 to bring closer to verse
    fontStyle: "italic",
  },

  verseTitleContainer: {
    marginBottom: 5,
  },

  verseTitleLevel2: {
    fontSize: 15,
    color: "#4CAF50",
  },

  verseTitleLevel3: {
    fontSize: 14,
    color: "#FF9800",
  },
  // Settings Modal Styles
  settingsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  settingsModal: {
    width: "88%",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  settingsSectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
    marginBottom: 8,
  },
  settingsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: "#f0f4f7",
    borderWidth: 1,
    borderColor: "#d0d7de",
  },
  optionChipActive: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2196F3",
  },
  optionChipTextActive: {
    color: "#fff",
  },
  settingsFooter: {
    marginTop: 28,
    alignItems: "flex-end",
  },
  closeSettingsButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#2196F3",
    borderRadius: 24,
  },
  closeSettingsText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  // Note Modal Styles
  noteModal: {
    width: "90%",
    maxHeight: "80%",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  noteModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  noteModalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  noteModalCloseButton: {
    padding: 4,
  },
  noteModalEditButton: {
    padding: 4,
  },
  noteModalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    fontWeight: "500",
  },
  formattingToolbar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 4,
  },
  formatButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  formatButtonLabel: {
    fontSize: 18,
    fontWeight: "600",
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 150,
    marginBottom: 20,
  },
  noteViewContainer: {
    borderRadius: 12,
    padding: 16,
    minHeight: 150,
    marginBottom: 20,
  },
  noteViewText: {
    fontSize: 15,
    lineHeight: 22,
  },
  noteInputReadOnly: {
    opacity: 0.7,
    backgroundColor: "transparent",
  },
  noteModalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  noteModalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  noteModalCancelButton: {
    backgroundColor: "#e0e0e0",
  },
  noteModalCancelText: {
    color: "#333",
    fontSize: 15,
    fontWeight: "600",
  },
  noteModalSaveButton: {
    backgroundColor: "#2196F3",
  },
  noteModalSaveText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  noteModalDeleteButton: {
    backgroundColor: "#f44336",
  },
  noteModalDeleteText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  noteModalButtonDisabled: {
    opacity: 0.5,
  },
  saveNoteButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#e0e0e0",
  },
  saveNoteButtonDisabled: {
    opacity: 0.5,
  },
  saveNoteButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  noteInputMain: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 120,
    marginTop: 16,
    marginBottom: 12,
  },
  privacyToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  privacyToggleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  privacyToggleText: {
    fontSize: 15,
    fontWeight: "500",
  },
  selectedVerseContainer: {
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
  },
  selectedVerseHeader: {
    marginBottom: 8,
  },
  selectedVerseNumber: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  selectedVerseText: {
    fontSize: 15,
    lineHeight: 22,
  },
  selectedVerseReference: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: "500",
  },

  booksContainer: {
    flexDirection: "row",
    flex: 1,
  },
  booksColumn: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: "#e0e0e0",
  },
  chaptersColumn: {
    flex: 1,
    padding: 8,
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: "600",
    padding: 16,
    paddingBottom: 8,
    color: "#333",
  },
  booksList: {
    flex: 1,
  },
  chaptersGrid: {
    padding: 8,
  },
  chapterNumberItem: {
    width: "100%",
    height: 50,
    backgroundColor: "#f0f8ff",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    margin: 4,
  },
  chapterNumberText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2196F3",
  },
  loadingChapters: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyChapters: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 16,
    color: "#95a5a6",
    textAlign: "center",
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  downloadButton: {
    backgroundColor: "#2196F3",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
    elevation: 2,
    shadowColor: "#2196F3",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  downloadingButton: {
    backgroundColor: "#999",
  },
  downloadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  cancelButton: {
    backgroundColor: "#f44336",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: "#f44336",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  bibleEmptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },

  modalScrollContent: {
    flex: 1,
  },
  modalSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
  },
  modalSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  bibleCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "#e8e8e8",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  bibleCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    flex: 1,
    minHeight: 70,
  },
  bibleInfo: {
    flex: 1,
  },
  bibleName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 6,
    letterSpacing: 0.2,
    lineHeight: 22,
  },
  bibleDetails: {
    fontSize: 14,
    color: "#7f8c8d",
    lineHeight: 19,
    letterSpacing: 0.1,
  },
  downloadDate: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
  bibleActions: {
    marginLeft: 16,
  },
  // Estilos para a introdução
  introductionContent: {
    paddingHorizontal: 16,
    paddingBottom: 100, // espaço para os botões flutuantes
  },
  introductionContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  introductionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  introductionSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#34495e",
    marginBottom: 20,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  introductionTextContainer: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#3498db",
  },
  introductionText: {
    fontSize: 16,
    lineHeight: 26,
    color: "#2c3e50",
    textAlign: "justify",
    letterSpacing: 0.2,
  },
  chapterTitleContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  chapterTitleH1: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  introButton: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  // Verse Options Bottom Sheet styles
  verseOptionsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  verseOptionsSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    minHeight: 240,
    maxHeight: "35%",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#222",
    textAlign: "center",
  },
  sheetOptions: {
    paddingTop: 16,
  },
  sheetOptionsContainer: {
    paddingHorizontal: 20,
    gap: 20,
  },
  optionRow: {
    flexDirection: "column",
    alignItems: "center",
    width: 90,
  },
  optionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#222",
    textAlign: "center",
  },
  colorPickerSection: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  colorPickerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
  },
  colorOptionsContainer: {
    flexDirection: "row",
    gap: 16,
  },
  colorOption: {
    alignItems: "center",
    width: 70,
  },
  colorCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  colorLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  highlightToggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  highlightToggleActive: {
    backgroundColor: "#FDD835",
  },
  highlightToggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  highlightToggleCircleActive: {
    alignSelf: "flex-end",
  },
});
