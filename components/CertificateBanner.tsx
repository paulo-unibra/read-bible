import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ReadingCertificate } from "../services/AchievementService";
import { getFocusColors } from "../constants/design";

export default function CertificateBanner({
  certificate,
  dark = false,
}: {
  certificate: ReadingCertificate;
  dark?: boolean;
}) {
  const colors = getFocusColors(dark);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Ver certificado de conclusão: ${certificate.planName}`}
      onPress={() =>
        router.push({
          pathname: "/certificates",
          params: { id: String(certificate.id) },
        })
      }
      style={[styles.banner, { backgroundColor: dark ? "#30291c" : "#fff6df" }]}
    >
      <Ionicons
        name="ribbon-outline"
        size={36}
        color={dark ? "#f1c86e" : "#88600f"}
      />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>
          Você concluiu seu plano!
        </Text>
        <Text style={[styles.plan, { color: colors.text }]}>
          {certificate.planName}
        </Text>
        <Text style={[styles.action, { color: dark ? "#f1c86e" : "#77500b" }]}>
          Ver meu certificado
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.text} />
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
  },
  copy: { flex: 1, gap: 5 },
  title: { fontSize: 19, fontWeight: "700" },
  plan: { fontSize: 14, lineHeight: 21 },
  action: { marginTop: 5, fontSize: 14, fontWeight: "700" },
});
