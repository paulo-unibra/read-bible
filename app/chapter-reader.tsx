import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import bibleReaderService from "../services/BibleReaderService";
import DatabaseService from "../services/DatabaseService";
import { Bible, Book, SearchResult, Verse } from "../types";

export default function ChapterReaderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // URL params: bibleId, bookId, chapterNumber
  const bibleId = params.bibleId as string;
  const bookId = parseInt(params.bookId as string);
  const initialChapter = parseInt(params.chapterNumber as string);

  const [bible, setBible] = useState<Bible | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [currentChapter, setCurrentChapter] = useState(initialChapter);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [totalChapters, setTotalChapters] = useState(0);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Search modal state
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Chapter selector modal state
  const [chapterSelectorVisible, setChapterSelectorVisible] = useState(false);

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

  // Selection and sharing state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState<Set<string>>(new Set());
  const [longPressVerse, setLongPressVerse] = useState<string | null>(null);

  useEffect(() => {
    if (bibleId && bookId && currentChapter) {
      initializeReader();
    }
  }, [bibleId, bookId, currentChapter]); // eslint-disable-line react-hooks/exhaustive-deps

  const initializeReader = async () => {
    try {
      setLoading(true);

      // Get bible info
      const bibles = await DatabaseService.getBibles();
      const currentBible = bibles.find((b) => b.id === bibleId);
      if (!currentBible) throw new Error("Bible not found");
      setBible(currentBible);

      // Open bible connection
      await bibleReaderService.openBible(bibleId, currentBible.fileName);

      // Get book info and total chapters
      const books = await bibleReaderService.getBooks(bibleId);
      const currentBook = books.find((b) => b.id === bookId);
      if (!currentBook) throw new Error("Book not found");
      setBook(currentBook);

      // Get chapters to determine total count
      const chapters = await bibleReaderService.getChapters(bibleId, bookId);
      setTotalChapters(chapters.length);

      // Load current chapter verses
      await loadChapterVerses();

      // Load favorites
      await loadFavorites();
    } catch (error) {
      console.error("Error initializing reader:", error);
      Alert.alert("Erro", "Falha ao carregar capítulo");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const loadChapterVerses = async () => {
    if (!bibleId || !bookId || !currentChapter) return;

    try {
      const versesData = await bibleReaderService.getVerses(
        bibleId,
        bookId,
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

    try {
      const favoritesData = await DatabaseService.getFavorites(bibleId);
      const favoritesSet = new Set(
        favoritesData.map(
          (fav) => `${fav.bookId}-${fav.chapterNumber}-${fav.verseNumber}`
        )
      );
      setFavorites(favoritesSet);
    } catch (error) {
      console.error("Error loading favorites:", error);
    }
  };

  const navigateChapter = async (direction: "prev" | "next") => {
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

    setCurrentChapter(newChapter);
  };

  const navigateToAdjacentBook = async (direction: "prev" | "next") => {
    try {
      const books = await bibleReaderService.getBooks(bibleId);
      const currentBookIndex = books.findIndex((b) => b.id === bookId);

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

      // Navigate to new book/chapter
      router.replace(
        `/chapter-reader?bibleId=${bibleId}&bookId=${newBook.id}&chapterNumber=${newChapter}`
      );
    } catch (error) {
      console.error("Error navigating to adjacent book:", error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !bibleId) return;

    try {
      setSearchLoading(true);
      const results = await bibleReaderService.searchVerses(
        bibleId,
        searchQuery.trim(),
        50
      );
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching:", error);
      Alert.alert("Erro", "Falha ao realizar busca");
    } finally {
      setSearchLoading(false);
    }
  };

  const navigateToSearchResult = (result: SearchResult) => {
    setSearchModalVisible(false);
    setSearchQuery("");
    setSearchResults([]);

    // Navigate to the chapter containing the search result
    router.replace(
      `/chapter-reader?bibleId=${bibleId}&bookId=${result.bookId}&chapterNumber=${result.chapterNumber}`
    );
  };

  const navigateToChapter = (chapterNumber: number) => {
    setChapterSelectorVisible(false);

    // Navigate to the selected chapter
    router.replace(
      `/chapter-reader?bibleId=${bibleId}&bookId=${bookId}&chapterNumber=${chapterNumber}`
    );
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

  const toggleFavorite = async (verse: Verse) => {
    if (!bibleId) return;

    try {
      const favoriteKey = `${verse.bookId}-${verse.chapterNumber}-${verse.verseNumber}`;

      if (favorites.has(favoriteKey)) {
        await DatabaseService.removeFromFavorites(
          bibleId,
          verse.bookId,
          verse.chapterNumber,
          verse.verseNumber
        );
        favorites.delete(favoriteKey);
      } else {
        await DatabaseService.addToFavorites(
          bibleId,
          verse.bookId,
          verse.chapterNumber,
          verse.verseNumber
        );
        favorites.add(favoriteKey);
      }

      setFavorites(new Set(favorites));
    } catch (error) {
      console.error("Error toggling favorite:", error);
      Alert.alert("Erro", "Falha ao alterar favorito");
    }
  };

  // Handle long press on verse
  const handleVerseLongPress = (verse: Verse) => {
    const verseKey = `${verse.bookId}-${verse.chapterNumber}-${verse.verseNumber}`;
    setLongPressVerse(verseKey);
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
      setLongPressVerse(null);
    }
  };

  // Clear selection mode
  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedVerses(new Set());
    setLongPressVerse(null);
  };

  // Share selected verses
  const shareSelectedVerses = async () => {
    if (selectedVerses.size === 0) return;

    const selectedVersesData = verses.filter(verse => 
      selectedVerses.has(`${verse.bookId}-${verse.chapterNumber}-${verse.verseNumber}`)
    );

    // Sort verses by verse number to maintain order
    const sortedVerses = selectedVersesData.sort((a, b) => a.verseNumber - b.verseNumber);

    // Format verses with number - text
    const versesText = sortedVerses
      .map(verse => `${verse.verseNumber} - ${verse.text}`)
      .join('\n');

    // Create verse range text
    const verseNumbers = sortedVerses.map(v => v.verseNumber);
    const verseRange = verseNumbers.length === 1 
      ? verseNumbers[0].toString()
      : `${Math.min(...verseNumbers)}-${Math.max(...verseNumbers)}`;

    const shareText = `${versesText}

${book?.name} ${verseRange}

Aplicativo ReadBible
Link do app: https://readbible.app`;

    const shareTitle = selectedVerses.size === 1 
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
      console.error('Error sharing verses:', error);
      Alert.alert('Erro', 'Não foi possível compartilhar os versículos');
    }
  };

  const renderVerse = ({ item }: { item: Verse }) => {
    const favoriteKey = `${item.bookId}-${item.chapterNumber}-${item.verseNumber}`;
    const isFavorite = favorites.has(favoriteKey);
    const hasNotes = item.notes && item.notes.length > 0;
    const isSelected = selectedVerses.has(favoriteKey);
    const isLongPressed = longPressVerse === favoriteKey;

    return (
      <Pressable
        style={[
          styles.verseContainer,
          isSelected && styles.verseContainerSelected
        ]}
        onPress={() => selectionMode ? handleVerseSelection(item) : undefined}
        onLongPress={() => handleVerseLongPress(item)}
        delayLongPress={500}
      >
        {/* Checkbox for selection mode */}
        {selectionMode && (
          <View style={styles.checkboxContainer}>
            <View style={[
              styles.checkbox,
              isSelected && styles.checkboxSelected
            ]}>
              {isSelected && (
                <Ionicons name="checkmark" size={14} color="#fff" />
              )}
            </View>
          </View>
        )}

        <View style={[styles.verseTextContainer, selectionMode && styles.verseTextWithCheckbox]}>
          <Text style={styles.verseText}>
            <Text style={styles.verseNumber}>{item.verseNumber}</Text>
            <Text> - {item.text}</Text>
          </Text>

          {/* Buttons row below the verse */}
          <View style={styles.verseButtonsRow}>
            {hasNotes && (
              <TouchableOpacity
                style={styles.inlineButton}
                onPress={() => openNotes(item.notes!)}
              >
                <Ionicons name="document-text" size={14} color="#2196F3" />
              </TouchableOpacity>
            )}

            {item.verseReferences && item.verseReferences.length > 0 && (
              <TouchableOpacity
                style={styles.inlineButton}
                onPress={() => openReferencesModal(item.verseReferences!)}
              >
                <Ionicons name="git-branch" size={14} color="#2196F3" />
              </TouchableOpacity>
            )}

            {/* Favorite button - only show on long press */}
            {isLongPressed && (
              <TouchableOpacity
                style={[styles.inlineButton, isFavorite && styles.favoriteButton]}
                onPress={() => toggleFavorite(item)}
              >
                <Ionicons
                  name="heart"
                  size={14}
                  color={isFavorite ? "#f44336" : "#ccc"}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Pressable>
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {selectionMode ? `${selectedVerses.size} selecionado${selectedVerses.size !== 1 ? 's' : ''}` : `${book?.name} ${currentChapter}`}
          </Text>
          <Text style={styles.headerSubtitle}>
            {selectionMode ? 'Toque para selecionar versículos' : bible?.name}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {selectionMode && selectedVerses.size > 0 && (
            <>
              <TouchableOpacity
                onPress={shareSelectedVerses}
                style={styles.headerButton}
              >
                <Ionicons name="share-outline" size={24} color="#2196F3" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={clearSelection}
                style={styles.headerButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </>
          )}
          {!selectionMode && (
            <>
              <TouchableOpacity
                onPress={() => setSearchModalVisible(true)}
                style={styles.headerButton}
              >
                <Ionicons name="search" size={24} color="#333" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setChapterSelectorVisible(true)}
                style={styles.headerButton}
              >
                <Ionicons name="list" size={24} color="#333" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Navigation Bar */}
      <View style={styles.navigationBar}>
        <TouchableOpacity
          style={[
            styles.navButton,
            currentChapter === 1 && styles.navButtonDisabled,
          ]}
          onPress={() => navigateChapter("prev")}
          disabled={currentChapter === 1}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={currentChapter === 1 ? "#ccc" : "#2196F3"}
          />
          <Text
            style={[
              styles.navButtonText,
              currentChapter === 1 && styles.navButtonTextDisabled,
            ]}
          >
            Anterior
          </Text>
        </TouchableOpacity>

        <Text style={styles.chapterInfo}>
          Capítulo {currentChapter} de {totalChapters}
        </Text>

        <TouchableOpacity
          style={[
            styles.navButton,
            currentChapter === totalChapters && styles.navButtonDisabled,
          ]}
          onPress={() => navigateChapter("next")}
          disabled={currentChapter === totalChapters}
        >
          <Text
            style={[
              styles.navButtonText,
              currentChapter === totalChapters && styles.navButtonTextDisabled,
            ]}
          >
            Próximo
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={currentChapter === totalChapters ? "#ccc" : "#2196F3"}
          />
        </TouchableOpacity>
      </View>

      {/* Verses List */}
      <FlatList
        data={verses}
        renderItem={renderVerse}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        style={styles.versesList}
      />

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
              <Ionicons name="close" size={24} color="#333" />
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

      {/* Chapter Selector Modal */}
      <Modal
        visible={chapterSelectorVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setChapterSelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.verseSelectorModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ir para Capítulo</Text>
              <TouchableOpacity
                onPress={() => setChapterSelectorVisible(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.verseNumberGrid}>
              <View style={styles.verseNumbersContainer}>
                {Array.from({ length: totalChapters }, (_, index) => {
                  const chapterNumber = index + 1;
                  const isCurrentChapter = chapterNumber === currentChapter;

                  return (
                    <TouchableOpacity
                      key={chapterNumber}
                      style={[
                        styles.verseNumberItem,
                        isCurrentChapter && styles.currentChapterItem,
                      ]}
                      onPress={() => navigateToChapter(chapterNumber)}
                    >
                      <Text
                        style={[
                          styles.verseNumberItemText,
                          isCurrentChapter && styles.currentChapterText,
                        ]}
                      >
                        {chapterNumber}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
          <View style={styles.notesModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notas do Versículo</Text>
              <TouchableOpacity onPress={() => setNotesModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
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
                    <Text style={styles.noteText}>{note}</Text>
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
                <Ionicons name="close" size={24} color="#333" />
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
                <Ionicons name="close" size={24} color="#333" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
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
    alignItems: "center",
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
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  verseContainerSelected: {
    backgroundColor: '#e3f2fd',
  },
  checkboxContainer: {
    marginRight: 8,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    backgroundColor: '#2196F3',
  },
  verseTextContainer: {
    flex: 1,
  },
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
    paddingTop: 4,
    paddingLeft: 20,
    gap: 8,
  },
  inlineButton: {
    flexDirection: "row",
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2196F3",
    backgroundColor: "#f0f8ff",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#2196F3",
  },
  favoriteButton: {
    borderColor: "#f44336",
    backgroundColor: "#fef0f0",
  },
  favoriteButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#f44336",
  },
  unfavoriteButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ccc",
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
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
    marginTop: 16,
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    margin: 16,
    width: "95%",
    maxHeight: '75%',
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  referenceVerseCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    minHeight: 80,
    shadowColor: '#000',
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  referenceErrorText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },
});
