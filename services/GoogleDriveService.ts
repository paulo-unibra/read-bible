import * as FileSystem from 'expo-file-system/legacy';
import { Bible, DriveFile } from '../types';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
const FOLDER_ID = process.env.EXPO_PUBLIC_DRIVE_FOLDER_ID;

export class GoogleDriveService {
  private baseUrl = 'https://www.googleapis.com/drive/v3';

  async listBibleFiles(): Promise<DriveFile[]> {
    try {
      const url = `${this.baseUrl}/files?q='${FOLDER_ID}'+in+parents&key=${API_KEY}&fields=files(id,name,webContentLink,size,modifiedTime)`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      return data.files
        .filter((file: any) => file.name.endsWith('.db'))
        .map((file: any) => ({
          id: file.id,
          name: file.name,
          webContentLink: file.webContentLink,
          size: file.size,
          modifiedTime: file.modifiedTime,
        }));
    } catch (error) {
      console.error('Error listing Bible files:', error);
      throw error;
    }
  }

  async downloadBible(driveFile: DriveFile, onProgress?: (progress: number) => void): Promise<string> {
    try {
      if (!driveFile.webContentLink) {
        throw new Error('No download link available for this file');
      }

      const fileName = driveFile.name;
      const localPath = `${FileSystem.documentDirectory!}bibles/${fileName}`;
      
      // Ensure the bibles directory exists
      const biblesDir = `${FileSystem.documentDirectory!}bibles/`;
      const dirInfo = await FileSystem.getInfoAsync(biblesDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(biblesDir, { intermediates: true });
      }

      // Download the file
      const downloadResult = await FileSystem.downloadAsync(
        driveFile.webContentLink,
        localPath
      );

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status: ${downloadResult.status}`);
      }

      return localPath;
    } catch (error) {
      console.error('Error downloading Bible:', error);
      throw error;
    }
  }

  async deleteBibleFile(fileName: string): Promise<void> {
    try {
      const localPath = `${FileSystem.documentDirectory!}bibles/${fileName}`;
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localPath);
      }
    } catch (error) {
      console.error('Error deleting Bible file:', error);
      throw error;
    }
  }

  parseBibleInfo(fileName: string): Partial<Bible> {
    // Parse bible info from filename
    // Expected format: [Language]_[Name]_[Abbreviation].db
    const nameWithoutExt = fileName.replace('.db', '');
    const parts = nameWithoutExt.split('_');
    
    if (parts.length >= 3) {
      return {
        id: nameWithoutExt,
        language: parts[0],
        name: parts.slice(1, -1).join(' '),
        abbreviation: parts[parts.length - 1],
        fileName: fileName,
      };
    }
    
    // Fallback for files that don't follow the naming convention
    return {
      id: nameWithoutExt,
      name: nameWithoutExt,
      abbreviation: nameWithoutExt.substring(0, 3).toUpperCase(),
      language: 'Unknown',
      fileName: fileName,
    };
  }

  async getLocalBiblePath(fileName: string): Promise<string | null> {
    try {
      const localPath = `${FileSystem.documentDirectory!}bibles/${fileName}`;
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      
      return fileInfo.exists ? localPath : null;
    } catch (error) {
      console.error('Error checking local Bible file:', error);
      return null;
    }
  }
}

export default new GoogleDriveService();