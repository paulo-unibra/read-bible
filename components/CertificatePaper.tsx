import { Image, StyleSheet, Text, View } from "react-native";
import { useFonts } from "expo-font";
import { useEffect, useState } from "react";
import type { ReadingCertificate } from "../services/AchievementService";
import { formatCertificateDate } from "../services/AchievementService";
import {
  getCertificateBackground,
  getCertificateTheme,
  certificateRegularFont,
  certificateBoldFont,
  certificateItalicFont,
  getCertificateYear,
} from "../services/CertificateDesign";

export default function CertificatePaper({
  certificate,
  scale,
  onReady,
}: {
  certificate: ReadingCertificate;
  scale: number;
  onReady: (ready: boolean) => void;
}) {
  const [fontsLoaded, fontError] = useFonts({
    CertificateClassicRegular: certificateRegularFont,
    CertificateClassicBold: certificateBoldFont,
    CertificateClassicItalic: certificateItalicFont,
  });
  const theme = getCertificateTheme(certificate.completedAt);
  const background = getCertificateBackground(certificate.completedAt);
  const [loadedBackground, setLoadedBackground] = useState<unknown>(null);
  const imageLoaded = loadedBackground === background;
  useEffect(() => {
    onReady(Boolean(fontsLoaded && imageLoaded));
  }, [fontsLoaded, imageLoaded, onReady]);
  useEffect(() => {
    if (fontError) console.error("[CertificateDesign] fonte", fontError);
  }, [fontError]);
  const year = getCertificateYear(certificate.completedAt);
  const fontSize =
    certificate.readerName.length > 45
      ? 30
      : certificate.readerName.length > 28
        ? 38
        : 50;
  return (
    <View
      style={[
        styles.paper,
        { backgroundColor: theme.paper },
        { transform: [{ scale }] },
      ]}
    >
      <Image
        key={theme.id}
        source={background}
        style={styles.background}
        resizeMode="stretch"
        onLoad={() => setLoadedBackground(background)}
        onError={(event) =>
          console.error("[CertificateDesign] fundo", event.nativeEvent.error)
        }
      />
      <Text
        allowFontScaling={false}
        style={[styles.text, { color: theme.ink }, styles.brand]}
      >
        Bíblia em Foco
      </Text>
      <Text
        allowFontScaling={false}
        style={[styles.text, { color: theme.ink }, styles.title]}
      >
        Certificado de Conclusão
      </Text>
      <View style={[styles.rule, { backgroundColor: theme.rule }]} />
      <Text
        allowFontScaling={false}
        style={[styles.text, { color: theme.ink }, styles.intro]}
      >
        Este certificado é concedido a
      </Text>
      <Text
        allowFontScaling={false}
        style={[
          styles.text,
          { color: theme.ink },
          styles.name,
          { color: theme.accent },
          { fontSize, lineHeight: fontSize <= 30 ? 32 : 60 },
        ]}
      >
        {certificate.readerName}
      </Text>
      <View
        style={[styles.rule, styles.nameRule, { backgroundColor: theme.rule }]}
      />
      <Text
        allowFontScaling={false}
        style={[styles.text, { color: theme.ink }, styles.reason]}
      >
        por concluir com dedicação o
      </Text>
      <Text
        allowFontScaling={false}
        style={[
          styles.text,
          { color: theme.ink },
          styles.plan,
          { fontSize: certificate.planName.length > 42 ? 26 : 32 },
        ]}
      >
        {certificate.planName}
      </Text>
      <Text
        allowFontScaling={false}
        style={[styles.text, { color: theme.ink }, styles.app]}
      >
        no aplicativo Bíblia em Foco.
      </Text>
      <Text
        allowFontScaling={false}
        style={[styles.text, { color: theme.ink }, styles.blessing]}
      >
        Que a Palavra de Deus continue sendo luz para o seu caminho.
      </Text>
      <View style={styles.sealContent}>
        <Text
          allowFontScaling={false}
          style={[styles.sealText, styles.sealLabel, { color: theme.seal }]}
        >
          Conquista
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.sealText, styles.sealYear, { color: theme.seal }]}
        >
          {year}
        </Text>
      </View>
      <Text
        allowFontScaling={false}
        style={[styles.text, { color: theme.ink }, styles.date]}
      >
        Data: {formatCertificateDate(certificate.completedAt)}
      </Text>
      <Text
        allowFontScaling={false}
        style={[styles.text, { color: theme.ink }, styles.chapters]}
      >
        {certificate.totalChapters.toLocaleString("pt-BR")} capítulos concluídos
      </Text>
      <Text
        allowFontScaling={false}
        style={[
          styles.text,
          { color: theme.ink },
          styles.issuer,
          { borderBottomColor: theme.rule },
        ]}
      >
        Bíblia em Foco
      </Text>
      <Text
        allowFontScaling={false}
        style={[styles.text, { color: theme.ink }, styles.issuerCaption]}
      >
        Certificado de leitura
      </Text>
      <Text
        allowFontScaling={false}
        style={[styles.text, { color: theme.ink }, styles.registry]}
      >
        Registro {certificate.code}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  paper: {
    position: "absolute",
    width: 842,
    height: 595,
    left: "50%",
    top: "50%",
    marginLeft: -421,
    marginTop: -297.5,
    backgroundColor: "#faf5e8",
  },
  background: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 842,
    height: 595,
  },
  text: {
    position: "absolute",
    left: 95,
    right: 95,
    textAlign: "center",
    color: "#173520",
    fontFamily: "CertificateClassicRegular",
    includeFontPadding: false,
  },
  brand: {
    top: 130,
    fontSize: 25,
    lineHeight: 31,
    fontFamily: "CertificateClassicBold",
  },
  title: {
    top: 164,
    fontSize: 45,
    lineHeight: 54,
    fontFamily: "CertificateClassicBold",
    textTransform: "uppercase",
    left: 50,
    right: 50,
  },
  rule: {
    position: "absolute",
    top: 220,
    left: 180,
    right: 180,
    height: 1,
    backgroundColor: "#ae8532",
  },
  intro: { top: 226, fontSize: 20, lineHeight: 26 },
  name: {
    top: 251,
    height: 62,
    lineHeight: 60,
    color: "#956b19",
    fontFamily: "CertificateClassicBold",
    left: 105,
    right: 105,
  },
  nameRule: { top: 316, left: 145, right: 145 },
  reason: { top: 325, fontSize: 20, lineHeight: 26 },
  plan: {
    top: 351,
    lineHeight: 34,
    height: 42,
    fontFamily: "CertificateClassicBold",
    left: 120,
    right: 120,
  },
  app: { top: 385, fontSize: 18, lineHeight: 20 },
  blessing: {
    top: 405,
    fontSize: 15,
    lineHeight: 18,
    fontFamily: "CertificateClassicItalic",
    left: 115,
    right: 115,
  },
  sealContent: {
    position: "absolute",
    top: 466,
    left: 375,
    width: 92,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  sealText: {
    color: "#4d3810",
    fontFamily: "CertificateClassicBold",
    textAlign: "center",
    includeFontPadding: false,
  },
  sealLabel: { fontSize: 14, lineHeight: 18 },
  sealYear: { fontSize: 23, lineHeight: 27 },
  date: { top: 512, left: 115, right: 525, fontSize: 14, lineHeight: 19 },
  chapters: { top: 534, left: 115, right: 525, fontSize: 11, lineHeight: 15 },
  issuer: {
    top: 510,
    left: 550,
    right: 115,
    fontSize: 20,
    lineHeight: 25,
    borderBottomWidth: 1,
    borderBottomColor: "#8a774e",
  },
  issuerCaption: {
    top: 537,
    left: 550,
    right: 115,
    fontSize: 12,
    lineHeight: 16,
  },
  registry: { top: 557, fontSize: 9, lineHeight: 13 },
});
