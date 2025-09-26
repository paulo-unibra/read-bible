import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import bibleReaderService from '../services/BibleReaderService';
import DatabaseService from '../services/DatabaseService';
import { Bible, Book, Chapter, SearchResult } from '../types';

type ViewMode = 'books' | 'chapters' | 'search';

export default function FreeReadingScreen() {
  const router = useRouter();
  const [bibles, setBibles] = useState<Bible[]>([]);
  const [selectedBible, setSelectedBible] = useState<Bible | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('books');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadBibles();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps



  const loadBibles = async () => {
    try {
      await DatabaseService.init();
      const localBibles = await DatabaseService.getBibles();
      const downloadedBibles = localBibles.filter(bible => bible.isDownloaded);
      
      setBibles(downloadedBibles);
      
      if (downloadedBibles.length > 0) {
        // Try to get preferred bible from settings
        const preferredBibleId = await DatabaseService.getSetting('preferredBibleId');
        const preferredBible = preferredBibleId 
          ? downloadedBibles.find(bible => bible.id === preferredBibleId)
          : downloadedBibles[0];
        
        if (preferredBible) {
          await selectBible(preferredBible);
        }
      } else {
        Alert.alert('Aviso', 'Você precisa baixar pelo menos uma Bíblia para usar o modo de leitura livre.');
      }
    } catch (error) {
      console.error('Error loading bibles:', error);
      Alert.alert('Erro', 'Falha ao carregar Bíblias');
    } finally {
      setLoading(false);
    }
  };

  const selectBible = async (bible: Bible) => {
    try {
      setLoading(true);
      setSelectedBible(bible);
      
      // Open bible database connection
      await bibleReaderService.openBible(bible.id, bible.fileName);
      
      // Load books
      const booksData = await bibleReaderService.getBooks(bible.id);
      setBooks(booksData);
      
      setViewMode('books');
    } catch (error) {
      console.error('Error selecting bible:', error);
      Alert.alert('Erro', 'Falha ao abrir a Bíblia');
    } finally {
      setLoading(false);
    }
  };

  const selectBook = async (book: Book) => {
    if (!selectedBible) return;
    
    try {
      setLoading(true);
      setSelectedBook(book);
      
      const chaptersData = await bibleReaderService.getChapters(selectedBible.id, book.id);
      setChapters(chaptersData);
      setViewMode('chapters');
    } catch (error) {
      console.error('Error loading chapters:', error);
      Alert.alert('Erro', 'Falha ao carregar capítulos');
    } finally {
      setLoading(false);
    }
  };

  const selectChapter = async (chapter: Chapter) => {
    if (!selectedBible || !selectedBook) return;
    
    // Navigate to chapter reader screen
    router.push(`/chapter-reader?bibleId=${selectedBible.id}&bookId=${selectedBook.id}&chapterNumber=${chapter.chapterNumber}`);
  };

  const handleSearch = async () => {
    if (!selectedBible || !searchQuery.trim()) return;
    
    try {
      setLoading(true);
      const results = await bibleReaderService.searchVerses(selectedBible.id, searchQuery.trim());
      setSearchResults(results);
      setViewMode('search');
    } catch (error) {
      console.error('Error searching:', error);
      Alert.alert('Erro', 'Falha ao realizar busca');
    } finally {
      setLoading(false);
    }
  };



  const getHeaderTitle = () => {
    switch (viewMode) {
      case 'books':
        return selectedBible?.name || 'Selecionar Livro';
      case 'chapters':
        return selectedBook?.name || 'Selecionar Capítulo';
      case 'search':
        return `Busca: "${searchQuery}"`;
      default:
        return 'Leitura Livre';
    }
  };

  const goBack = () => {
    switch (viewMode) {
      case 'chapters':
        setViewMode('books');
        setSelectedBook(null);
        setChapters([]);
        break;
      case 'search':
        setViewMode('books');
        setSearchResults([]);
        break;
      case 'books':
      default:
        router.back();
        break;
    }
  };

  const renderBook = ({ item }: { item: Book }) => (
    <TouchableOpacity style={styles.listItem} onPress={() => selectBook(item)}>
      <View>
        <Text style={styles.itemTitle}>{item.name}</Text>
        <Text style={styles.itemSubtitle}>{item.testament === 'old' ? 'Antigo Testamento' : 'Novo Testamento'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  const renderChapter = ({ item }: { item: Chapter }) => (
    <TouchableOpacity style={styles.chapterItem} onPress={() => selectChapter(item)}>
      <Text style={styles.chapterNumber}>{item.chapterNumber}</Text>
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity 
      style={styles.searchResultContainer}
      onPress={() => {
        if (!selectedBible) return;
        router.push(`/chapter-reader?bibleId=${selectedBible.id}&bookId=${item.bookId}&chapterNumber=${item.chapterNumber}`);
      }}
    >
      <Text style={styles.searchResultRef}>{item.bookName} {item.chapterNumber}:{item.verseNumber}</Text>
      <Text style={styles.searchResultText}>{item.text}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
        {viewMode === 'books' && (
          <TouchableOpacity 
            onPress={() => setViewMode('search')} 
            style={styles.searchButton}
          >
            <Ionicons name="search" size={24} color="#333" />
          </TouchableOpacity>
        )}
      </View>

      {/* Bible Selector */}
      {bibles.length > 1 && viewMode !== 'search' && (
        <View style={styles.bibleSelector}>
          <Text style={styles.bibleSelectorLabel}>Versão:</Text>
          <FlatList
            data={bibles}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.bibleOption,
                  selectedBible?.id === item.id && styles.selectedBibleOption
                ]}
                onPress={() => selectBible(item)}
              >
                <Text style={[
                  styles.bibleOptionText,
                  selectedBible?.id === item.id && styles.selectedBibleOptionText
                ]}>
                  {item.abbreviation}
                </Text>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {/* Search Bar */}
      {viewMode === 'search' && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar versículos..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchSubmitButton} onPress={handleSearch}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {viewMode === 'books' && (
          <FlatList
            data={books}
            renderItem={renderBook}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
          />
        )}

        {viewMode === 'chapters' && (
          <FlatList
            data={chapters}
            renderItem={renderChapter}
            keyExtractor={(item) => item.id.toString()}
            numColumns={6}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chaptersGrid}
          />
        )}

        {viewMode === 'search' && (
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item, index) => `${item.bookId}-${item.chapterNumber}-${item.verseNumber}-${index}`}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="search" size={48} color="#ccc" />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'Nenhum resultado encontrado' : 'Digite um termo para buscar'}
                </Text>
              </View>
            }
          />
        )}
      </View>
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
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  searchButton: {
    padding: 8,
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
  bibleSelector: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  bibleSelectorLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  bibleOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  selectedBibleOption: {
    backgroundColor: '#2196F3',
  },
  bibleOptionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  selectedBibleOptionText: {
    color: '#fff',
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
  searchSubmitButton: {
    width: 40,
    height: 40,
    backgroundColor: '#2196F3',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  listItem: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 8,
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
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  chaptersGrid: {
    paddingVertical: 8,
  },
  chapterItem: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 4,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chapterNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  verseContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
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
  verseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  searchResultContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
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
});