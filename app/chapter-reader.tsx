import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import bibleReaderService from '../services/BibleReaderService';
import DatabaseService from '../services/DatabaseService';
import { Bible, Book, SearchResult, Verse } from '../types';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Verse selector modal state
  const [verseSelectorVisible, setVerseSelectorVisible] = useState(false);
  const [selectedVerseId, setSelectedVerseId] = useState<number | null>(null);

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
      const currentBible = bibles.find(b => b.id === bibleId);
      if (!currentBible) throw new Error('Bible not found');
      setBible(currentBible);
      
      // Open bible connection
      await bibleReaderService.openBible(bibleId, currentBible.fileName);
      
      // Get book info and total chapters
      const books = await bibleReaderService.getBooks(bibleId);
      const currentBook = books.find(b => b.id === bookId);
      if (!currentBook) throw new Error('Book not found');
      setBook(currentBook);
      
      // Get chapters to determine total count
      const chapters = await bibleReaderService.getChapters(bibleId, bookId);
      setTotalChapters(chapters.length);
      
      // Load current chapter verses
      await loadChapterVerses();
      
      // Load favorites
      await loadFavorites();
      
    } catch (error) {
      console.error('Error initializing reader:', error);
      Alert.alert('Erro', 'Falha ao carregar capítulo');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const loadChapterVerses = async () => {
    if (!bibleId || !bookId || !currentChapter) return;
    
    try {
      const versesData = await bibleReaderService.getVerses(bibleId, bookId, currentChapter);
      setVerses(versesData);
    } catch (error) {
      console.error('Error loading verses:', error);
      Alert.alert('Erro', 'Falha ao carregar versículos');
    }
  };

  const loadFavorites = async () => {
    if (!bibleId) return;
    
    try {
      const favoritesData = await DatabaseService.getFavorites(bibleId);
      const favoritesSet = new Set(
        favoritesData.map(fav => `${fav.bookId}-${fav.chapterNumber}-${fav.verseNumber}`)
      );
      setFavorites(favoritesSet);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const navigateChapter = async (direction: 'prev' | 'next') => {
    let newChapter = currentChapter;
    
    if (direction === 'prev') {
      if (currentChapter > 1) {
        newChapter = currentChapter - 1;
      } else {
        // Go to previous book's last chapter
        await navigateToAdjacentBook('prev');
        return;
      }
    } else {
      if (currentChapter < totalChapters) {
        newChapter = currentChapter + 1;
      } else {
        // Go to next book's first chapter
        await navigateToAdjacentBook('next');
        return;
      }
    }
    
    setCurrentChapter(newChapter);
  };

  const navigateToAdjacentBook = async (direction: 'prev' | 'next') => {
    try {
      const books = await bibleReaderService.getBooks(bibleId);
      const currentBookIndex = books.findIndex(b => b.id === bookId);
      
      let newBookIndex = direction === 'prev' ? currentBookIndex - 1 : currentBookIndex + 1;
      
      if (newBookIndex < 0 || newBookIndex >= books.length) {
        Alert.alert(
          'Aviso', 
          direction === 'prev' 
            ? 'Você já está no primeiro capítulo da Bíblia' 
            : 'Você já está no último capítulo da Bíblia'
        );
        return;
      }
      
      const newBook = books[newBookIndex];
      const newBookChapters = await bibleReaderService.getChapters(bibleId, newBook.id);
      const newChapter = direction === 'prev' ? newBookChapters.length : 1;
      
      // Navigate to new book/chapter
      router.replace(`/chapter-reader?bibleId=${bibleId}&bookId=${newBook.id}&chapterNumber=${newChapter}`);
      
    } catch (error) {
      console.error('Error navigating to adjacent book:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !bibleId) return;
    
    try {
      setSearchLoading(true);
      const results = await bibleReaderService.searchVerses(bibleId, searchQuery.trim(), 50);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching:', error);
      Alert.alert('Erro', 'Falha ao realizar busca');
    } finally {
      setSearchLoading(false);
    }
  };

  const navigateToSearchResult = (result: SearchResult) => {
    setSearchModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    
    // Navigate to the chapter containing the search result
    router.replace(`/chapter-reader?bibleId=${bibleId}&bookId=${result.bookId}&chapterNumber=${result.chapterNumber}`);
  };

  const scrollToVerse = (verseNumber: number) => {
    setSelectedVerseId(verseNumber);
    setVerseSelectorVisible(false);
    
    // Highlight the verse temporarily
    setTimeout(() => setSelectedVerseId(null), 3000);
  };

  const toggleFavorite = async (verse: Verse) => {
    if (!bibleId) return;
    
    try {
      const favoriteKey = `${verse.bookId}-${verse.chapterNumber}-${verse.verseNumber}`;
      
      if (favorites.has(favoriteKey)) {
        await DatabaseService.removeFromFavorites(bibleId, verse.bookId, verse.chapterNumber, verse.verseNumber);
        favorites.delete(favoriteKey);
      } else {
        await DatabaseService.addToFavorites(bibleId, verse.bookId, verse.chapterNumber, verse.verseNumber);
        favorites.add(favoriteKey);
      }
      
      setFavorites(new Set(favorites));
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Erro', 'Falha ao alterar favorito');
    }
  };

  const renderVerse = ({ item }: { item: Verse }) => {
    const favoriteKey = `${item.bookId}-${item.chapterNumber}-${item.verseNumber}`;
    const isFavorite = favorites.has(favoriteKey);
    const isHighlighted = selectedVerseId === item.verseNumber;
    
    return (
      <View style={[styles.verseContainer, isHighlighted && styles.highlightedVerse]}>
        <View style={styles.verseHeader}>
          <TouchableOpacity 
            style={styles.verseNumberButton}
            onPress={() => scrollToVerse(item.verseNumber)}
          >
            <Text style={styles.verseNumber}>{item.verseNumber}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => toggleFavorite(item)}>
            <Ionicons 
              name={isFavorite ? "heart" : "heart-outline"} 
              size={20} 
              color={isFavorite ? "#f44336" : "#999"} 
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.verseText}>{item.text}</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {book?.name} {currentChapter}
          </Text>
          <Text style={styles.headerSubtitle}>
            {bible?.name}
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={() => setSearchModalVisible(true)} 
            style={styles.headerButton}
          >
            <Ionicons name="search" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setVerseSelectorVisible(true)} 
            style={styles.headerButton}
          >
            <Ionicons name="list" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation Bar */}
      <View style={styles.navigationBar}>
        <TouchableOpacity 
          style={[styles.navButton, currentChapter === 1 && styles.navButtonDisabled]}
          onPress={() => navigateChapter('prev')}
          disabled={currentChapter === 1}
        >
          <Ionicons name="chevron-back" size={20} color={currentChapter === 1 ? "#ccc" : "#2196F3"} />
          <Text style={[styles.navButtonText, currentChapter === 1 && styles.navButtonTextDisabled]}>
            Anterior
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.chapterInfo}>
          Capítulo {currentChapter} de {totalChapters}
        </Text>
        
        <TouchableOpacity 
          style={[styles.navButton, currentChapter === totalChapters && styles.navButtonDisabled]}
          onPress={() => navigateChapter('next')}
          disabled={currentChapter === totalChapters}
        >
          <Text style={[styles.navButtonText, currentChapter === totalChapters && styles.navButtonTextDisabled]}>
            Próximo
          </Text>
          <Ionicons name="chevron-forward" size={20} color={currentChapter === totalChapters ? "#ccc" : "#2196F3"} />
        </TouchableOpacity>
      </View>

      {/* Verses List */}
      <FlatList
        data={verses}
        renderItem={renderVerse}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        style={styles.versesList}
        getItemLayout={(data, index) => ({
          length: 120, // Approximate height
          offset: 120 * index,
          index,
        })}
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
            keyExtractor={(item, index) => `${item.bookId}-${item.chapterNumber}-${item.verseNumber}-${index}`}
            showsVerticalScrollIndicator={false}
            style={styles.searchResultsList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="search" size={48} color="#ccc" />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'Nenhum resultado encontrado' : 'Digite um termo para buscar versículos'}
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Verse Selector Modal */}
      <Modal
        visible={verseSelectorVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setVerseSelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.verseSelectorModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ir para Versículo</Text>
              <TouchableOpacity onPress={() => setVerseSelectorVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.verseNumberGrid}>
              <View style={styles.verseNumbersContainer}>
                {verses.map((verse) => (
                  <TouchableOpacity
                    key={verse.id}
                    style={styles.verseNumberItem}
                    onPress={() => scrollToVerse(verse.verseNumber)}
                  >
                    <Text style={styles.verseNumberItemText}>{verse.verseNumber}</Text>
                  </TouchableOpacity>
                ))}
              </View>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  navigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
  },
  navButtonDisabled: {
    backgroundColor: '#f5f5f5',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    marginHorizontal: 4,
  },
  navButtonTextDisabled: {
    color: '#ccc',
  },
  chapterInfo: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  versesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  verseContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  highlightedVerse: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  verseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  verseNumberButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#e3f2fd',
  },
  verseNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  verseText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    backgroundColor: '#f8f8f8',
  },
  searchButton: {
    width: 40,
    height: 40,
    backgroundColor: '#2196F3',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  searchResultsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchResultContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
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
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  searchResultText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verseSelectorModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
  },
  verseNumberGrid: {
    maxHeight: 400,
  },
  verseNumbersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
  },
  verseNumberItem: {
    width: 48,
    height: 48,
    backgroundColor: '#f0f8ff',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  verseNumberItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
});