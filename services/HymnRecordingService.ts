import { AudioModule, RecordingPresets, requestRecordingPermissionsAsync, type AudioRecorder } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export interface LocalHymnRecording {
  id: string;
  hymnNumber: number;
  fileName: string;
  uri: string;
  createdAt: number;
  fileSize: number;
  durationMs?: number;
  timingOffsetMs?: number;
}

class HymnRecordingService {
  private readonly RECORDINGS_DIR =
    `${FileSystem.documentDirectory}hymn-recordings/`;

  private async ensureRecordingsDir(): Promise<void> {
    const info = await FileSystem.getInfoAsync(this.RECORDINGS_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(this.RECORDINGS_DIR, {
        intermediates: true,
      });
    }
  }

  async requestPermissions(): Promise<boolean> {
    const permission = await requestRecordingPermissionsAsync();
    return permission.granted;
  }

  async startRecording(): Promise<AudioRecorder> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error("Permissão do microfone negada");
    }

    // Native constructors are exposed at runtime by expo-audio's default module.
    // eslint-disable-next-line import/namespace
    const { AudioRecorder: NativeAudioRecorder } = AudioModule;
    const recording = new NativeAudioRecorder(RecordingPresets.HIGH_QUALITY);
    try {
      await recording.prepareToRecordAsync();
      recording.record();
    } catch (error) {
      recording.release();
      throw error;
    }

    return recording;
  }

  async stopAndSaveRecording(
    recording: AudioRecorder,
    hymnNumber: number,
    timingOffsetMs: number = 0,
  ): Promise<LocalHymnRecording> {
    const durationMs = recording.getStatus().durationMillis;
    let sourceUri: string | null;
    try {
      await recording.stop();
      sourceUri = recording.uri;
    } finally {
      recording.release();
    }

    if (!sourceUri) {
      throw new Error("Não foi possível obter o arquivo da gravação");
    }

    await this.ensureRecordingsDir();

    const timestamp = Date.now();
    const extensionMatch = sourceUri.match(/\.[a-zA-Z0-9]+(?:\?|$)/);
    const extension = extensionMatch
      ? extensionMatch[0].replace("?", "")
      : ".m4a";

    const normalizedTimingOffsetMs = Number.isFinite(timingOffsetMs)
      ? Math.max(-2000, Math.min(2000, Math.round(timingOffsetMs)))
      : 0;

    const fileName = `hino-${hymnNumber}-gravacao-${timestamp}-d${durationMs}-o${normalizedTimingOffsetMs}${extension}`;
    const destinationUri = `${this.RECORDINGS_DIR}${fileName}`;

    await FileSystem.moveAsync({ from: sourceUri, to: destinationUri });

    const fileInfo = await FileSystem.getInfoAsync(destinationUri);

    return {
      id: fileName,
      hymnNumber,
      fileName,
      uri: destinationUri,
      createdAt: timestamp,
      fileSize: fileInfo.exists && fileInfo.size ? fileInfo.size : 0,
      durationMs,
      timingOffsetMs: normalizedTimingOffsetMs,
    };
  }

  async listRecordings(hymnNumber: number): Promise<LocalHymnRecording[]> {
    await this.ensureRecordingsDir();

    const files = await FileSystem.readDirectoryAsync(this.RECORDINGS_DIR);
    const prefix = `hino-${hymnNumber}-gravacao-`;

    const hymnFiles = files.filter((fileName) => fileName.startsWith(prefix));

    const recordings = await Promise.all(
      hymnFiles.map(async (fileName) => {
        const uri = `${this.RECORDINGS_DIR}${fileName}`;
        const info = await FileSystem.getInfoAsync(uri);

        const timestampMatch = fileName.match(/gravacao-(\d+)/);
        const timestampFromName = timestampMatch?.[1]
          ? parseInt(timestampMatch[1], 10)
          : null;
        const durationMatch = fileName.match(
          /-d(\d+)(?:-o-?\d+)?(?:\.[a-zA-Z0-9]+)$/,
        );
        const durationMsFromName = durationMatch?.[1]
          ? parseInt(durationMatch[1], 10)
          : undefined;
        const offsetMatch = fileName.match(/-o(-?\d+)(?:\.[a-zA-Z0-9]+)$/);
        const timingOffsetMsFromName = offsetMatch?.[1]
          ? parseInt(offsetMatch[1], 10)
          : undefined;

        const createdAt =
          timestampFromName ||
          (info.exists && info.modificationTime
            ? info.modificationTime * 1000
            : Date.now());

        return {
          id: fileName,
          hymnNumber,
          fileName,
          uri,
          createdAt,
          fileSize: info.exists && info.size ? info.size : 0,
          durationMs: durationMsFromName,
          timingOffsetMs: timingOffsetMsFromName,
        };
      }),
    );

    return recordings.sort((a, b) => b.createdAt - a.createdAt);
  }

  async deleteRecording(recording: LocalHymnRecording): Promise<void> {
    await FileSystem.deleteAsync(recording.uri, { idempotent: true });
  }

  async exportRecording(recording: LocalHymnRecording): Promise<void> {
    const isSharingAvailable = await Sharing.isAvailableAsync();

    if (!isSharingAvailable) {
      throw new Error("Compartilhamento não disponível neste dispositivo");
    }

    const lowerName = recording.fileName.toLowerCase();
    let mimeType = "audio/mp4";

    if (lowerName.endsWith(".caf")) {
      mimeType = "audio/x-caf";
    } else if (lowerName.endsWith(".3gp")) {
      mimeType = "audio/3gpp";
    } else if (lowerName.endsWith(".wav")) {
      mimeType = "audio/wav";
    } else if (lowerName.endsWith(".aac")) {
      mimeType = "audio/aac";
    }

    await Sharing.shareAsync(recording.uri, {
      mimeType,
      dialogTitle: "Exportar gravação do hino",
    });
  }
}

export default new HymnRecordingService();
