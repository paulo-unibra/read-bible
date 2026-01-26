import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useTheme } from "../hooks/theme-context";
import NotesService, { VerseNote } from "../services/NotesService";

export default function VerseNotesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isDark } = useTheme();

  const bookId = parseInt(params.bookId as string);
  const bookName = params.bookName as string;
  const chapterNumber = parseInt(params.chapterNumber as string);
  const verseNumber = parseInt(params.verseNumber as string);
  const verseText = params.verseText as string;

  const [notes, setNotes] = useState<VerseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Buscar todas as notas do versículo
      const allNotes = await NotesService.getNotesByChapter(
        bookId,
        chapterNumber,
      );

      // Filtrar apenas as notas que incluem este versículo
      const verseNotes = allNotes.filter((note) =>
        note.verseNumbers.includes(verseNumber),
      );

      setNotes(verseNotes);
    } catch (error) {
      console.error("Error loading notes:", error);
      Alert.alert("Erro", "Não foi possível carregar as anotações");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleEditNote = (note: VerseNote) => {
    // Navegar para tela de edição
    router.push({
      pathname: "/note-editor",
      params: {
        bookId: note.bookId.toString(),
        bookName: note.bookName,
        chapterNumber: note.chapterNumber.toString(),
        verseNumber: note.verseNumbers[0].toString(), // Primeiro versículo da nota
        verseText: note.verseText,
        noteId: note.id.toString(),
      },
    });
  };

  const handleDeleteNote = async (note: VerseNote) => {
    Alert.alert(
      "Excluir Anotação",
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
              await NotesService.deleteNote(note.id.toString());

              // Atualizar lista
              setNotes(notes.filter((n) => n.id !== note.id));

              Alert.alert("Sucesso", "Anotação excluída com sucesso!");

              // Se não há mais notas, voltar
              if (notes.length === 1) {
                router.back();
              }
            } catch (error) {
              console.error("Error deleting note:", error);
              Alert.alert("Erro", "Não foi possível excluir a anotação");
            }
          },
        },
      ],
    );
  };

  const handleCreateNew = () => {
    router.push({
      pathname: "/note-editor",
      params: {
        bookId: bookId.toString(),
        bookName: bookName,
        chapterNumber: chapterNumber.toString(),
        verseNumber: verseNumber.toString(),
        verseText: verseText,
      },
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const colors = {
    background: isDark ? "#121212" : "#f5f5f5",
    card: isDark ? "#1e1e1e" : "#ffffff",
    text: isDark ? "#ffffff" : "#000000",
    secondaryText: isDark ? "#b0b0b0" : "#666666",
    border: isDark ? "#333333" : "#e0e0e0",
    primary: "#2196F3",
    danger: "#f44336",
    editButton: isDark ? "#64B5F6" : "#2196F3",
    deleteButton: "#f44336",
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Notas do Versículo
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Notas do Versículo
        </Text>
        <TouchableOpacity onPress={handleCreateNew} style={styles.addButton}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Verse Reference */}
      <View style={[styles.verseCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.verseReference, { color: colors.primary }]}>
          {bookName} {chapterNumber}:{verseNumber}
        </Text>
        <Text style={[styles.verseText, { color: colors.secondaryText }]}>
          {verseText.replace(/[✚ℕ]/g, "").trim()}
        </Text>
      </View>

      {/* Notes List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNotes(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {notes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="document-text-outline"
              size={64}
              color={colors.secondaryText}
            />
            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
              Nenhuma anotação encontrada
            </Text>
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.primary }]}
              onPress={handleCreateNew}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createButtonText}>
                Criar primeira anotação
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.notesContainer}>
            {notes.map((note, index) => (
              <View
                key={note.id}
                style={[
                  styles.noteCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                {/* Note Header */}
                <View style={styles.noteHeader}>
                  <View style={styles.noteHeaderLeft}>
                    <Ionicons
                      name="document-text"
                      size={20}
                      color={colors.primary}
                    />
                    <Text
                      style={[styles.noteDate, { color: colors.secondaryText }]}
                    >
                      {formatDate(note.createdAt)}
                    </Text>
                  </View>
                  {note.isPrivate && (
                    <View style={styles.privateBadge}>
                      <Ionicons name="lock-closed" size={12} color="#666" />
                      <Text style={styles.privateBadgeText}>Privado</Text>
                    </View>
                  )}
                </View>

                {/* Verse Range (if multiple verses) */}
                {note.verseNumbers.length > 1 && (
                  <Text
                    style={[styles.verseRange, { color: colors.secondaryText }]}
                  >
                    Versículos {Math.min(...note.verseNumbers)}-
                    {Math.max(...note.verseNumbers)}
                  </Text>
                )}

                {/* Note Content */}
                <Text style={[styles.noteText, { color: colors.text }]}>
                  {note.note}
                </Text>

                {/* Action Buttons */}
                <View style={styles.noteActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: colors.editButton },
                    ]}
                    onPress={() => handleEditNote(note)}
                  >
                    <Ionicons name="create-outline" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Editar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: colors.deleteButton },
                    ]}
                    onPress={() => handleDeleteNote(note)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  addButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  verseCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  verseReference: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  verseText: {
    fontSize: 14,
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  notesContainer: {
    padding: 16,
    gap: 16,
  },
  noteCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  noteHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noteDate: {
    fontSize: 12,
  },
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
  },
  privateBadgeText: {
    fontSize: 11,
    color: "#666",
  },
  verseRange: {
    fontSize: 12,
    marginBottom: 8,
    fontStyle: "italic",
  },
  noteText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  noteActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
