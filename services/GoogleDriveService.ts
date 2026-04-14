import * as FileSystem from "expo-file-system/legacy";
import { Bible, DriveFile } from "../types";

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
const FOLDER_ID = process.env.EXPO_PUBLIC_DRIVE_FOLDER_ID;

export class GoogleDriveService {
  private baseUrl = "https://www.googleapis.com/drive/v3";

  async listBibleFiles(): Promise<DriveFile[]> {
    try {
      const url = `${this.baseUrl}/files?q='${FOLDER_ID}'+in+parents&key=${API_KEY}&fields=files(id,name,webContentLink,size,modifiedTime)`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return data.files
        .filter((file: any) => file.name.endsWith(".db"))
        .map((file: any) => ({
          id: file.id,
          name: file.name,
          webContentLink: file.webContentLink,
          size: file.size,
          modifiedTime: file.modifiedTime,
        }));
    } catch (error) {
      console.error("Error listing Bible files:", error);
      throw error;
    }
  }

  async downloadBible(driveFile: DriveFile): Promise<string> {
    try {
      if (!driveFile.webContentLink) {
        throw new Error("No download link available for this file");
      }

      const fileName = driveFile.name;
      const localPath = `${FileSystem.documentDirectory!}bibles/${fileName}`;

      // Ensure the bibles directory exists
      const biblesDir = `${FileSystem.documentDirectory!}bibles/`;
      const dirInfo = await FileSystem.getInfoAsync(biblesDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(biblesDir, { intermediates: true });
      }

      // Delete existing file if present to ensure fresh download
      const existingFileInfo = await FileSystem.getInfoAsync(localPath);
      if (existingFileInfo.exists) {
        console.log('Removing existing file before download:', fileName);
        await FileSystem.deleteAsync(localPath, { idempotent: true });
      }
      
      // Download the file
      console.log('Starting download:', fileName);
      const downloadResult = await FileSystem.downloadAsync(
        driveFile.webContentLink,
        localPath
      );

      if (downloadResult.status !== 200) {
        throw new Error(
          `Download falhou com status: ${downloadResult.status}`
        );
      }
      
      // Verify file was actually downloaded and has content
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (!fileInfo.exists) {
        throw new Error('Download completado mas arquivo não encontrado');
      }
      
      if (!fileInfo.size || fileInfo.size === 0) {
        await FileSystem.deleteAsync(localPath, { idempotent: true });
        throw new Error('Arquivo baixado está vazio');
      }
      
      // Check minimum file size (at least 50KB for a valid Bible database)
      // Lowered minimum to accommodate potential iOS compression differences
      const minSize = 50000; // 50KB
      if (fileInfo.size < minSize) {
        await FileSystem.deleteAsync(localPath, { idempotent: true });
        throw new Error(
          `Arquivo muito pequeno (${Math.round(fileInfo.size / 1024)}KB). ` +
          `Um banco de dados de Bíblia válido deve ter pelo menos ${Math.round(minSize / 1024)}KB. ` +
          `O arquivo pode estar corrompido ou incompleto.`
        );
      }

      console.log(`Bible downloaded successfully: ${fileName} (${Math.round(fileInfo.size / 1024)}KB)`);
      return localPath;
    } catch (error) {
      console.error("Error downloading Bible:", error);
      throw error;
    }
  }

  async deleteBibleFile(fileName: string): Promise<void> {
    try {
      const localPath = `${FileSystem.documentDirectory!}bibles/${fileName}`;
      const fileInfo = await FileSystem.getInfoAsync(localPath);

      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localPath, { idempotent: true });
      }
      
      // Also delete from SQLite directory if exists
      const sqliteDir = FileSystem.documentDirectory! + 'SQLite/';
      const sqlitePath = `${sqliteDir}${fileName}`;
      const sqliteFileInfo = await FileSystem.getInfoAsync(sqlitePath);
      
      if (sqliteFileInfo.exists) {
        await FileSystem.deleteAsync(sqlitePath, { idempotent: true });
      }
      
      console.log(`Bible file deleted: ${fileName}`);
    } catch (error) {
      console.error("Error deleting Bible file:", error);
      throw error;
    }
  }

  parseBibleInfo(fileName: string): Partial<Bible> {
    const nameWithoutExt = fileName.replace(".db", "");
    const parts = nameWithoutExt.split("-");

    return {
      id: nameWithoutExt,
      name: parts[1] ? parts[1].replace(" ", "") : nameWithoutExt,
      abbreviation:
        parts[0].length > 5
          ? parts[0].substring(0, 3).toUpperCase()
          : parts[0].toUpperCase(),
      fileName: fileName,
    };
  }

  async getLocalBiblePath(fileName: string): Promise<string | null> {
    try {
      const localPath = `${FileSystem.documentDirectory!}bibles/${fileName}`;
      const fileInfo = await FileSystem.getInfoAsync(localPath);

      return fileInfo.exists ? localPath : null;
    } catch (error) {
      console.error("Error checking local Bible file:", error);
      return null;
    }
  }

  async clearAllBibleFiles(): Promise<void> {
    try {
      const biblesDir = `${FileSystem.documentDirectory!}bibles/`;
      const dirInfo = await FileSystem.getInfoAsync(biblesDir);

      if (dirInfo.exists) {
        await FileSystem.deleteAsync(biblesDir, { idempotent: true });
        console.log("All Bible files cleared successfully");
      }
    } catch (error) {
      console.error("Error clearing Bible files:", error);
      throw error;
    }
  }
}

export default new GoogleDriveService();
