import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useTheme } from "../hooks/theme-context";
import BibleReaderService from "../services/BibleReaderService";
import { DatabaseService } from "../services/DatabaseService";
import NotesService, { VerseNote } from "../services/NotesService";

interface BibleBook {
  id: number;
  name: string;
}

export default function MyNotesScreen() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<VerseNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<VerseNote[]>([]);
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<VerseNote | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [bibleId, setBibleId] = useState<string>("");

  // Load notes when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  useEffect(() => {
    filterNotes();
  }, [selectedBook, notes]);

  const loadData = async () => {
    try {
      setLoading(true);
      await loadNotes();
      await loadBooks();
    } catch (error) {
      console.error("Error loading data:", error);
      Alert.alert("Erro", "Não foi possível carregar os dados");
    } finally {
      setLoading(false);
    }
  };

  const loadBooks = async () => {
    try {
      // Get first downloaded Bible to load books
      const bibles = await DatabaseService.getBibles();
      const downloadedBible = bibles.find((b) => b.isDownloaded);

      if (!downloadedBible) {
        console.log("No downloaded bible found");
        setBooks([]);
        return;
      }

      setBibleId(downloadedBible.id);

      // Open Bible and get books
      await BibleReaderService.openBible(
        downloadedBible.id,
        downloadedBible.fileName,
      );
      const bibleBooks = await BibleReaderService.getBooks(downloadedBible.id);

      // Ensure books have correct structure
      const formattedBooks = bibleBooks.map((book: any) => ({
        id: book.id || book.book_id,
        name: book.name || book.book_name,
      }));

      setBooks(formattedBooks);
    } catch (error) {
      console.error("Error loading books:", error);
      setBooks([]);
      // Don't show alert, just log the error
    }
  };

  const loadNotes = async () => {
    try {
      setLoading(true);
      const allNotes = await NotesService.getAllNotes();
      setNotes(allNotes);
    } catch (error) {
      console.error("Error loading notes:", error);
      Alert.alert("Erro", "Não foi possível carregar as anotações");
    } finally {
      setLoading(false);
    }
  };

  const filterNotes = () => {
    if (selectedBook) {
      setFilteredNotes(notes.filter((note) => note.bookId === selectedBook));
    } else {
      setFilteredNotes(notes);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    Alert.alert(
      "Excluir Anotação",
      "Tem certeza que deseja excluir esta anotação?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await NotesService.deleteNote(noteId);
              setNotes(notes.filter((note) => note.id !== noteId));
              setShowNoteModal(false);
              Alert.alert("Sucesso", "Anotação excluída");
            } catch (error) {
              console.error("Error deleting note:", error);
              Alert.alert("Erro", "Não foi possível excluir a anotação");
            }
          },
        },
      ],
    );
  };

  const handleGoToVerse = (note: VerseNote) => {
    setShowNoteModal(false);
    router.push({
      pathname: "/chapter-reader",
      params: {
        bookId: note.bookId,
        chapterNumber: note.chapterNumber,
        highlightVerse: note.verseNumbers[0],
      },
    });
  };

  const renderFormattedText = (text: string) => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let key = 0;

    // Patterns for markdown
    const patterns = [
      { regex: /\*\*(.*?)\*\*/g, style: styles.boldText }, // Bold
      { regex: /\*(.*?)\*/g, style: styles.italicText }, // Italic
      { regex: /__(.*?)__/g, style: styles.underlineText }, // Underline
      { regex: /~~(.*?)~~/g, style: styles.strikethroughText }, // Strikethrough
    ];

    // Split by line to handle bullet lists
    const lines = text.split("\n");

    lines.forEach((line, lineIndex) => {
      if (line.trim().startsWith("- ")) {
        // Bullet list item
        parts.push(
          <Text key={`line-${lineIndex}`} style={styles.bulletItem}>
            • {line.substring(2)}
          </Text>,
        );
      } else {
        // Process inline formatting
        let processedLine = line;
        let tempParts: React.ReactNode[] = [];
        let lastIndex = 0;

        // Find all matches for all patterns
        const allMatches: Array<{
          index: number;
          length: number;
          text: string;
          style: any;
        }> = [];

        patterns.forEach(({ regex, style }) => {
          let match;
          while ((match = regex.exec(line)) !== null) {
            allMatches.push({
              index: match.index,
              length: match[0].length,
              text: match[1],
              style,
            });
          }
        });

        // Sort matches by index
        allMatches.sort((a, b) => a.index - b.index);

        // Build the parts
        allMatches.forEach((match, i) => {
          if (match.index > lastIndex) {
            tempParts.push(line.substring(lastIndex, match.index));
          }
          tempParts.push(
            <Text key={`match-${i}`} style={match.style}>
              {match.text}
            </Text>,
          );
          lastIndex = match.index + match.length;
        });

        if (lastIndex < line.length) {
          tempParts.push(line.substring(lastIndex));
        }

        if (tempParts.length === 0) {
          tempParts.push(line);
        }

        parts.push(
          <Text key={`line-${lineIndex}`} style={styles.noteText}>
            {tempParts}
          </Text>,
        );
      }

      // Add line break except for last line
      if (lineIndex < lines.length - 1) {
        parts.push(<Text key={`br-${lineIndex}`}>{"\n"}</Text>);
      }
    });

    return <Text>{parts}</Text>;
  };

  const renderNoteCard = (note: VerseNote) => {
    const verseReference =
      note.verseNumbers.length === 1
        ? note.verseNumbers[0].toString()
        : `${Math.min(...note.verseNumbers)}-${Math.max(...note.verseNumbers)}`;

    return (
      <TouchableOpacity
        key={note.id}
        style={[styles.noteCard, { backgroundColor: colors.card }]}
        onPress={() => {
          setSelectedNote(note);
          setShowNoteModal(true);
        }}
      >
        <View style={styles.noteHeader}>
          <View style={styles.noteReference}>
            <Ionicons
              name="bookmark"
              size={16}
              color={isDark ? "#64b5f6" : "#1976D2"}
            />
            <Text style={[styles.noteBookName, { color: colors.textPrimary }]}>
              {note.bookName} {note.chapterNumber}:{verseReference}
            </Text>
          </View>
          <Text style={[styles.noteDate, { color: colors.textSecondary }]}>
            {new Date(note.updatedAt).toLocaleDateString("pt-BR")}
          </Text>
        </View>
        <Text
          style={[styles.notePreview, { color: colors.textSecondary }]}
          numberOfLines={3}
        >
          {note.note}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator
          size="large"
          color={isDark ? "#64b5f6" : "#1976D2"}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Minhas Anotações
        </Text>
        <TouchableOpacity
          onPress={() => setShowFilterModal(true)}
          style={styles.filterButton}
        >
          <Ionicons
            name={selectedBook ? "filter" : "filter-outline"}
            size={24}
            color={isDark ? "#64b5f6" : "#1976D2"}
          />
          {selectedBook && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>1</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Notes List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredNotes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="document-text-outline"
              size={80}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {selectedBook
                ? "Nenhuma anotação para este livro"
                : "Você ainda não tem anotações"}
            </Text>
            {selectedBook && (
              <TouchableOpacity
                onPress={() => setSelectedBook(null)}
                style={[
                  styles.clearFilterButton,
                  { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Text
                  style={[
                    styles.clearFilterText,
                    { color: colors.textPrimary },
                  ]}
                >
                  Limpar Filtro
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.notesContainer}>
            {filteredNotes.map((note) => renderNoteCard(note))}
          </View>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.filterModal, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Filtrar por Livro
              </Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedBook && (
              <TouchableOpacity
                style={[
                  styles.clearFilterModalButton,
                  { backgroundColor: colors.surfaceAlt },
                ]}
                onPress={() => {
                  setSelectedBook(null);
                  setShowFilterModal(false);
                }}
              >
                <Text
                  style={[
                    styles.clearFilterModalText,
                    { color: colors.textPrimary },
                  ]}
                >
                  Mostrar Todas
                </Text>
              </TouchableOpacity>
            )}

            <ScrollView style={styles.booksList}>
              {books.map((book) => (
                <TouchableOpacity
                  key={book.id}
                  style={[
                    styles.bookItem,
                    selectedBook === book.id && styles.selectedBookItem,
                    {
                      backgroundColor:
                        selectedBook === book.id
                          ? colors.surfaceAlt
                          : "transparent",
                    },
                  ]}
                  onPress={() => {
                    setSelectedBook(book.id);
                    setShowFilterModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.bookItemText,
                      { color: colors.textPrimary },
                      selectedBook === book.id && styles.selectedBookText,
                    ]}
                  >
                    {book.name}
                  </Text>
                  {selectedBook === book.id && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={isDark ? "#64b5f6" : "#1976D2"}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Note Detail Modal */}
      <Modal
        visible={showNoteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNoteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.noteModal, { backgroundColor: colors.card }]}>
            {selectedNote && (
              <>
                <View style={styles.modalHeader}>
                  <Text
                    style={[styles.modalTitle, { color: colors.textPrimary }]}
                  >
                    {selectedNote.bookName} {selectedNote.chapterNumber}:
                    {selectedNote.verseNumbers.length === 1
                      ? selectedNote.verseNumbers[0]
                      : `${Math.min(...selectedNote.verseNumbers)}-${Math.max(...selectedNote.verseNumbers)}`}
                  </Text>
                  <TouchableOpacity onPress={() => setShowNoteModal(false)}>
                    <Ionicons
                      name="close"
                      size={24}
                      color={colors.textPrimary}
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.noteContent}>
                  <View style={styles.noteViewContainer}>
                    {renderFormattedText(selectedNote.note)}
                  </View>
                </ScrollView>

                <View style={styles.noteActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: colors.surfaceAlt },
                    ]}
                    onPress={() => handleGoToVerse(selectedNote)}
                  >
                    <Ionicons
                      name="book-outline"
                      size={20}
                      color={isDark ? "#64b5f6" : "#1976D2"}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: colors.textPrimary },
                      ]}
                    >
                      Ir para o Texto
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteNote(selectedNote.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={[styles.actionButtonText, { color: "#fff" }]}>
                      Excluir
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  filterButton: {
    padding: 8,
    position: "relative",
  },
  filterBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#f44336",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  notesContainer: {
    gap: 12,
  },
  noteCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  noteReference: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  noteBookName: {
    fontSize: 14,
    fontWeight: "600",
  },
  noteDate: {
    fontSize: 12,
  },
  notePreview: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  clearFilterButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  clearFilterText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  filterModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  clearFilterModalButton: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  clearFilterModalText: {
    fontSize: 14,
    fontWeight: "600",
  },
  booksList: {
    maxHeight: 400,
  },
  bookItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  selectedBookItem: {
    borderLeftWidth: 3,
    borderLeftColor: "#1976D2",
  },
  bookItemText: {
    fontSize: 16,
  },
  selectedBookText: {
    fontWeight: "600",
  },
  noteModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    minHeight: "50%",
  },
  noteContent: {
    padding: 16,
    maxHeight: 400,
  },
  noteViewContainer: {
    paddingBottom: 16,
  },
  noteText: {
    fontSize: 16,
    lineHeight: 24,
  },
  boldText: {
    fontWeight: "bold",
  },
  italicText: {
    fontStyle: "italic",
  },
  underlineText: {
    textDecorationLine: "underline",
  },
  strikethroughText: {
    textDecorationLine: "line-through",
  },
  bulletItem: {
    fontSize: 16,
    lineHeight: 24,
    paddingLeft: 8,
  },
  noteActions: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.1)",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: "#f44336",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
