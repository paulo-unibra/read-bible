// SDK 58's package entrypoint also loads remote topic subscriptions, whose
// native module is absent in Expo Go. Keep local reminders independent of push.
// These build paths are an SDK-specific workaround; review when upgrading Expo.
export { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
export { requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
export { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
export { setNotificationCategoryAsync } from 'expo-notifications/build/setNotificationCategoryAsync';
export { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
export { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
export { cancelAllScheduledNotificationsAsync } from 'expo-notifications/build/cancelAllScheduledNotificationsAsync';
export { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
export { dismissNotificationAsync } from 'expo-notifications/build/dismissNotificationAsync';
export { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications/build/NotificationChannelManager.types';
export { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
export type { Notification, NotificationContentInput, NotificationRequest, NotificationResponse } from 'expo-notifications/build/Notifications.types';
export {
  DEFAULT_ACTION_IDENTIFIER,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from 'expo-notifications/build/NotificationsEmitter';
