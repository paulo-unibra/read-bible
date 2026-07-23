import * as FileSystem from "expo-file-system/legacy";
import { Bible, BibleBrainBible } from "../types";

export interface VideoBible {
  bibleId: string;
  name: string;
  vname: string | null;
  languageName: string | null;
  languageIso: string | null;
  videoFilesets: { id: string; type: string; size?: string }[];
}

export interface VideoChapterInfo {
  url: string;
  duration: number;
  thumbnail: string | null;
  filesetId: string;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:1999";

async function apiGet<T>(path: string): Promise<T> {
  const url = `${API_URL}${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`BibleBrain API: ${response.status} ${text.slice(0, 200)}`);
  }
  return response.json();
}

async function apiPost<T>(path: string): Promise<T> {
  const url = `${API_URL}${path}`;
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`BibleBrain API: ${response.status} ${text.slice(0, 200)}`);
  }
  return response.json();
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    currentPage: number;
    lastPage: number;
    perPage: number;
  };
}

interface SingleResponse<T> {
  success: boolean;
  data: T;
}

class BibleBrainService {
  async listBibles(options: {
    page?: number;
    perPage?: number;
    search?: string;
    languageIso?: string;
  } = {}): Promise<{ data: BibleBrainBible[]; meta: any }> {
    const params = new URLSearchParams();
    if (options.page) params.set("page", String(options.page));
    if (options.perPage) params.set("perPage", String(options.perPage));
    if (options.search) params.set("search", options.search);
    if (options.languageIso) params.set("languageIso", options.languageIso);

    const qs = params.toString();
    const result = await apiGet<PaginatedResponse<BibleBrainBible>>(
      `/bible-brain/bibles${qs ? `?${qs}` : ""}`,
    );
    return { data: result.data, meta: result.meta };
  }

  async getBible(bibleId: string): Promise<BibleBrainBible> {
    const result = await apiGet<SingleResponse<BibleBrainBible>>(
      `/bible-brain/bibles/${bibleId}`,
    );
    return result.data;
  }

  async requestPackage(bibleId: string): Promise<BibleBrainBible> {
    const result = await apiPost<SingleResponse<BibleBrainBible>>(
      `/bible-brain/bibles/${bibleId}/package`,
    );
    return result.data;
  }

  async packageStatus(bibleId: string): Promise<BibleBrainBible> {
    const result = await apiGet<SingleResponse<BibleBrainBible>>(
      `/bible-brain/bibles/${bibleId}/package`,
    );
    return result.data;
  }

  async getAudioTimestamps(bibleId: string, bookId: string, chapterNumber: number): Promise<{ verseNumber: number; timestampMs: number }[]> {
    const result = await apiGet<{ success: boolean; data: { verseNumber: number; timestampMs: number }[] }>(
      `/bible-brain/bibles/${bibleId}/audio-timestamps/${bookId}/${chapterNumber}`,
    )
    return result.data || []
  }

  async listVideoBibles(languageCode?: string): Promise<VideoBible[]> {
    const params = languageCode ? `?languageCode=${languageCode}` : '';
    const result = await apiGet<{ success: boolean; data: VideoBible[] }>(
      `/bible-brain/video-bibles${params}`,
    );
    return result.data;
  }

  async getVideoBooks(bibleId: string): Promise<{ bookId: string; name: string }[]> {
    const result = await apiGet<{ success: boolean; data: { bookId: string; name: string }[] }>(
      `/bible-brain/bibles/${bibleId}/video-books`,
    )
    return result.data
  }

  async getVideoSegments(bibleId: string, bookId: string, chapterNumber: number): Promise<{ chapter: number; verseStart: number; verseEnd: number; duration: number; thumbnail: string | null; url: string }[]> {
    const result = await apiGet<{ success: boolean; data: any[] }>(
      `/bible-brain/bibles/${bibleId}/video-segments/${bookId}/${chapterNumber}`,
    )
    return result.data
  }

  async getVideoChapterUrl(bibleId: string, bookId: string, chapterNumber: number): Promise<VideoChapterInfo> {
    const result = await apiGet<{ success: boolean; data: VideoChapterInfo }>(
      `/bible-brain/bibles/${bibleId}/video/${bookId}/${chapterNumber}`,
    );
    return result.data;
  }

  async getVideoThumbnail(bibleId: string, bookId: string, chapterNumber: number): Promise<string | null> {
    try {
      const result = await apiGet<{ success: boolean; data: { thumbnail: string | null } }>(
        `/bible-brain/bibles/${bibleId}/video-thumbnail/${bookId}/${chapterNumber}`,
      );
      return result.data?.thumbnail || null;
    } catch {
      return null;
    }
  }

  async getAudioChapterUrl(bibleId: string, bookId: string, chapterNumber: number): Promise<{ url: string; duration: number; filesize: number }> {
    const result = await apiGet<{ success: boolean; data: { url: string; duration: number; filesize: number } }>(
      `/bible-brain/bibles/${bibleId}/audio/${bookId}/${chapterNumber}`,
    )
    return result.data
  }

  async downloadPackage(bibleId: string, fileName: string): Promise<string> {
    const url = `${API_URL}/bible-brain/bibles/${bibleId}/package/download`;
    const localPath = `${FileSystem.documentDirectory!}bibles/${fileName}`;

    const biblesDir = `${FileSystem.documentDirectory!}bibles/`;
    const dirInfo = await FileSystem.getInfoAsync(biblesDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(biblesDir, { intermediates: true });
    }

    const existingFileInfo = await FileSystem.getInfoAsync(localPath);
    if (existingFileInfo.exists) {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
    }

    const downloadResult = await FileSystem.downloadAsync(url, localPath);

    if (downloadResult.status !== 200) {
      throw new Error(`Download falhou com status: ${downloadResult.status}`);
    }

    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (!fileInfo.exists || !fileInfo.size || fileInfo.size === 0) {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
      throw new Error("Arquivo baixado está vazio");
    }

    if (fileInfo.size < 50000) {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
      throw new Error(`Arquivo muito pequeno (${Math.round(fileInfo.size / 1024)}KB)`);
    }

    return localPath;
  }
}

export default new BibleBrainService();
