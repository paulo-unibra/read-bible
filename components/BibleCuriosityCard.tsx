import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import React, { useRef, useState } from "react";
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import ViewShot from "react-native-view-shot";
import type { BibleCuriosity } from "../services/BibleCuriosityService";
import bibleCuriosityService from "../services/BibleCuriosityService";

// Paletas de cores que combinam bem
const COLOR_PALETTES = [
  { gradient: ["#667eea", "#764ba2"], text: "#ffffff" }, // Roxo/Azul
  { gradient: ["#f093fb", "#f5576c"], text: "#ffffff" }, // Rosa/Vermelho
  { gradient: ["#4facfe", "#00f2fe"], text: "#ffffff" }, // Azul Claro
  { gradient: ["#43e97b", "#38f9d7"], text: "#ffffff" }, // Verde/Turquesa
  { gradient: ["#fa709a", "#fee140"], text: "#ffffff" }, // Rosa/Amarelo
  { gradient: ["#30cfd0", "#330867"], text: "#ffffff" }, // Azul/Roxo Escuro
  { gradient: ["#ff9a56", "#ff6a88"], text: "#ffffff" }, // Laranja/Rosa
  { gradient: ["#a855f7", "#ec4899"], text: "#ffffff" }, // Roxo/Rosa Vibrante
  { gradient: ["#ffecd2", "#fcb69f"], text: "#333333" }, // Pêssego
  { gradient: ["#13547a", "#80d0c7"], text: "#ffffff" }, // Oceano
];

interface BibleCuriosityCardProps {
  curiosity: BibleCuriosity;
  onFavoriteChange?: () => void;
}

export default function BibleCuriosityCard({
  curiosity,
  onFavoriteChange,
}: BibleCuriosityCardProps) {
  const [isFavorited, setIsFavorited] = useState(curiosity.isFavorited);
  const [isLoading, setIsLoading] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

  // Gera cor aleatória baseada no ID da curiosidade (consistente)
  const paletteIndex = curiosity.id % COLOR_PALETTES.length;
  const palette = COLOR_PALETTES[paletteIndex];

  const handleShare = async () => {
    try {
      setIsLoading(true);

      // Captura o componente como imagem
      if (!viewShotRef.current) {
        Alert.alert("Erro", "Componente não está pronto");
        return;
      }

      const uri = await viewShotRef.current.capture();

      // Compartilha apenas a imagem
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Erro", "Compartilhamento não disponível");
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/jpeg",
        dialogTitle: "Compartilhar Curiosidade Bíblica",
      });
    } catch (error: any) {
      console.error("Erro ao compartilhar:", error);
      Alert.alert("Erro", "Não foi possível compartilhar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFavorite = async () => {
    try {
      setIsLoading(true);
      const response = await bibleCuriosityService.toggleFavorite(curiosity.id);

      if (response.success && response.data) {
        setIsFavorited(response.data.isFavorited);
        if (onFavoriteChange) {
          onFavoriteChange();
        }
      } else {
        Alert.alert("Erro", "Não foi possível favoritar a curiosidade");
      }
    } catch (error) {
      console.error("Erro ao favoritar:", error);
      Alert.alert("Erro", "Ocorreu um erro ao favoritar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Componente para capturar como imagem */}
      <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }}>
        <LinearGradient
          colors={palette.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: "rgba(255, 255, 255, 0.3)" },
              ]}
            >
              <Ionicons name="bulb" size={24} color={palette.text} />
            </View>
            <Text style={[styles.title, { color: palette.text }]}>
              💡 Curiosidade do Dia
            </Text>
          </View>
          <Text style={[styles.content, { color: palette.text }]}>
            {curiosity.content}
          </Text>

          <View style={styles.footer}>
            <View style={styles.footerContent}>
              <Text style={[styles.appName, { color: palette.text }]}>
                Baixe Bíblia em Foco
              </Text>
              <View style={styles.qrContainer}>
                <QRCode
                  value="https://play.google.com/store/apps/details?id=com.readbible.app"
                  size={40}
                  color="#000000"
                  backgroundColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        </LinearGradient>
      </ViewShot>

      {/* Botões de ação fora do ViewShot */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleFavorite}
          disabled={isLoading}
        >
          <Ionicons
            name={isFavorited ? "heart" : "heart-outline"}
            size={24}
            color="#667eea"
          />
          <Text style={styles.actionText}>Favoritar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleShare}
          disabled={isLoading}
        >
          <Ionicons name="share-social" size={24} color="#667eea" />
          <Text style={styles.actionText}>Compartilhar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    marginHorizontal: 16,
  },
  gradient: {
    padding: 20,
    borderRadius: 12,
    minHeight: 100,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontStyle: "italic",
    flex: 1,
    marginVertical: 12,
  },
  footer: {
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
  },
  footerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  appName: {
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.8,
    flex: 1,
  },
  qrContainer: {
    padding: 4,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 6,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  actionText: {
    color: "#667eea",
    fontSize: 13,
    fontWeight: "600",
  },
});
