import api from './api';

export interface HymnAudioSync {
  id: number;
  hymnNumber: number;
  instrument: string;
  fileId: string;
  fileName: string;
  offsetMs: number;
  durationMs: number | null;
  defaultVolume: number;
  defaultMuted: boolean;
  displayOrder: number;
  isActive: boolean;
  notes: string | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriveAudioFile {
  fileId: string;
  fileName: string;
  instrument: string;
  size: number | null;
  mimeType: string;
  downloadUrl: string;
}

class HymnAudioService {
  /**
   * Buscar áudios de um hino no Google Drive
   */
  async searchInDrive(hymnNumber: number): Promise<DriveAudioFile[]> {
    const response = await api.get(`/admin/hymn-audios/search/${hymnNumber}`);
    return response.data.data;
  }

  /**
   * Buscar áudios sincronizados de um hino
   */
  async getByHymnNumber(hymnNumber: number): Promise<HymnAudioSync[]> {
    const response = await api.get(`/hymn-audios/${hymnNumber}`);
    return response.data.data;
  }

  /**
   * Criar ou atualizar sincronização de áudio
   */
  async upsert(data: Partial<HymnAudioSync>): Promise<HymnAudioSync> {
    const response = await api.post('/admin/hymn-audios', data);
    return response.data.data;
  }

  /**
   * Atualizar apenas o offset de sincronização
   */
  async updateOffset(id: number, offsetMs: number): Promise<HymnAudioSync> {
    const response = await api.patch(`/admin/hymn-audios/${id}/offset`, { offsetMs });
    return response.data.data;
  }

  /**
   * Deletar sincronização de áudio
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/admin/hymn-audios/${id}`);
  }

  /**
   * Listar todos os hinos que têm áudios
   */
  async listHymnsWithAudio(): Promise<number[]> {
    const response = await api.get('/admin/hymn-audios/list');
    return response.data.data;
  }
}

export default new HymnAudioService();
