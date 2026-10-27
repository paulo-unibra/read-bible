import { Asset } from "expo-asset";
import { Platform } from "react-native";
import { getCertificateTheme } from "../utils/certificateTheme";

export const certificateBackground = require("../assets/certificates/classic-background.png");
export const certificateRegularFont = require("../assets/fonts/CertificateClassic-Regular.otf");
export const certificateBoldFont = require("../assets/fonts/CertificateClassic-Bold.otf");
export const certificateItalicFont = require("../assets/fonts/CertificateClassic-Italic.otf");

export {
  getCertificateYear,
  getCertificateTheme,
} from "../utils/certificateTheme";

const backgrounds = {
  classic: certificateBackground,
  blue: require("../assets/certificates/blue-background.png"),
  burgundy: require("../assets/certificates/burgundy-background.png"),
  purple: require("../assets/certificates/purple-background.png"),
};
export function getCertificateBackground(date: string) {
  return backgrounds[getCertificateTheme(date).id];
}
const artworkCache = new Map<
  string,
  Promise<{ background: string; font: string }>
>();
export function loadCertificateArtwork(date = "2026-07-01T12:00:00Z") {
  const theme = getCertificateTheme(date);
  let artwork = artworkCache.get(theme.id);
  if (!artwork) {
    artwork = Promise.all([
      assetData(backgrounds[theme.id], "image/png"),
      assetData(require("../assets/fonts/CertificateSerif.ttf"), "font/ttf"),
    ])
      .then(([background, font]) => ({ background, font }))
      .catch((error) => {
        artworkCache.delete(theme.id);
        throw error;
      });
    artworkCache.set(theme.id, artwork);
  }
  return artwork;
}
async function assetData(module: number, mime: string) {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  if (Platform.OS === "web") {
    const blob = await (await fetch(asset.localUri || asset.uri)).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new Error("Não foi possível carregar a arte do certificado."));
      reader.readAsDataURL(blob);
    });
  }
  const { File } = await import("expo-file-system");
  return `data:${mime};base64,${await new File(asset.localUri || asset.uri).base64()}`;
}
