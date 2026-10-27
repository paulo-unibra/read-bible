import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getFocusColors } from "../constants/design";
import type { ReadingPlan, ReadingPlanDay } from "../types";
import { getCertificateNameRemainingDays } from "../utils/certificateNameReminder";

export default function CertificateNameReminder({
  plan,
  days,
  dark,
}: {
  plan: ReadingPlan | null;
  days: ReadingPlanDay[];
  dark: boolean;
}) {
  const remaining = getCertificateNameRemainingDays(plan, days);
  if (remaining === null) return null;
  const colors = getFocusColors(dark);
  return (
    <View style={[styles.container, { backgroundColor: colors.blueSoft }]}>
      <View style={styles.heading}>
        <Ionicons name="ribbon-outline" size={26} color={colors.blueDark} />
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.text }]}
        >
          Seu certificado está chegando
        </Text>
      </View>
      <Text style={[styles.description, { color: colors.text }]}>
        {remaining === 1
          ? "Falta 1 dia de leitura"
          : `Faltam ${remaining} dias de leitura`}{" "}
        para concluir este plano. Confira como seu nome aparecerá no
        certificado.
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Revisar o nome que aparecerá no certificado"
        onPress={() =>
          router.push({
            pathname: "/profile",
            params: { editName: "certificate" },
          })
        }
        style={styles.button}
      >
        <Ionicons name="create-outline" size={20} color={colors.blueDark} />
        <Text style={[styles.buttonText, { color: colors.blueDark }]}>
          Revisar nome no certificado
        </Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { padding: 18, borderRadius: 16, marginBottom: 20, gap: 12 },
  heading: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flex: 1, fontSize: 18, lineHeight: 24, fontWeight: "700" },
  description: { fontSize: 14, lineHeight: 22 },
  button: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  buttonText: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
});
