import api from "./api";

export interface BibleBrainBible {
  id: number;
  bibleId: string;
  name: string;
  languageName: string;
  languageIso: string;
  countryId: string | null;
  date: string | null;
  hasText: boolean;
  hasAudio: boolean;
  isEnabled: boolean;
  packageStatus: string | null;
  packageProgress: number;
  packageSize: number | null;
  packageError: string | null;
  packageGeneratedAt: string | null;
  updatedBy: number | null;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  data: BibleBrainBible[];
  meta: {
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
    firstPage: number;
    firstPageUrl: string;
    lastPageUrl: string;
    nextPageUrl: string | null;
    previousPageUrl: string | null;
  };
}

class BibleBrainService {
  async listAll(params: {
    page?: number;
    perPage?: number;
    search?: string;
    languageIso?: string;
    enabled?: string;
    media?: string;
  } = {}): Promise<ListResponse> {
    const response = await api.get("/admin/bible-brain/bibles", { params });
    return response.data;
  }

  async languages(): Promise<{ iso: string; name: string }[]> {
    const response = await api.get("/admin/bible-brain/languages");
    return response.data.data;
  }

  async sync(): Promise<{ status: string }> {
    const response = await api.post("/admin/bible-brain/sync");
    return response.data;
  }

  async syncStatus(): Promise<{
    status: string;
    totalProcessed: number;
    totalPages: number;
    currentPage: number;
  }> {
    const response = await api.get("/admin/bible-brain/sync/status");
    return response.data.data;
  }

  async toggle(id: number): Promise<BibleBrainBible> {
    const response = await api.patch(`/admin/bible-brain/bibles/${id}/toggle`);
    return response.data.data;
  }

  async requestPackage(id: number): Promise<BibleBrainBible> {
    const response = await api.post(`/admin/bible-brain/bibles/${id}/package`);
    return response.data.data;
  }
}

export default new BibleBrainService();
