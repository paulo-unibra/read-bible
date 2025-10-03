import { Audio, AVPlaybackStatus } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';

interface AudioState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  sound: Sound | null;
  currentBookId: number | null;
  currentChapter: number | null;
}

class AudioService {
  private state: AudioState = {
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    sound: null,
    currentBookId: null,
    currentChapter: null,
  };

  private listeners: Set<(state: AudioState) => void> = new Set();
  private DRIVE_FOLDER_ID = "1oqKoOzUu1Ae6sFYlb6QI-wMN4aHjKYjw";
  private API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;

  // Mapeamento de nomes de livros bíblicos para o padrão dos arquivos de áudio
  // Baseado no exemplo fornecido: "apocalipse-7.mp3"
  private bookNameMapping: { [key: number]: string } = {
    // Antigo Testamento
    1: 'genesis',
    2: 'exodo', 
    3: 'levitico',
    4: 'numeros',
    5: 'deuteronomio',
    6: 'josue',
    7: 'juizes',
    8: 'rute',
    9: '1samuel',
    10: '2samuel',
    11: '1reis',
    12: '2reis',
    13: '1cronicas',
    14: '2cronicas',
    15: 'esdras',
    16: 'neemias',
    17: 'ester',
    18: 'jo',
    19: 'salmos',
    20: 'proverbios',
    21: 'eclesiastes',
    22: 'cantares',
    23: 'isaias',
    24: 'jeremias',
    25: 'lamentacoes',
    26: 'ezequiel',
    27: 'daniel',
    28: 'oseias',
    29: 'joel',
    30: 'amos',
    31: 'obadias',
    32: 'jonas',
    33: 'miqueias',
    34: 'naum',
    35: 'habacuque',
    36: 'sofonias',
    37: 'ageu',
    38: 'zacarias',
    39: 'malaquias',
    // Novo Testamento
    40: 'mateus',
    41: 'marcos',
    42: 'lucas',
    43: 'joao',
    44: 'atos',
    45: 'romanos',
    46: '1corintios',
    47: '2corintios',
    48: 'galatas',
    49: 'efesios',
    50: 'filipenses',
    51: 'colossenses',
    52: '1tessalonicenses',
    53: '2tessalonicenses',
    54: '1timoteo',
    55: '2timoteo',
    56: 'tito',
    57: 'filemom',
    58: 'hebreus',
    59: 'tiago',
    60: '1pedro',
    61: '2pedro',
    62: '1joao',
    63: '2joao',
    64: '3joao',
    65: 'judas',
    66: 'apocalipse', // Como no exemplo: "apocalipse-7.mp3"
  };

  constructor() {
    this.initializeAudio();
  }

