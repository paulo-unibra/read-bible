import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useCertificates } from "../hooks/useCertificates";
import {
  formatCertificateDate,
  getMedalName,
} from "../services/AchievementService";
import { getFocusColors } from "../constants/design";

export default function ProfileAchievements({ dark }: { dark: boolean }) {
  const { certificates, loading, error, refresh } = useCertificates();
  const colors = getFocusColors(dark);
  return (
    <View
      style={[styles.section, { backgroundColor: dark ? "#1e1e1e" : "#fff" }]}
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.text }]}
      >
        Certificados e medalhas
      </Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Cada plano concluído faz parte da sua história.
      </Text>
      {loading && (
        <ActivityIndicator
          accessibilityLabel="Carregando conquistas"
          color={colors.blueDark}
          style={styles.loading}
        />
      )}
      {error ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.text }}>{error}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void refresh()}
            style={styles.retry}
          >
            <Text style={{ color: colors.blueDark, fontWeight: "700" }}>
              Tentar novamente
            </Text>
          </TouchableOpacity>
        </View>
      ) : !loading && certificates.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="ribbon-outline" size={32} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Sua próxima conquista começa na leitura
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Conclua todas as leituras de um plano para receber seu certificado e
            sua medalha.
          </Text>
        </View>
      ) : (
        certificates.map((certificate) => (
          <View
            key={certificate.id}
            style={[styles.award, { borderTopColor: colors.line }]}
          >
            <View style={styles.medalRow}>
              <Ionicons
                name="medal"
                size={30}
                color={dark ? "#f1c86e" : "#88600f"}
              />
              <View style={styles.copy}>
                <Text style={[styles.medal, { color: colors.text }]}>
                  {getMedalName(certificate.planType)}
                </Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  {certificate.planName}
                </Text>
                <Text style={[styles.date, { color: colors.muted }]}>
                  {formatCertificateDate(certificate.completedAt)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Abrir certificado: ${certificate.planName}`}
              onPress={() =>
                router.push({
                  pathname: "/certificates",
                  params: { id: String(certificate.id) },
                })
              }
              style={[styles.open, { backgroundColor: colors.blueSoft }]}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color={colors.blueDark}
              />
              <Text style={{ color: colors.blueDark, fontWeight: "700" }}>
                Abrir certificado
              </Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { padding: 20, borderRadius: 16, marginBottom: 20 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 21 },
  loading: { marginTop: 20 },
  empty: { gap: 10, paddingTop: 22 },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  retry: { minHeight: 44, justifyContent: "center" },
  award: { borderTopWidth: 1, marginTop: 20, paddingTop: 20, gap: 14 },
  medalRow: { flexDirection: "row", gap: 12 },
  copy: { flex: 1, gap: 5 },
  medal: { fontSize: 16, fontWeight: "700" },
  date: { fontSize: 12, lineHeight: 18 },
  open: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    padding: 10,
    borderRadius: 12,
  },
});
