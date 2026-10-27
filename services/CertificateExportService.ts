import {
  ReadingCertificate,
  formatCertificateDate,
} from "./AchievementService";
import { Platform } from "react-native";
import {
  loadCertificateArtwork,
  getCertificateYear,
  getCertificateTheme,
} from "./CertificateDesign";

function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}

export function getCertificateHtml(
  certificate: ReadingCertificate,
  artwork?: { background: string; font: string },
) {
  const mm = (n: number) => `${((n * 297) / 842).toFixed(3)}mm`;
  const name = escapeHtml(certificate.readerName);
  const plan = escapeHtml(certificate.planName);
  const year = getCertificateYear(certificate.completedAt);
  const theme = getCertificateTheme(certificate.completedAt);
  const nameSize =
    certificate.readerName.length > 45
      ? 30
      : certificate.readerName.length > 28
        ? 38
        : 50;
  const text = (cls: string, value: string) =>
    `<div class="text ${cls}">${value}</div>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 0; }
    ${artwork?.font ? `@font-face { font-family: CertificateSerif; src: url('${artwork.font}') format('truetype'); font-weight: 100 900; }` : ""}
    * { box-sizing: border-box; } html,body { margin:0; padding:0; background:${theme.paper}; }
    main { position:relative; width:297mm; height:210mm; overflow:hidden; color:${theme.ink}; font-family:CertificateSerif,Georgia,serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .background { position:absolute; width:100%; height:100%; inset:0; }
    .text { position:absolute; left:${mm(95)}; right:${mm(95)}; text-align:center; }
    .brand { top:${mm(130)}; font-size:${mm(25)}; line-height:${mm(31)}; font-weight:700; }
    .title { top:${mm(164)}; left:${mm(50)}; right:${mm(50)}; font-size:${mm(36)}; line-height:${mm(54)}; font-weight:700; text-transform:uppercase; white-space:nowrap; }
    .rule { position:absolute; top:${mm(220)}; left:${mm(180)}; right:${mm(180)}; height:${mm(1)}; background:${theme.rule}; }
    .intro { top:${mm(226)}; font-size:${mm(20)}; line-height:${mm(26)}; }
    .name { top:${mm(251)}; left:${mm(105)}; right:${mm(105)}; font-size:${mm(nameSize)}; line-height:${mm(60)}; height:${mm(62)}; color:${theme.accent}; font-weight:700; overflow-wrap:anywhere; }
    .name-rule { top:${mm(316)}; left:${mm(145)}; right:${mm(145)}; }
    .reason { top:${mm(325)}; font-size:${mm(20)}; line-height:${mm(26)}; }
    .plan { top:${mm(351)}; left:${mm(120)}; right:${mm(120)}; font-size:${mm(certificate.planName.length > 42 ? 26 : 32)}; line-height:${mm(34)}; font-weight:700; }
    .app { top:${mm(391)}; font-size:${mm(19)}; line-height:${mm(24)}; }
    .blessing { top:${mm(419)}; left:${mm(115)}; right:${mm(115)}; font-size:${mm(18)}; line-height:${mm(23)}; font-style:italic; }
    .seal-content { position:absolute; top:${mm(466)}; left:${mm(375)}; width:${mm(92)}; height:${mm(72)}; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .seal-content .text { position:static; color:${theme.seal}; font-weight:700; }
    .seal-label { font-size:${mm(14)}; line-height:${mm(18)}; }
    .seal-year { font-size:${mm(23)}; line-height:${mm(27)}; }
    .date { top:${mm(512)}; left:${mm(115)}; right:${mm(525)}; font-size:${mm(14)}; line-height:${mm(19)}; }
    .chapters { top:${mm(534)}; left:${mm(115)}; right:${mm(525)}; font-size:${mm(11)}; line-height:${mm(15)}; }
    .issuer { top:${mm(510)}; left:${mm(550)}; right:${mm(115)}; font-size:${mm(20)}; line-height:${mm(25)}; border-bottom:1px solid ${theme.rule}; }
    .issuer-caption { top:${mm(537)}; left:${mm(550)}; right:${mm(115)}; font-size:${mm(12)}; line-height:${mm(16)}; }
    .registry { top:${mm(557)}; font-size:${mm(9)}; line-height:${mm(13)}; }
    </style></head><body><main>
    ${artwork?.background ? `<img class="background" src="${artwork.background}" alt="">` : ""}
    ${text("brand", "Bíblia em Foco")}${text("title", "Certificado de conclusão")}<div class="rule"></div>
    ${text("intro", "Este certificado é concedido a")}${text("name", name)}<div class="rule name-rule"></div>
    ${text("reason", "por concluir com dedicação o")}${text("plan", plan)}${text("app", "no aplicativo Bíblia em Foco.")}
    ${text("blessing", "Que a Palavra de Deus continue sendo luz para o seu caminho.")}
    <div class="seal-content">${text("seal-label", "Conquista")}${text("seal-year", escapeHtml(year))}</div>
    ${text("date", `Data: ${escapeHtml(formatCertificateDate(certificate.completedAt))}`)}
    ${text("chapters", `${certificate.totalChapters.toLocaleString("pt-BR")} capítulos concluídos`)}
    ${text("issuer", "Bíblia em Foco")}${text("issuer-caption", "Certificado de leitura")}
    ${text("registry", `Registro ${escapeHtml(certificate.code)}`)}
    </main></body></html>`;
}

