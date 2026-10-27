import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFocusColors } from "../constants/design";
import { useCertificates } from "../hooks/useCertificates";
import { formatCertificateDate } from "../services/AchievementService";
import {
  shareCertificate,
  shareCertificateImage,
  saveCertificateImage,
} from "../services/CertificateExportService";
import { useThemeCustom } from "../hooks/theme-context";
import Alert from "../services/AppFeedback";
import CertificatePaper from "../components/CertificatePaper";

export default function CertificatesScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { certificates, loading, error, refresh } = useCertificates();
  const { theme } = useThemeCustom();
  const dark = theme === "dark";
  const [previewReady, setPreviewReady] = useState(false);
  const [exportReady, setExportReady] = useState(false);
  const artworkReady = previewReady && exportReady;
  const [sharing, setSharing] = useState<"pdf" | "image" | "save" | null>(null);
  const certificateRef = useRef<ComponentRef<typeof View>>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [previewWidth, setPreviewWidth] = useState(
    Math.min(windowWidth || 390, 680) - 40,
  );
  const colors = getFocusColors(dark);
  const certificate = id
    ? certificates.find((item) => String(item.id) === id)
    : certificates[0];
  const exportPdf = async () => {
    console.info("[CertificatePDF] clique na tela", {
      certificateId: certificate?.id,
      hasCertificate: Boolean(certificate),
      sharing,
    });
    if (!certificate || sharing || !artworkReady || !certificateRef.current)
      return;
    setSharing("pdf");
    try {
      await shareCertificate(certificate, certificateRef);
    } catch (error) {
      console.error("Erro ao compartilhar certificado em PDF:", error);
      Alert.alert(
        "Não foi possível compartilhar",
        error instanceof Error ? error.message : "Tente gerar o PDF novamente.",
      );
    } finally {
      setSharing(null);
      console.info("[CertificatePDF] botão liberado");
    }
  };
  const exportImage = async () => {
    if (!certificate || sharing || !artworkReady || !certificateRef.current)
      return;
    setSharing("image");
    try {
      await shareCertificateImage(certificate, certificateRef);
    } catch (error) {
      Alert.alert(
        "Não foi possível compartilhar a foto",
        error instanceof Error ? error.message : "Tente novamente.",
      );
    } finally {
      setSharing(null);
    }
  };
  const saveImage = async () => {
    if (!certificate || sharing || !artworkReady || !certificateRef.current)
      return;
    setSharing("save");
    try {
      await saveCertificateImage(certificate, certificateRef);
      Alert.alert(
        "Certificado salvo",
        "A imagem foi salva na galeria do celular.",
      );
    } catch (error) {
      console.error("[CertificateImage] falha ao salvar", error);
      Alert.alert(
        "Não foi possível salvar",
        error instanceof Error ? error.message : "Tente novamente.",
      );
    } finally {
      setSharing(null);
    }
  };
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.screen }]}>
      <View style={[styles.header, { borderBottomColor: colors.line }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          style={[styles.heading, { color: colors.text }]}
        >
          Meu certificado
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator
            accessibilityLabel="Carregando certificado"
            color={colors.blueDark}
          />
        ) : error ? (
          <View style={styles.message}>
            <Text style={{ color: colors.text }}>{error}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void refresh()}
              style={styles.back}
            >
              <Text style={{ color: colors.blueDark }}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : !certificate ? (
          <Text style={{ color: colors.text }}>
            Nenhum certificado disponível. Conclua um plano para receber o seu.
          </Text>
        ) : (
          <>
            <View
              style={styles.preview}
              onLayout={({ nativeEvent }) =>
                setPreviewWidth(nativeEvent.layout.width)
              }
              accessible
              accessibilityLabel={`Certificado de conclusão de ${certificate.readerName}. ${certificate.planName}. ${certificate.totalChapters} capítulos lidos. Concluído em ${formatCertificateDate(certificate.completedAt)}. Registro ${certificate.code}.`}
            >
              <CertificatePaper
                certificate={certificate}
                scale={previewWidth / 842}
                onReady={setPreviewReady}
              />
            </View>
            <Text style={[styles.caption, { color: colors.muted }]}>
              Uma conquista na sua jornada de leitura. Seu certificado também
              fica disponível no perfil.
            </Text>
            <View style={styles.actions}>
              {(
                [
                  {
                    action: "save",
                    icon: "download-outline",
                    label: "Salvar imagem na galeria",
                  },
                  {
                    action: "image",
                    icon: "image-outline",
                    label: "Compartilhar imagem do certificado",
                  },
                  {
                    action: "pdf",
                    icon: "document-text-outline",
                    label: "Compartilhar certificado em PDF",
                  },
                ] as const
              ).map((item) => (
                <TouchableOpacity
                  key={item.action}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{
                    disabled: Boolean(sharing) || !artworkReady,
                    busy: sharing === item.action,
                  }}
                  disabled={Boolean(sharing) || !artworkReady}
                  onPress={() => {
                    if (item.action === "save") void saveImage();
                    else if (item.action === "image") void exportImage();
                    else void exportPdf();
                  }}
                  style={[
                    styles.action,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.line,
                      opacity: sharing || !artworkReady ? 0.5 : 1,
                    },
                  ]}
                >
                  {sharing === item.action ? (
                    <ActivityIndicator size="small" color={colors.blueDark} />
                  ) : (
                    <Ionicons
                      name={item.icon}
                      size={24}
                      color={colors.blueDark}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      {certificate && !loading && !error && (
        <View
          ref={certificateRef}
          collapsable={false}
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.exportCanvas}
        >
          <CertificatePaper
            key={certificate.id}
            certificate={certificate}
            scale={1}
            onReady={setExportReady}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    padding: 12,
    gap: 8,
  },
  back: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  heading: { fontSize: 20, fontWeight: "700", flex: 1 },
  content: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },
  preview: {
    width: "100%",
    aspectRatio: 842 / 595,
    overflow: "hidden",
    backgroundColor: "#fffdf6",
  },
  exportCanvas: {
    position: "absolute",
    left: -10000,
    top: 0,
    width: 842,
    height: 595,
    backgroundColor: "#fffdf6",
  },
  caption: { fontSize: 14, lineHeight: 21, marginVertical: 20 },
  actions: { flexDirection: "row", justifyContent: "center", gap: 16 },
  action: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  message: { gap: 16 },
});
