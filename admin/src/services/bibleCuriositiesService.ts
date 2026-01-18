import api from "./api";

interface BibleCuriosity {
  id: number;
  content: string;
  theme: string | null;
  date: string;
  isActive: boolean;
  createdAt: string;
}

interface ListResponse {
  data: BibleCuriosity[];
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

class BibleCuriositiesService {
  async listAll(
    page: number = 1,
    limit: number = 20,
    isActive?: string,
  ): Promise<ListResponse> {
    const params: any = { page, limit };
    if (isActive !== undefined) {
      params.isActive = isActive;
    }

    const response = await api.get("/admin/curiosities", { params });
    return response.data.data;
  }

  async update(
    id: number,
    data: { content?: string; theme?: string; date?: string },
  ): Promise<BibleCuriosity> {
    const response = await api.put(`/admin/curiosities/${id}`, data);
    return response.data.data;
  }

  async toggleActive(id: number): Promise<{ id: number; isActive: boolean }> {
    const response = await api.patch(`/admin/curiosities/${id}/toggle`);
    return response.data.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/admin/curiosities/${id}`);
  }

  async bulkDelete(ids: number[]): Promise<{ deletedCount: number }> {
    const response = await api.post("/admin/curiosities/bulk-delete", { ids });
    return response.data.data;
  }

  async generate(): Promise<BibleCuriosity> {
    const response = await api.post("/curiosities/generate");
    return response.data.data;
  }
}

export default new BibleCuriositiesService();
