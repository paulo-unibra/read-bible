import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import QuizButton from "../components/QuizButton";
import AudioService from "../services/AudioService";
import bibleReaderService from "../services/BibleReaderService";
import DatabaseService from "../services/DatabaseService";
import googleDriveService from "../services/GoogleDriveService";
import { Bible, Book, DriveFile, SearchResult, Verse } from "../types";

export default function ChapterReaderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [chaptersForSelectedBook, setChaptersForSelectedBook] = useState<
    number[]
  >([]);

  const [selectedBookInModal, setSelectedBookInModal] = useState<Book | null>(
    null
  );

  const bibleId = params.bibleId as string;
  const initialBookId = parseInt(params.bookId as string);
  const initialChapter = parseInt(params.chapterNumber as string);

  const [bibleAbbrev, setBibleAbbrev] = useState<string>("");
  const [book, setBook] = useState<Book | null>(null);
  const [currentBookId, setCurrentBookId] = useState(initialBookId);
  const [currentChapter, setCurrentChapter] = useState(initialChapter);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [totalChapters, setTotalChapters] = useState(0);
  const [loading, setLoading] = useState(true);

  const [navigating, setNavigating] = useState(false); // Prevent rapid navigation
  const [isFirstOfBible, setIsFirstOfBible] = useState(false);
  const [isLastOfBible, setIsLastOfBible] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);

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
      /Mateus|Matthew/i.test(b.name)
    );
    if (newStartIndex === -1) {
      if (booksList.length >= 66) newStartIndex = 39;
      else newStartIndex = Math.round(booksList.length * 0.6);
    }
    booksList.forEach((b, idx) =>
      map.set(b.id, idx < newStartIndex ? "old" : "new")
    );
    return map;
  };

  // Bible selector modal state
  const [bibleSelectorVisible, setBibleSelectorVisible] = useState(false);
  const [availableBibles, setAvailableBibles] = useState<Bible[]>([]);
  const [availableDriveBibles, setAvailableDriveBibles] = useState<DriveFile[]>(
    []
  );
  const [downloading, setDownloading] = useState<string | null>(null);

  // Book selector modal state
  const [bookSelectorVisible, setBookSelectorVisible] = useState(false);
  const [availableBooks, setAvailableBooks] = useState<Book[]>([]);

  // Notes modal state
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [currentNotes, setCurrentNotes] = useState<string[]>([]);

  // Verse reference modal state (for single reference display)
  const [verseRefModalVisible, setVerseRefModalVisible] = useState(false);
  const [currentVerseRef, setCurrentVerseRef] = useState<Verse | null>(null);
  const [verseRefLoading, setVerseRefLoading] = useState(false);

  // References modal state
  const [referencesModalVisible, setReferencesModalVisible] = useState(false);
  const [currentReferences, setCurrentReferences] = useState<
    { text: string; reference: string; position: number }[]
  >([]);
  const [selectedReferenceIndex, setSelectedReferenceIndex] = useState(0);
  const [selectedReferenceVerse, setSelectedReferenceVerse] =
    useState<Verse | null>(null);
  const [referenceVerseLoading, setReferenceVerseLoading] = useState(false);
  const [showAllReferences, setShowAllReferences] = useState(false);

  // Reader Preferences (fonte e tema)
  const [readerFontSize, setReaderFontSize] = useState<
    "small" | "medium" | "large"
  >("medium");
  const [readerTheme, setReaderTheme] = useState<"light" | "dark">("light");
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const fs = (await DatabaseService.getSetting("fontSize")) as
          | "small"
          | "medium"
          | "large"
          | null;
        const th = (await DatabaseService.getSetting("theme")) as
          | "light"
          | "dark"
          | null;
        if (fs) setReaderFontSize(fs);
        if (th) setReaderTheme(th);
      } catch (e) {
        console.warn("Falha ao carregar preferências de leitura", e);
      }
    })();
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
    theme: "light" | "dark"
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
    if (!bibleId || !currentBookId || !currentChapter) return;
    try {
      const versesData = await bibleReaderService.getVerses(
        bibleId,
        currentBookId,
        currentChapter
      );
      setVerses(versesData);
    } catch (error) {
      console.error("Error loading verses:", error);
      Alert.alert("Erro", "Falha ao carregar versículos");
    }
  }, [bibleId, currentBookId, currentChapter]);

  const checkAudioAvailability = React.useCallback(async () => {
    if (!currentBookId || !currentChapter) return;
    try {
      const available = await AudioService.isAudioAvailable(currentBookId, currentChapter);
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
        const atFirstOfBible = currentBookId === firstBook?.id && chapter === 1;
        setIsFirstOfBible(atFirstOfBible);
        if (currentBookId === lastBook?.id) {
          const chapters = await bibleReaderService.getChapters(
            bibleId,
            lastBook.id
          );
          const atLastOfBible = chapter === chapters.length;
          setIsLastOfBible(atLastOfBible);
        } else {
          setIsLastOfBible(false);
        }
      } catch (error) {
        console.error("Error updating navigation state:", error);
      }
    },
    [bibleId, currentBookId, currentChapter]
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
        currentBookId
      );
      setTotalChapters(chapters.length);

      // Os versículos serão carregados pelo useEffect do currentChapter
      await updateNavigationState();
      // Verifica disponibilidade do áudio para o capítulo atual
      await checkAudioAvailability();

      try {
        if (bibleId && currentBookId && currentChapter) {
          await DatabaseService.saveLastReading(
            bibleId,
            currentBookId,
            currentChapter
          );
        } else {
          console.warn(
            "[DEBUG] Valores inválidos detectados ao salvar posição de leitura:",
            {
              bibleId,
              currentBookId,
              currentChapter,
            }
          );
        }
      } catch (error) {
        console.error("[DEBUG] Erro ao salvar posição de leitura:", error);
      }
    } catch (error) {
      console.error("Error initializing reader:", error);
      Alert.alert("Erro", "Falha ao carregar capítulo");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [
    bibleId,
    currentBookId,
    currentChapter,
    router,
    updateNavigationState,
    checkAudioAvailability,
  ]);

  useEffect(() => {
    if (bibleId && currentBookId) {
      initializeReader();
    }
  }, [bibleId, currentBookId, initializeReader]);

  // Efeito separado para carregar apenas versículos quando o capítulo muda
  useEffect(() => {
    if (bibleId && currentBookId && currentChapter && !loading) {
      loadChapterVerses();
      checkAudioAvailability();
    }
  }, [currentChapter, loadChapterVerses, checkAudioAvailability, bibleId, currentBookId, loading]);

  useEffect(() => {
    return () => {
      AudioService.cleanup();
    };
  }, []);

  const navigateChapter = async (direction: "prev" | "next") => {
    if (navigating || loading) return;

    setNavigating(true);

    try {
      let newChapter = currentChapter;

      console.log(
        "currentChapter:",
        currentChapter,
        "totalChapters:",
        totalChapters
      );

      if (direction === "prev") {
        if (currentChapter > 1) {
          newChapter = currentChapter - 1;
        } else {
          setIsFirstOfBible(true);
          await navigateToAdjacentBook("prev");
          return;
        }
      } else {
        if (currentChapter < totalChapters) {
          newChapter = currentChapter + 1;
        } else {
          await navigateToAdjacentBook("next");
          return;
        }
      }

      if (newChapter > 0 && newChapter <= totalChapters) {
        setCurrentChapter(newChapter);
        // Os versículos serão carregados automaticamente pelo useEffect do currentChapter
        await updateNavigationState(newChapter);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error navigating chapter:", error);

      Alert.alert(
        "Erro de Navegação",
        `Falha ao navegar para o capítulo: ${errorMessage}`,
        [{ text: "OK" }]
      );
    } finally {
      setNavigating(false);
    }
  };

  const openBibleSelector = async () => {
    try {
      const bibles = await DatabaseService.getBibles();
      console.log("PASSOU openBibleSelector");
      setAvailableBibles(bibles);

      // Carregar também as Bíblias disponíveis no Drive
      try {
        const driveFiles = await googleDriveService.listBibleFiles();
        setAvailableDriveBibles(driveFiles);
      } catch (driveError) {
        console.warn("Error loading Drive bibles:", driveError);
        // Não impede a abertura do modal se falhar
      }

      setBibleSelectorVisible(true);
    } catch (error) {
      console.error("Error loading bibles 1:", error);
      Alert.alert("Erro", "Falha ao carregar versões da Bíblia");
    }
  };

  const handleDownloadBible = async (driveFile: DriveFile) => {
    try {
      setDownloading(driveFile.id);

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
      setAvailableBibles(updatedLocalBibles);

      Alert.alert("Sucesso", `Bíblia "${bible.name}" baixada com sucesso!`);
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

              const updatedLocalBibles = await DatabaseService.getBibles();
              setAvailableBibles(updatedLocalBibles);

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
        `/chapter-reader?bibleId=${selectedBible.id}&bookId=${currentBookId}&chapterNumber=${currentChapter}`
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
        selectedBook.id
      );
      setTotalChapters(chapters.length);
    } catch (error) {
      console.error("Erro ao trocar livro:", error);
      Alert.alert("Erro", "Falha ao carregar capítulos do livro selecionado");
    } finally {
      setLoading(false);
    }
  };

  const navigateToAdjacentBook = async (direction: "prev" | "next") => {
    try {
      setLoading(true);

      const books = await bibleReaderService.getBooks(bibleId);
      const currentBookIndex = books.findIndex((b) => b.id === currentBookId);

      let newBookIndex =
        direction === "prev" ? currentBookIndex - 1 : currentBookIndex + 1;

      if (newBookIndex < 0 || newBookIndex >= books.length) {
        Alert.alert(
          "Aviso",
          direction === "prev"
            ? "Você já está no primeiro capítulo da Bíblia"
            : "Você já está no último capítulo da Bíblia"
        );
        return;
      }

      const newBook = books[newBookIndex];
      const newBookChapters = await bibleReaderService.getChapters(
        bibleId,
        newBook.id
      );
      const newChapter = direction === "prev" ? newBookChapters.length : 1;

      setBook(newBook);
      setCurrentBookId(newBook.id);
      setCurrentChapter(newChapter);
      setTotalChapters(newBookChapters.length);

      const versesData = await bibleReaderService.getVerses(
        bibleId,
        newBook.id,
        newChapter
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
      localMap?: Map<number, "old" | "new"> | null
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
    [bookTestamentMap]
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
            "Não foi possível carregar mapa de testamentos agora, usando fallback heurístico."
          );
        }
      }

      let results = await bibleReaderService.searchVerses(
        bibleId,
        searchQuery.trim(),
        SEARCH_RESULTS_LIMIT
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
        applySearchFilter(searchTestamentFilter, results, localMap)
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
        applySearchFilter(searchTestamentFilter, rawSearchResults)
      );
    }
  }, [searchTestamentFilter, rawSearchResults, applySearchFilter]);

  const navigateToSearchResult = async (result: SearchResult) => {
    setSearchModalVisible(false);
    setSearchQuery("");
    setSearchResults([]);

    try {
      setLoading(true);

      if (result.bookId !== currentBookId) {
        const books = await bibleReaderService.getBooks(bibleId);
        const newBook = books.find((b) => b.id === result.bookId);
        if (newBook) {
          setBook(newBook);
          setCurrentBookId(newBook.id);

          const chapters = await bibleReaderService.getChapters(
            bibleId,
            result.bookId
          );
          setTotalChapters(chapters.length);
        }
      }

      setCurrentChapter(result.chapterNumber);

      const versesData = await bibleReaderService.getVerses(
        bibleId,
        result.bookId,
        result.chapterNumber
      );
      setVerses(versesData);
    } catch (error) {
      console.error("Error navigating to search result:", error);
      Alert.alert("Erro", "Falha ao navegar para o resultado da busca");
    } finally {
      setLoading(false);
    }
  };

  const navigateToChapter = async (chapterNumber: number, book?: Book) => {
    if (!bibleId || !currentBookId || chapterNumber < 1) return;

    try {
      setLoading(true);

      if (book && book.id !== currentBookId) {
        setBook(book);
        setCurrentBookId(book.id);

        const chapters = await bibleReaderService.getChapters(bibleId, book.id);
        setTotalChapters(chapters.length);
      }

      setCurrentChapter(chapterNumber);

      const versesData = await bibleReaderService.getVerses(
        bibleId,
        book ? book.id : currentBookId,
        chapterNumber
      );

      setVerses(versesData);
    } catch (error) {
      console.error("Error navigating to chapter:", error);
      Alert.alert("Erro", "Falha ao carregar o capítulo");
    } finally {
      setLoading(false);
    }
  };

  const openNotes = (notes: string[]) => {
    setCurrentNotes(notes);
    setNotesModalVisible(true);
  };

  const openReferencesModal = async (
    references: { text: string; reference: string; position: number }[]
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
    references?: { text: string; reference: string; position: number }[]
  ) => {
    const refs = references || currentReferences;
    if (index < 0 || index >= refs.length || !bibleId) return;

    try {
      setReferenceVerseLoading(true);
      const verse = await bibleReaderService.getVerseByReference(
        bibleId,
        refs[index].reference
      );

      if (verse) {
        setSelectedReferenceVerse(verse);
        setSelectedReferenceIndex(index);
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
        reference
      );

      if (verse) {
        setCurrentVerseRef(verse);
        setVerseRefModalVisible(true);
      } else {
        Alert.alert(
          "Versículo não encontrado",
          `Não foi possível encontrar a referência: ${reference}`
        );
      }
    } catch (error) {
      console.error("Error loading verse reference:", error);
      Alert.alert("Erro", "Falha ao carregar referência do versículo");
    } finally {
      setVerseRefLoading(false);
    }
  };



  // Handle long press on verse
  const handleVerseLongPress = (verse: Verse) => {
    const verseKey = `${verse.bookId}-${verse.chapterNumber}-${verse.verseNumber}`;
    setSelectionMode(true);


    // Add the long-pressed verse to selection
    const newSelected = new Set(selectedVerses);
    newSelected.add(verseKey);
    setSelectedVerses(newSelected);
  };

  // Handle verse selection in selection mode
  const handleVerseSelection = (verse: Verse) => {
    if (!selectionMode) return;

    const verseKey = `${verse.bookId}-${verse.chapterNumber}-${verse.verseNumber}`;
    const newSelected = new Set(selectedVerses);

    if (newSelected.has(verseKey)) {
      newSelected.delete(verseKey);
    } else {
      newSelected.add(verseKey);
    }

    setSelectedVerses(newSelected);

    // Exit selection mode if no verses selected
    if (newSelected.size === 0) {
      setSelectionMode(false);

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
        `${verse.bookId}-${verse.chapterNumber}-${verse.verseNumber}`
      )
    );

    const sortedVerses = selectedVersesData.sort(
      (a, b) => a.verseNumber - b.verseNumber
    );

    const versesText = sortedVerses
      .map((verse) => `${verse.verseNumber} - ${cleanVerseText(verse.text)}`)
      .join("\n");

    const verseNumbers = sortedVerses.map((v) => v.verseNumber);
    const verseRange =
      verseNumbers.length === 1
        ? verseNumbers[0].toString()
        : `${Math.min(...verseNumbers)}-${Math.max(...verseNumbers)}`;

    const shareText = `${versesText}

  ${book?.name} ${verseRange}

  Aplicativo Palavra em Jogo
  Link do app: https://readbible.app`;

    const shareTitle =
      selectedVerses.size === 1
        ? `Versículo ${book?.name} ${sortedVerses[0].chapterNumber}:${sortedVerses[0].verseNumber}`
        : `${selectedVerses.size} versículos de ${book?.name} ${currentChapter}`;

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

  const renderVerseText = (text: string, verse: Verse) => {
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    const symbolRegex = /([✚ℕ])/g;
    let match: RegExpExecArray | null;
    while ((match = symbolRegex.exec(text)) !== null) {
      if (match.index > cursor) {
        parts.push(
          <Text key={`seg-${cursor}`}>
            {text.substring(cursor, match.index)}
          </Text>
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
          </Text>
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
          </Text>
        );
      }
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) {
      parts.push(<Text key={`tail-${cursor}`}>{text.substring(cursor)}</Text>);
    }
    return <>{parts}</>;
  };

  // Renderização dos títulos já com estilo neutro
  const renderTitleText = (titleText: string, level: number = 1) => {
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
        {titleText}
      </Text>
    );
  };

  const renderVerse = ({ item }: { item: Verse }) => {
    const favoriteKey = `${item.bookId}-${item.chapterNumber}-${item.verseNumber}`;
    const isSelected = selectedVerses.has(favoriteKey);
    return (
      <View
        style={[
          styles.verseContainer,
          { flexDirection: "column" }, // títulos acima
          isDark && { backgroundColor: "#121212" },
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
            { flexDirection: "row", alignItems: "flex-start" },
            isSelected && styles.verseContainerSelected,
            isSelected && isDark && { backgroundColor: "#263850" },
          ]}
          onPress={() =>
            selectionMode ? handleVerseSelection(item) : undefined
          }
          onLongPress={() => handleVerseLongPress(item)}
          delayLongPress={500}
        >
          {selectionMode && (
            <View style={styles.checkboxColumn}>
              <View style={styles.checkboxContainer}>
                <View
                  style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected,
                  ]}
                >
                  {isSelected && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </View>
              </View>
            </View>
          )}

          <View
            style={[
              styles.verseTextContainer,
              selectionMode && styles.verseTextWithCheckbox,
              { flex: 1 },
            ]}
          >
            <Text style={[styles.verseText, verseTextDynamic]}>
              <Text
                style={[
                  styles.verseNumber,
                  isDark && { color: colorScheme.verseNumber },
                ]}
              >
                {item.verseNumber}
              </Text>
              <Text style={{ fontWeight: "bold", color: colorScheme.dash }}>
                {" "}
                -{" "}
              </Text>
              {renderVerseText(item.text, item)}
            </Text>
            <View style={styles.verseButtonsRow}>
              {/* vazio (refs/notas inline) */}
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

  if (loading) {
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
        selectedBook.id
      );
      const chapterNumbers = Array.from(
        { length: chapters.length },
        (_, i) => i + 1
      );
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
              onPress={openBibleSelector}
              style={styles.versionHeaderBadge}
            >
              <Text style={styles.versionHeaderBadgeText}>{bibleAbbrev}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.headerActions}>
          {selectionMode && selectedVerses.size > 0 && (
            <>
              <TouchableOpacity
                onPress={shareSelectedVerses}
                style={styles.headerButton}
              >
                <Ionicons name="share-outline" size={24} color={iconColor} />
              </TouchableOpacity>
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
            </>
          )}
          {!selectionMode && (
            <>
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
            </>
          )}
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
          <Text
            style={[styles.chapterTitle, { color: isDark ? "#ddd" : "#666" }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {book?.name} {currentChapter}
          </Text>
          <View style={styles.chapterHeaderActions}>
            {book && (
              <>
                <QuizButton
                  bookId={currentBookId}
                  chapterNumber={currentChapter}
                  bookName={book.name}
                  bibleVersion={bibleAbbrev}
                  isDark={isDark}
                />
                {audioAvailable && (
                  <AudioPlayer
                    bookId={currentBookId}
                    chapterNumber={currentChapter}
                    bookName={book.name}
                    isDark={isDark}
                    onRequestNext={async () => {
                      if (navigating || loading) return;
                      const prevChapter = currentChapter;
                      await navigateChapter("next");
                      const targetChapter = prevChapter + 1;
                      setTimeout(() => {
                        AudioService.loadAndPlay(
                          currentBookId,
                          targetChapter
                        ).catch(() => {});
                      }, 500);
                    }}
                  />
                )}
              </>
            )}
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

      {/* Verses List */}
      <FlatList
        data={verses}
        renderItem={renderVerse}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        style={[styles.versesList, versesListBg]}
        contentContainerStyle={[styles.versesListContent, { paddingTop: 8 }]}
      />

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
            (isFirstOfBible || navigating || loading) && [
              styles.floatingNavButtonDisabled,
              isDark && { backgroundColor: "#333" },
            ],
          ]}
          onPress={() => {
            if (!navigating && !loading) {
              navigateChapter("prev");
            }
          }}
          disabled={isFirstOfBible || navigating || loading}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={
              isFirstOfBible || navigating || loading
                ? colorScheme.iconInactive
                : colorScheme.icon
            }
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.floatingNavButton,
            isDark && { backgroundColor: "#2a2a2a" },
            (isLastOfBible || navigating || loading) && [
              styles.floatingNavButtonDisabled,
              isDark && { backgroundColor: "#333" },
            ],
          ]}
          onPress={() => {
            if (!navigating && !loading) {
              navigateChapter("next");
            }
          }}
          disabled={isLastOfBible || navigating || loading}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={
              isLastOfBible || navigating || loading
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
                            setBookSelectorVisible(false);
                            navigateToChapter(chapterNumber);
                            // Se o livro selecionado for diferente do atual, também mudamos o livro
                            if (selectedBookInModal.id !== currentBookId) {
                              selectBook(selectedBookInModal);
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.chapterNumberText,
                              isDark && { color: "#e0e0e0" },
                              isCurrentChapter && styles.currentChapterText,
                            ]}
                          >
                            {chapterNumber}
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
              // calculateModalHeight()
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Referências Bíblicas</Text>
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
              style={styles.referenceLinksContainer}
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
                          index === selectedReferenceIndex &&
                            styles.selectedReferenceTab,
                        ]}
                      >
                        <Text
                          style={[
                            styles.referenceTabText,
                            index === selectedReferenceIndex &&
                              styles.selectedReferenceTabText,
                          ]}
                        >
                          {ref.text}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={styles.moreReferencesTab}
                      onPress={() => setShowAllReferences(true)}
                    >
                      <Text style={styles.moreReferencesText}>
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
                        index === selectedReferenceIndex &&
                          styles.selectedReferenceTab,
                      ]}
                    >
                      <Text
                        style={[
                          styles.referenceTabText,
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
                <Text style={styles.loadingText}>Carregando referência...</Text>
              </View>
            ) : selectedReferenceVerse ? (
              <View style={styles.referenceVerseCard}>
                <View style={styles.referenceVerseHeader}>
                  <Text style={styles.referenceVerseTitle}>
                    {`${selectedReferenceVerse.bookId} ${selectedReferenceVerse.chapterNumber}:${selectedReferenceVerse.verseNumber}`}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      openSingleReference(
                        currentReferences[selectedReferenceIndex].reference
                      )
                    }
                    style={styles.expandButton}
                  >
                    <Ionicons name="expand-outline" size={16} color="#2196F3" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.referenceVerseText}>
                  {selectedReferenceVerse.text}
                </Text>
              </View>
            ) : (
              <View style={styles.referenceErrorContainer}>
                <Text style={styles.referenceErrorText}>
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
          <View style={styles.notesModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Referência Bíblica</Text>
              <TouchableOpacity onPress={() => setVerseRefModalVisible(false)}>
                <Ionicons name="close" size={24} color={iconColor} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.notesContent}>
              {verseRefLoading ? (
                <ActivityIndicator size="large" color="#2196F3" />
              ) : currentVerseRef ? (
                <View>
                  <Text style={styles.referenceTitle}>
                    {`${currentVerseRef.bookId} ${currentVerseRef.chapterNumber}:${currentVerseRef.verseNumber}`}
                  </Text>
                  <Text style={styles.noteText}>{currentVerseRef.text}</Text>
                </View>
              ) : (
                <Text style={styles.noteText}>Versículo não encontrado.</Text>
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
              <Text style={[styles.modalTitle, isDark && { color: "#e0e0e0" }]}>
                Escolher Versão da Bíblia
              </Text>
              <TouchableOpacity onPress={() => setBibleSelectorVisible(false)}>
                <Ionicons name="close" size={24} color={iconColor} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Bíblias Baixadas */}
              {availableBibles.length > 0 && (
                <>
                  <Text
                    style={[
                      styles.sectionTitle,
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
                          styles.selectorItem,
                          isDark && { borderBottomColor: "#2a2a2a" },
                        ]}
                      >
                        <TouchableOpacity
                          style={[
                            styles.selectorItemContent,
                            selected &&
                              (isDark
                                ? { backgroundColor: "#263850" }
                                : styles.selectedSelectorItem),
                          ]}
                          onPress={() => selectBible(item)}
                        >
                          <View style={{ flex: 1 }}>
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
                              {item.abbreviation}
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

                        {availableBibles.length > 1 && (
                          <TouchableOpacity
                            style={[
                              styles.deleteButton,
                              isDark && { backgroundColor: "#d32f2f" },
                            ]}
                            onPress={() => handleDeleteBible(item)}
                          >
                            <Ionicons name="trash" size={20} color="#fff" />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </>
              )}

              {/* Bíblias Disponíveis para Download */}
              {availableDriveBibles.length > 0 && (
                <>
                  <Text
                    style={[
                      styles.sectionTitle,
                      isDark && { color: "#e0e0e0" },
                      { marginTop: 20 },
                    ]}
                  >
                    Disponíveis para Download (
                    {
                      availableDriveBibles.filter(
                        (driveFile) => !isDownloaded(driveFile)
                      ).length
                    }
                    )
                  </Text>
                  {availableDriveBibles
                    .filter((driveFile) => !isDownloaded(driveFile))
                    .map((driveFile) => {
                      const bibleInfo = googleDriveService.parseBibleInfo(
                        driveFile.name
                      );
                      const isDownloadingThis = downloading === driveFile.id;

                      return (
                        <View
                          key={driveFile.id}
                          style={[
                            styles.selectorItem,
                            isDark && { borderBottomColor: "#2a2a2a" },
                          ]}
                        >
                          <View style={styles.selectorItemContent}>
                            <Text
                              style={[
                                styles.selectorItemTitle,
                                isDark && { color: "#e0e0e0" },
                              ]}
                            >
                              {bibleInfo.name}
                            </Text>
                            <Text
                              style={[
                                styles.selectorItemSubtitle,
                                isDark && { color: "#b0b0b0" },
                              ]}
                            >
                              {bibleInfo.abbreviation}{" "}
                              {driveFile.size &&
                                ` • ${(
                                  parseInt(driveFile.size) /
                                  1024 /
                                  1024
                                ).toFixed(1)} MB`}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.downloadButton,
                              isDownloadingThis && styles.downloadingButton,
                              isDark && {
                                backgroundColor: isDownloadingThis
                                  ? "#666"
                                  : "#2196F3",
                              },
                            ]}
                            onPress={() => handleDownloadBible(driveFile)}
                            disabled={isDownloadingThis}
                          >
                            {isDownloadingThis ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <Ionicons
                                name="download"
                                size={20}
                                color="#fff"
                              />
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                </>
              )}

              {availableBibles.length === 0 &&
                availableDriveBibles.length === 0 && (
                  <View style={styles.bibleEmptyState}>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  versesList: {
    flex: 1,
    backgroundColor: "#fff",
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

  modalContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
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
    paddingVertical: 48,
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
    maxHeight: "75%",
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
  referenceVerseCard: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
    minHeight: 80,
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
    borderRadius: 12,
    height: "80%",
    width: "85%",
    overflow: "hidden",
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
    marginTop: 16,
    fontSize: 14,
    color: "#999",
    textAlign: "center",
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
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
    marginLeft: 12,
  },
  bibleEmptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
});
