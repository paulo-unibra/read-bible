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
import bibleReaderService from "../services/BibleReaderService";
import DatabaseService from "../services/DatabaseService";
import { Bible, Book, SearchResult, Verse } from "../types";

  export default function ChapterReaderScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const insets = useSafeAreaInsets();

    const [chaptersForSelectedBook, setChaptersForSelectedBook] =
      useState<number[]>([]);

    const [selectedBookInModal, setSelectedBookInModal] = useState<Book | null>(
      null
    );

    // URL params: bibleId, bookId, chapterNumber
    const bibleId = params.bibleId as string;
    const initialBookId = parseInt(params.bookId as string);
    const initialChapter = parseInt(params.chapterNumber as string);

    // Abreviação da Bíblia atual para exibir no header
    const [bibleAbbrev, setBibleAbbrev] = useState<string>("");
    const [book, setBook] = useState<Book | null>(null);
    const [currentBookId, setCurrentBookId] = useState(initialBookId);
    const [currentChapter, setCurrentChapter] = useState(initialChapter);
    const [verses, setVerses] = useState<Verse[]>([]);
    const [totalChapters, setTotalChapters] = useState(0);
    const [loading, setLoading] = useState(true);
    // Favoritos desativados temporariamente (estado removido)
    const [navigating, setNavigating] = useState(false); // Prevent rapid navigation
    const [isFirstOfBible, setIsFirstOfBible] = useState(false);
    const [isLastOfBible, setIsLastOfBible] = useState(false);
    const [loadingChapters, setLoadingChapters] = useState(false);

    // Search modal state
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

    // Constrói mapa de testamentos de forma resiliente (suporta bases não padronizadas)
    const buildTestamentMap = (booksList: Book[]): Map<number, "old" | "new"> => {
      const map = new Map<number, "old" | "new">();
      if (!booksList || booksList.length === 0) return map;
      // Se já vem com campo testament confiável e ambos presentes, usa direto
      const oldCount = booksList.filter((b) => b.testament === "old").length;
      const newCount = booksList.filter((b) => b.testament === "new").length;
      if (oldCount > 0 && newCount > 0) {
        booksList.forEach((b) => map.set(b.id, b.testament));
        return map;
      }
      // Heurística: localizar início do NT pelo primeiro livro que combine com Mateus / Matthew
      let newStartIndex = booksList.findIndex((b) =>
        /Mateus|Matthew/i.test(b.name)
      );
      if (newStartIndex === -1) {
        // fallback clássico: 39 (0-based => índice 39 significa depois de 39 livros AT) mas só se tamanho >= 66
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

    // Selection and sharing state
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedVerses, setSelectedVerses] = useState<Set<string>>(new Set());
    // const [showFavoriteButtons, setShowFavoriteButtons] = useState(false); // removido (botão de favoritar desativado)

    // Header fixo (animação removida conforme solicitação)
    const HEADER_HEIGHT = 38; // altura mantida para consistência

    useEffect(() => {
      if (bibleId && currentBookId) {
        console.log("USE EFFECT CHAMANDO INICIALIZE");
        initializeReader();
      }
    }, [bibleId, currentBookId]); // eslint-disable-line react-hooks/exhaustive-deps

    const initializeReader = async () => {
      console.log("---------------------");
      console.log("INICIANDO LEITOR");
      try {
        setLoading(true);

        // Get bible info
        const bibles = await DatabaseService.getBibles();
        console.log("ACHOU AS BIBLIAS", bibles.length);
        const currentBible = bibles.find((b) => b.id === bibleId);
        if (!currentBible) throw new Error("Bible not found");
        setBibleAbbrev(currentBible.abbreviation || "");

        // Open bible connection
        await bibleReaderService.openBible(bibleId, currentBible.fileName);

        // Get book info and total chapters
        const books = await bibleReaderService.getBooks(bibleId);
        const currentBook = books.find((b) => b.id === currentBookId);
        if (!currentBook) throw new Error("Book not found");
        setBook(currentBook);

        // Get chapters to determine total count
        const chapters = await bibleReaderService.getChapters(
          bibleId,
          currentBookId
        );
        setTotalChapters(chapters.length);

        // Load current chapter verses
        await loadChapterVerses();

        // Load favorites
        await loadFavorites();

        // Update navigation state
        await updateNavigationState();

        // Save current reading position
        // Adicionando verificações para evitar valores nulos ao salvar a posição de leitura
        // Adicionando logs detalhados para depuração
        try {
          if (bibleId && currentBookId && currentChapter) {
            console.log(
              "[DEBUG] Tentando salvar posição de leitura com os valores:",
              {
                bibleId,
                currentBookId,
                currentChapter,
              }
            );

            await DatabaseService.saveLastReading(
              bibleId,
              currentBookId,
              currentChapter
            );

            console.log("[DEBUG] Posição de leitura salva com sucesso.");
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
          // Não exibir alerta para o usuário, apenas registrar o erro
        }
      } catch (error) {
        console.error("Error initializing reader:", error);
        Alert.alert("Erro", "Falha ao carregar capítulo");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    const loadChapterVerses = async () => {
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
    };

    const loadFavorites = async () => {
      if (!bibleId) return;

      // try {
      //   const favoritesData = await DatabaseService.getFavorites(bibleId);
      //   const favoritesSet = new Set(
      //     favoritesData.map(
      //       (fav) => `${fav.bookId}-${fav.chapterNumber}-${fav.verseNumber}`
      //     )
      //   );
      //   setFavorites(favoritesSet);
      // } catch (error) {
      //   console.error("Error loading favorites:", error);
      // }
    };

    const navigateChapter = async (direction: "prev" | "next") => {
      console.log("NAVEGANDO CAPITULO", direction);
      // Prevent rapid navigation that can cause crashes
      if (navigating || loading) return;

      setNavigating(true);

      try {
        let newChapter = currentChapter;

        if (direction === "prev") {
          if (currentChapter > 1) {
            newChapter = currentChapter - 1;
          } else {
            // Go to previous book's last chapter
            await navigateToAdjacentBook("prev");
            return;
          }
        } else {
          if (currentChapter < totalChapters) {
            newChapter = currentChapter + 1;
          } else {
            // Go to next book's first chapter
            await navigateToAdjacentBook("next");
            return;
          }
        }

        if (newChapter > 0 && newChapter <= totalChapters) {
          setCurrentChapter(newChapter);

          // Load verses for the new chapter directly from database
          const versesData = await bibleReaderService.getVerses(
            bibleId,
            currentBookId,
            newChapter
          );
          setVerses(versesData);

          // Update navigation state
          await updateNavigationState();
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

    // Update navigation state based on current position
    const updateNavigationState = async () => {
      try {
        const books = await bibleReaderService.getBooks(bibleId);
        const firstBook = books[0];
        const lastBook = books[books.length - 1];

        // Check if at first book and first chapter
        const atFirstOfBible =
          currentBookId === firstBook?.id && currentChapter === 1;
        setIsFirstOfBible(atFirstOfBible);

        // Check if at last book and last chapter
        if (currentBookId === lastBook?.id) {
          const chapters = await bibleReaderService.getChapters(
            bibleId,
            lastBook.id
          );
          const atLastOfBible = currentChapter === chapters.length;
          setIsLastOfBible(atLastOfBible);
        } else {
          setIsLastOfBible(false);
        }
      } catch (error) {
        console.error("Error updating navigation state:", error);
      }
    };

    const openBibleSelector = async () => {
      try {
        const bibles = await DatabaseService.getBibles();
        console.log("PASSOU openBibleSelector");
        setAvailableBibles(bibles);
        setBibleSelectorVisible(true);
      } catch (error) {
        console.error("Error loading bibles 1:", error);
        Alert.alert("Erro", "Falha ao carregar versões da Bíblia");
      }
    };

    const selectBible = async (selectedBible: Bible) => {
      if (selectedBible.id === bibleId) {
        setBibleSelectorVisible(false);
        return;
      }

      try {
        setLoading(true);
        setBibleSelectorVisible(false);

        // Navigate to the same book and chapter in the new Bible
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

    // Ajustando o comportamento do modal para exibir capítulos ao lado dos livros e evitar reabertura
    const selectBook = async (selectedBook: Book) => {
      if (selectedBook.id === currentBookId) {
        return; // Não fecha o modal, apenas mantém o estado
      }

      try {
        setLoading(true);

        // Atualiza o livro atual e carrega os capítulos
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

        // Update states directly without router navigation
        setBook(newBook);
        setCurrentBookId(newBook.id);
        setCurrentChapter(newChapter);
        setTotalChapters(newBookChapters.length);

        // Load verses for the new book/chapter
        const versesData = await bibleReaderService.getVerses(
          bibleId,
          newBook.id,
          newChapter
        );
        setVerses(versesData);

        // Update navigation state
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

    const SEARCH_RESULTS_LIMIT = 1000; // limite padrão de resultados exibidos na busca (aumentado de 100 para 1000)

    const handleSearch = async () => {
      if (!searchQuery.trim() || !bibleId) return;

      try {
        setSearchLoading(true);
        // Garantir mapa local (mesmo que setState seja async)
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

    // Reaplicar filtro quando usuário troca (sem refazer query)
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

        // If it's a different book, load the new book info
        if (result.bookId !== currentBookId) {
          const books = await bibleReaderService.getBooks(bibleId);
          const newBook = books.find((b) => b.id === result.bookId);
          if (newBook) {
            setBook(newBook);
            setCurrentBookId(newBook.id);

            // Get chapters count for the new book
            const chapters = await bibleReaderService.getChapters(
              bibleId,
              result.bookId
            );
            setTotalChapters(chapters.length);
          }
        }

        // Update current chapter
        setCurrentChapter(result.chapterNumber);

        // Load verses for the search result chapter
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

        // Se um livro diferente foi especificado, atualize o livro primeiro
        if (book && book.id !== currentBookId) {
          setBook(book);
          setCurrentBookId(book.id);

          const chapters = await bibleReaderService.getChapters(bibleId, book.id);
          setTotalChapters(chapters.length);
        }

        // Update current chapter state
        setCurrentChapter(chapterNumber);

        // Load verses for the new chapter
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

    // toggleFavorite removido (favoritos desativados por enquanto)

    // Handle long press on verse
    const handleVerseLongPress = (verse: Verse) => {
      const verseKey = `${verse.bookId}-${verse.chapterNumber}-${verse.verseNumber}`;
      setSelectionMode(true);
      // setShowFavoriteButtons(true); // desativado

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
        // setShowFavoriteButtons(false); // desativado
      }
    };

    // Clear selection mode
    const clearSelection = () => {
      setSelectionMode(false);
      setSelectedVerses(new Set());
      // setShowFavoriteButtons(false); // desativado
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

      // Sort verses by verse number to maintain order
      const sortedVerses = selectedVersesData.sort(
        (a, b) => a.verseNumber - b.verseNumber
      );

      // Format verses with number - text
      const versesText = sortedVerses
        .map((verse) => `${verse.verseNumber} - ${cleanVerseText(verse.text)}`)
        .join("\n");

      // Create verse range text
      const verseNumbers = sortedVerses.map((v) => v.verseNumber);
      const verseRange =
        verseNumbers.length === 1
          ? verseNumbers[0].toString()
          : `${Math.min(...verseNumbers)}-${Math.max(...verseNumbers)}`;

      const shareText = `${versesText}

  ${book?.name} ${verseRange}

  Aplicativo ReadBible
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

    // Função para renderizar texto do versículo com símbolos clicáveis (✚ referências / ℕ notas)
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
      try {
        const chapters = await bibleReaderService.getChapters(
          bibleId,
          selectedBook.id
        );
        // Criar array com números dos capítulos (1, 2, 3, ..., n)
        const chapterNumbers = Array.from({ length: chapters.length }, (_, i) => i + 1);
        setChaptersForSelectedBook(chapterNumbers);
      } catch (error) {
        console.error("Error loading chapters for selected book:", error);
        Alert.alert("Erro", "Falha ao carregar capítulos do livro selecionado");
      }
    };