/** Print the same rendered artwork shown on screen, avoiding WebView font substitution. */
export function getCertificateImageHtml(base64: string) {
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64))
    throw new Error("A imagem do certificado é inválida.");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 0; }
    html, body { margin: 0; padding: 0; width: 297mm; height: 210mm; overflow: hidden; }
    img { display: block; width: 297mm; height: 209.9mm; object-fit: fill; }
    </style></head><body><img src="data:image/jpeg;base64,${base64}" alt="Certificado de conclusão"></body></html>`;
}

export async function shareCertificate(
  certificate: ReadingCertificate,
  target?: Parameters<typeof import("react-native-view-shot").captureRef>[0],
) {
  const startedAt = Date.now();
  const attemptId = `pdf-${startedAt.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  let stage = "preparar-html";
  const log = (event: string, details: Record<string, unknown> = {}) => {
    console.info("[CertificatePDF]", {
      attemptId,
      event,
      stage,
      platform: Platform.OS,
      platformVersion: Platform.Version,
      certificateId: certificate.id,
      elapsedMs: Date.now() - startedAt,
      ...details,
    });
  };

  try {
    log("início");
    let html: string;
    // Web printing returns no file URI. Open synchronously during the press.
    if (Platform.OS === "web") {
      stage = "abrir-impressão-web";
      const preview = window.open("", "_blank", "width=1123,height=794");
      if (!preview) {
        throw new Error(
          "Permita abrir novas janelas no navegador e tente novamente.",
        );
      }
      preview.opener = null;
      html = getCertificateHtml(
        certificate,
        await loadCertificateArtwork(certificate.completedAt),
      );
      preview.document.open();
      preview.addEventListener(
        "load",
        () => {
          log("janela-web-carregada");
          preview.focus();
          preview.print();
        },
        { once: true },
      );
      preview.document.write(html);
      preview.document.close();
      log("janela-web-aberta");
      return;
    }

    if (target) {
      stage = "capturar-prévia-para-pdf";
      log("capturando-certificado", { width: 2526, height: 1785 });
      const { captureRef } = await import("react-native-view-shot");
      const image = await captureRef(target, {
        format: "jpg",
        quality: 1,
        result: "base64",
        width: 2526,
        height: 1785,
      });
      if (!image)
        throw new Error(
          "Não foi possível preparar a imagem do certificado para o PDF.",
        );
      html = getCertificateImageHtml(image);
    } else {
      stage = "carregar-arte-do-certificado";
      log("carregando-arte");
      html = getCertificateHtml(
        certificate,
        await loadCertificateArtwork(certificate.completedAt),
      );
    }
    log("html-pronto", { htmlLength: html.length });
    stage = "carregar-expo-print";
    log("carregando-módulo");
    const Print = await import("expo-print");
    log("módulo-carregado", {
      printToFileAsync: typeof Print.printToFileAsync,
      printAsync: typeof Print.printAsync,
    });
    stage = "carregar-expo-sharing";
    log("carregando-módulo");
    const Sharing = await import("expo-sharing");
    log("módulo-carregado", {
      isAvailableAsync: typeof Sharing.isAvailableAsync,
      shareAsync: typeof Sharing.shareAsync,
    });

    stage = "verificar-compartilhamento";
    log("verificando-disponibilidade");
    const available = await Sharing.isAvailableAsync();
    log("disponibilidade", { available });
    if (!available) {
      stage = "impressão-alternativa";
      log("abrindo-impressão");
      await Print.printAsync({ html });
      log("impressão-aberta");
      return;
    }

    stage = "gerar-pdf";
    log("gerando-pdf", { width: 842, height: 595 });
    const result = await Print.printToFileAsync({
      html,
      width: 842,
      height: 595,
      base64: true,
    });
    log("resultado-pdf", {
      hasUri: Boolean(result?.uri),
      uriScheme: result?.uri?.split(":")[0],
      numberOfPages: result?.numberOfPages,
      hasBase64: Boolean(result?.base64),
    });
    if (!result?.uri) {
      throw new Error(
        "A geração do PDF não retornou um arquivo. Tente novamente.",
      );
    }
    // Expo Go scopes file permissions to this project's cache. expo-print may
    // return a URI in the host app's cache, which expo-sharing cannot read.
    // Write the returned PDF bytes into the project's permitted directory.
    stage = "salvar-pdf-no-cache-do-projeto";
    log("salvando-arquivo-compartilhável");
    if (!result.base64) {
      throw new Error(
        "A geração do PDF não retornou o conteúdo do arquivo. Tente novamente.",
      );
    }
    const { File, Paths } = await import("expo-file-system");
    const file = new File(
      Paths.cache,
      `certificado-${certificate.id}-${attemptId}.pdf`,
    );
    file.create({ overwrite: true });
    await file.write(result.base64, { encoding: "base64" });
    if (!file.exists || file.size === 0) {
      throw new Error(
        "Não foi possível salvar o certificado para compartilhar.",
      );
    }
    log("arquivo-compartilhável-pronto", {
      exists: file.exists,
      size: file.size,
    });
    stage = "abrir-compartilhamento";
    log("abrindo-compartilhamento", { mimeType: "application/pdf" });
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Compartilhar certificado",
    });
    log("compartilhamento-encerrado");
  } catch (error) {
    const details = error as {
      name?: string;
      code?: string;
      message?: string;
      stack?: string;
      cause?: unknown;
    } | null;
    console.error("[CertificatePDF] falha", {
      attemptId,
      stage,
      platform: Platform.OS,
      platformVersion: Platform.Version,
      certificateId: certificate.id,
      elapsedMs: Date.now() - startedAt,
      name: details?.name,
      code: details?.code,
      message: details?.message ?? String(error),
      stack: details?.stack,
      cause: details?.cause,
    });
    throw error;
  }
}

