import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AuthService from "../services/AuthService";
import NotesService from "../services/NotesService";

export default function NoteEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const bookId = parseInt(params.bookId as string);
  const bookName = params.bookName as string;
  const chapterNumber = parseInt(params.chapterNumber as string);
  const verseNumber = parseInt(params.verseNumber as string);
  const verseText = params.verseText as string;

  const [noteText, setNoteText] = useState("");
  const [isNotePrivate, setIsNotePrivate] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [isEditingExistingNote, setIsEditingExistingNote] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExistingNote();
  }, []);

  const loadExistingNote = async () => {
    try {
      const existingNote = await NotesService.getNoteByReference(
        bookId,
        chapterNumber,
        [verseNumber],
      );

      if (existingNote) {
        setNoteText(existingNote.note);
        setIsEditingExistingNote(true);
      }
    } catch (error) {
      console.error("Error loading note:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveNote = async () => {
    if (!noteText.trim()) {
      Alert.alert("Atenção", "Digite uma anotação antes de salvar.");
      return;
    }

    if (!AuthService.isAuthenticated()) {
      Alert.alert("Erro", "Você precisa estar logado para salvar anotações.");
      return;
    }

    setSavingNote(true);
    Keyboard.dismiss();

    try {
      const cleanVerseText = verseText
        .replace(/[✚ℕ]/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([.,;:!?])/g, "$1")
        .trim();

      const versesText = `${verseNumber} - ${cleanVerseText}`;

      await NotesService.saveNote(
        bookId,
        bookName,
        chapterNumber,
        [verseNumber],
        versesText,
        noteText.trim(),
        isNotePrivate,
      );

      Alert.alert("Sucesso", "Anotação salva com sucesso!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error("Error saving note:", error);
      Alert.alert("Erro", "Não foi possível salvar a anotação");
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async () => {
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
              const notes = await NotesService.getNotesByChapter(
                bookId,
                chapterNumber,
              );
              const note = notes.find((n) =>
                n.verseNumbers.includes(verseNumber),
              );

              if (note) {
                await NotesService.deleteNote(note.id);
                Alert.alert("Sucesso", "Anotação excluída com sucesso!", [
                  {
                    text: "OK",
                    onPress: () => router.back(),
                  },
                ]);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#222" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Anotação</Text>
          <TouchableOpacity
            onPress={saveNote}
            disabled={savingNote || !noteText.trim()}
            style={[
              styles.saveButton,
              (!noteText.trim() || savingNote) && styles.saveButtonDisabled,
            ]}
          >
            {savingNote ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Salvar</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Campo de texto da anotação */}
          <TextInput
            style={styles.noteInput}
            placeholder="O que você gostaria de dizer?"
            placeholderTextColor="#999"
            multiline
            numberOfLines={6}
            value={noteText}
            onChangeText={setNoteText}
            textAlignVertical="top"
            autoFocus
          />

          {/* Toggle Privado/Público */}
          <TouchableOpacity
            style={styles.privacyToggle}
            onPress={() => setIsNotePrivate(!isNotePrivate)}
          >
            <View style={styles.privacyToggleIcon}>
              <Ionicons
                name={isNotePrivate ? "lock-closed" : "globe-outline"}
                size={18}
                color="#222"
              />
            </View>
            <Text style={styles.privacyToggleText}>
              {isNotePrivate ? "Privado" : "Público"}
            </Text>
          </TouchableOpacity>

          {/* Versículo selecionado */}
          <View style={styles.selectedVerseContainer}>
            <Text style={styles.selectedVerseNumber}>{verseNumber}</Text>
            <Text style={styles.selectedVerseText}>
              {verseText.replace(/[✚ℕ]/g, "").trim()}
            </Text>
            <Text style={styles.selectedVerseReference}>
              {bookName} {chapterNumber}:{verseNumber}
            </Text>
          </View>

          {/* Botão de excluir (apenas se estiver editando) */}
          {isEditingExistingNote && (
            <TouchableOpacity style={styles.deleteButton} onPress={deleteNote}>
              <Ionicons name="trash-outline" size={20} color="#f44336" />
              <Text style={styles.deleteButtonText}>Excluir Anotação</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#222",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#2196F3",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 120,
    marginTop: 16,
    marginBottom: 12,
    backgroundColor: "#f5f5f5",
    color: "#222",
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
    color: "#222",
  },
  selectedVerseContainer: {
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: "#f5f5f5",
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
  },
  selectedVerseNumber: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
    color: "#2196F3",
  },
  selectedVerseText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#666",
    marginBottom: 8,
  },
  selectedVerseReference: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: "500",
    color: "#999",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f44336",
    marginBottom: 32,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f44336",
    marginLeft: 8,
  },
});
