import authService, { API_URL } from "./AuthService";

export interface ReadingCertificate {
  id: number;
  code: string;
  readerName: string;
  planName: string;
  planType: string;
  totalChapters: number;
  completedAt: string;
}

export async function getMyCertificates(): Promise<ReadingCertificate[]> {
  const token = authService.getToken();
  const userId = authService.getUser()?.id;
  if (!token || userId == null) return [];
  const url = `${API_URL}/achievements/sync`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const responseText = await response.text();
  if (!response.ok) {
    console.error("[AchievementService] Erro HTTP ao carregar conquistas", {
      url,
      status: response.status,
      statusText: response.statusText,
      response: responseText.slice(0, 4000),
    });
    throw new Error(
      "Não foi possível carregar suas conquistas. Tente novamente.",
    );
  }
  let body;
  try {
    body = JSON.parse(responseText);
  } catch (error) {
    console.error("[AchievementService] Resposta não é JSON válido", {
      url,
      status: response.status,
      response: responseText.slice(0, 4000),
      error,
    });
    throw error;
  }
  if (
    authService.getUser()?.id !== userId ||
    authService.getToken() !== token
  ) {
    throw new Error(
      "A sessão mudou. Entre novamente para ver seus certificados.",
    );
  }
  if (!body?.success || !Array.isArray(body.data)) {
    console.error("[AchievementService] Resposta inválida ao carregar conquistas", {
      url,
      status: response.status,
      response: responseText.slice(0, 4000),
    });
    throw new Error("Não foi possível carregar suas conquistas.");
  }
  return body.data;
}

export function getMedalName(type: string) {
  switch (type) {
    case "yearly":
      return "Bíblia completa · Plano anual";
    case "sequential":
      return "Bíblia completa · Plano sequencial";
    case "interleaved":
      return "Bíblia completa · Plano intercalado";
    case "beginner":
      return "Primeiros passos concluídos";
    default:
      return "Plano de leitura concluído";
  }
}

export function formatCertificateDate(date: string) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Recife",
  });
}
