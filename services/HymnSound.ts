import { createAudioPlayer, type AudioPlayer } from "expo-audio";

// The hymn mixer uses milliseconds; expo-audio's player uses seconds.
export default class HymnSound {
  private constructor(private readonly player: AudioPlayer) {}

  static async createAsync(
    source: { uri: string },
    options: { shouldPlay: boolean; volume: number; progressUpdateIntervalMillis: number },
  ): Promise<{ sound: HymnSound }> {
    const player = createAudioPlayer(source, {
      updateInterval: options.progressUpdateIntervalMillis,
      keepAudioSessionActive: true,
    });
    try {
      const deadline = Date.now() + 15000;
      while (!player.isLoaded) {
        const status = player.currentStatus;
        if (status.error) throw new Error(status.error);
        if (Date.now() >= deadline) throw new Error("Tempo esgotado ao carregar áudio do hino");
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      player.volume = options.volume;
      if (options.shouldPlay) player.play();
      return { sound: new HymnSound(player) };
    } catch (error) {
      player.remove();
      throw error;
    }
  }

  async getStatusAsync() {
    return {
      isLoaded: this.player.isLoaded,
      isPlaying: this.player.playing,
      positionMillis: this.player.currentTime * 1000,
      durationMillis: this.player.duration * 1000,
    };
  }

  async playAsync(): Promise<void> {
    this.player.play();
  }

  async pauseAsync(): Promise<void> {
    this.player.pause();
  }

  async stopAsync(): Promise<void> {
    this.player.pause();
    await this.player.seekTo(0);
  }

  async setPositionAsync(positionMillis: number): Promise<void> {
    await this.player.seekTo(Math.max(0, positionMillis) / 1000);
  }

  async setVolumeAsync(volume: number): Promise<void> {
    this.player.volume = volume;
  }

  async setRateAsync(rate: number, correctPitch: boolean): Promise<void> {
    this.player.shouldCorrectPitch = correctPitch;
    this.player.setPlaybackRate(rate);
  }

  async unloadAsync(): Promise<void> {
    this.player.remove();
  }
}
