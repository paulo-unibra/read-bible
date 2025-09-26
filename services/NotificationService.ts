import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior - simplified for Expo Go compatibility
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // deprecated - using shouldShowBanner instead
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  
  async requestPermissions(): Promise<boolean> {
    try {
      // For Expo Go, notifications have limitations
      // Show a warning about this
      if (__DEV__) {
        console.warn('NotificationService: Using development mode - push notifications limited in Expo Go');
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('bible-reading', {
          name: 'Leitura da Bíblia',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2196F3',
        });
      }

      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      // Don't throw error, just return false to allow app to continue
      return false;
    }
  }

  async scheduleDailyNotification(time: string): Promise<void> {
    try {
      // Cancel existing notifications
      await this.cancelAllNotifications();

      // Parse time (HH:MM format)
      const [hours, minutes] = time.split(':').map(Number);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📖 Hora da Leitura Bíblica',
          body: 'Sua leitura diária está esperando por você!',
          sound: 'default',
          data: { type: 'daily-reading' },
        },
        trigger: {
          hour: hours,
          minute: minutes,
          repeats: true,
        } as any,
      });
    } catch (error) {
      console.error('Error scheduling daily notification:', error);
      throw error;
    }
  }

  async scheduleReadingReminder(planName: string, readingText: string): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📚 ${planName}`,
          body: `Leitura de hoje: ${readingText}`,
          sound: 'default',
          data: { type: 'reading-reminder' },
        },
        trigger: {
          seconds: 60, // Show in 1 minute (for testing, adjust as needed)
        } as any,
      });
    } catch (error) {
      console.error('Error scheduling reading reminder:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling notifications:', error);
    }
  }

  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  // Handle notification received while app is in foreground
  addNotificationReceivedListener(handler: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(handler);
  }

  // Handle notification tap response
  addNotificationResponseReceivedListener(handler: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(handler);
  }
}

export default new NotificationService();