export async function shareCertificateImage(
  certificate: ReadingCertificate,
  target: Parameters<typeof import("react-native-view-shot").captureRef>[0],
) {
  console.info("[CertificateImage] início", { certificateId: certificate.id });
  try {
    const Sharing = await import("expo-sharing");
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error(
        "O compartilhamento de imagens não está disponível neste dispositivo.",
      );
    }
    const file = await createCertificateImageFile(certificate, target);
    console.info("[CertificateImage] imagem pronta", {
      certificateId: certificate.id,
      size: file.size,
    });
    await Sharing.shareAsync(file.uri, {
      mimeType: "image/png",
      UTI: "public.png",
      dialogTitle: "Compartilhar certificado como foto",
    });
    console.info("[CertificateImage] compartilhamento encerrado");
  } catch (error) {
    console.error("[CertificateImage] falha", error);
    throw error;
  }
}

async function createCertificateImageFile(
  certificate: ReadingCertificate,
  target: Parameters<typeof import("react-native-view-shot").captureRef>[0],
) {
  const { captureRef } = await import("react-native-view-shot");
  const base64 = await captureRef(target, {
    format: "png",
    quality: 1,
    result: "base64",
    width: 2526,
    height: 1785,
  });
  if (!base64)
    throw new Error("Não foi possível gerar a imagem do certificado.");
  const { File, Paths } = await import("expo-file-system");
  const file = new File(
    Paths.cache,
    `certificado-${certificate.id}-${Date.now()}.png`,
  );
  file.create({ overwrite: true });
  await file.write(base64, { encoding: "base64" });
  if (!file.exists || !file.size)
    throw new Error("Não foi possível salvar a imagem do certificado.");
  return file;
}

export async function saveCertificateImage(
  certificate: ReadingCertificate,
  target: Parameters<typeof import("react-native-view-shot").captureRef>[0],
) {
  const MediaLibrary = await import("expo-media-library");
  // Modern Android can add our own image through MediaStore without reading
  // the user's library. iOS and older Android require write permission.
  if (
    Platform.OS === "ios" ||
    (Platform.OS === "android" && Number(Platform.Version) < 30)
  ) {
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted)
      throw new Error(
        "Permita salvar fotos nas configurações do celular para guardar o certificado.",
      );
  }
  const file = await createCertificateImageFile(certificate, target);
  await MediaLibrary.Asset.create(file.uri);
  console.info("[CertificateImage] salvo na galeria", {
    certificateId: certificate.id,
  });
}