  private async initializeAudio() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Error initializing audio:', error);
    }
  }

  addListener(callback: (state: AudioState) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback(this.state));
  }

  private getAudioFileName(bookId: number, chapter: number): string {
    const bookName = this.bookNameMapping[bookId];
    if (!bookName) {
      throw new Error(`Book not found for ID: ${bookId}`);
    }
    return `${bookName}-${chapter}.mp3`;
  }

  private async getAudioUrl(fileName: string): Promise<string> {
    try {
      // Primeiro, listar os arquivos na pasta para encontrar o arquivo específico
      const listUrl = `https://www.googleapis.com/drive/v3/files?q='${this.DRIVE_FOLDER_ID}'+in+parents+and+name='${fileName}'&key=${this.API_KEY}&fields=files(id,name,webContentLink)`;
      
      const response = await fetch(listUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.files || data.files.length === 0) {
        throw new Error(`Audio file not found: ${fileName}`);
      }
      
      const file = data.files[0];
      if (!file.id) {
        throw new Error('File ID not found');
      }
      
      // Retornar URL direta do Google Drive para streaming
      return `https://drive.google.com/uc?export=download&id=${file.id}`;
    } catch (error) {
      console.error('Error getting audio URL:', error);
      throw error;
    }
  }

  async loadAndPlay(bookId: number, chapter: number): Promise<void> {
    try {
      // Se já está tocando o mesmo capítulo, apenas pausar/reproduzir
      if (this.state.currentBookId === bookId && this.state.currentChapter === chapter && this.state.sound) {
        if (this.state.isPlaying) {
          await this.pause();
        } else {
          await this.play();
        }
        return;
      }

      // Parar áudio atual se estiver tocando
      await this.stop();

      this.state.isLoading = true;
      this.state.currentBookId = bookId;
      this.state.currentChapter = chapter;
      this.notifyListeners();

      const fileName = this.getAudioFileName(bookId, chapter);
      const audioUrl = await this.getAudioUrl(fileName);

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        (status) => this.onPlaybackStatusUpdate(status)
      );

      this.state.sound = sound;
      this.state.isLoading = false;
      this.state.isPlaying = true;
      
      // Force um status update inicial
      const initialStatus = await sound.getStatusAsync();
      this.onPlaybackStatusUpdate(initialStatus);
      
      this.notifyListeners();

    } catch (error) {
      console.error('Error loading audio:', error);
      this.state.isLoading = false;
      this.state.isPlaying = false;
      this.notifyListeners();
      
      // Re-throw com mensagem mais amigável
      if (error instanceof Error && error.message.includes('not found')) {
        throw new Error(`Áudio não disponível para este capítulo`);
      }
      throw new Error('Erro ao carregar áudio');
    }
  }

  async play(): Promise<void> {
    if (this.state?.sound && !this.state.isPlaying) {
      try {
        await this.state.sound.playAsync();
        this.state.isPlaying = true;
        this.notifyListeners();
      } catch (error) {
        console.error('Error playing audio:', error);
      }
    }
  }

  async pause(): Promise<void> {
    if (this.state?.sound && this.state.isPlaying) {
      try {
        await this.state.sound.pauseAsync();
        this.state.isPlaying = false;
        this.notifyListeners();
      } catch (error) {
        console.error('Error pausing audio:', error);
      }
    }
  }

  async stop(): Promise<void> {
    if (this.state?.sound) {
      try {
        await this.state.sound.stopAsync();
        await this.state.sound.unloadAsync();
      } catch (error) {
        console.error('Error stopping audio:', error);
      }
    }
    
    // Reset state regardless of sound status
    this.state.sound = null;
    this.state.isPlaying = false;
    this.state.currentTime = 0;
    this.state.duration = 0;
    this.state.currentBookId = null;
    this.state.currentChapter = null;
    this.notifyListeners();
  }

  async seekTo(positionMillis: number): Promise<void> {
    if (this.state?.sound) {
      try {
        await this.state.sound.setPositionAsync(positionMillis);
      } catch (error) {
        console.error('Error seeking audio:', error);
      }
    }
  }

  private onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      this.state.currentTime = status.positionMillis || 0;
      this.state.duration = status.durationMillis || 0;
      this.state.isPlaying = status.isPlaying;
      
      // Debug log para verificar se está atualizando
      // console.log('Audio status update:', {
      //   currentTime: this.state.currentTime,
      //   duration: this.state.duration,
      //   isPlaying: this.state.isPlaying
      // });
      
      // Se chegou ao fim do áudio
      if (status.didJustFinish) {
        this.state.isPlaying = false;
        this.state.currentTime = 0;
      }
      
      this.notifyListeners();
    } else {
      console.log('Audio status not loaded:', status);
    }
  }

  getState(): AudioState {
    return { ...this.state };
  }

  isCurrentChapter(bookId: number, chapter: number): boolean {
    return this.state.currentBookId === bookId && this.state.currentChapter === chapter;
  }

  formatTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  async cleanup(): Promise<void> {
    await this.stop();
    this.listeners.clear();
  }
}

export default new AudioService();