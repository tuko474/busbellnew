import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Reminder } from '../store/appStore';

// Каналы уведомлений Android. Настройки канала (звук, важность) Android
// запоминает при первом создании, поэтому при их изменении нужен новый id.
export const ALARM_CHANNEL_ID = 'busbell-alarm-v1';
export const VIBRATE_CHANNEL_ID = 'busbell-alarm-vibrate-v1';

// Категория с кнопкой «Отключить» прямо в уведомлении
export const ALARM_CATEGORY_ID = 'busbell-alarm';
export const DISMISS_ACTION_ID = 'dismiss-alarm';

/** Создать категорию уведомления с кнопкой «Отключить» */
export async function setupNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(ALARM_CATEGORY_ID, [
      {
        identifier: DISMISS_ACTION_ID,
        buttonTitle: 'Отключить',
        options: { opensAppToForeground: true },
      },
    ]);
  } catch (error) {
    console.error('Error creating notification category:', error);
  }
}

/**
 * Создать каналы уведомлений (вызвать при запуске приложения).
 * Канал будильника: максимальная важность, громкий звук alarm.wav с
 * аудио-атрибутом «будильник», длинная вибрация, показ на экране блокировки.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'Будильник на остановке',
      description: 'Громкий сигнал, когда вы подъезжаете к своей остановке',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'alarm.wav',
      enableVibrate: true,
      vibrationPattern: [0, 800, 400, 800, 400, 1200],
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      lightColor: '#FF6B35',
    });

    await Notifications.setNotificationChannelAsync(VIBRATE_CHANNEL_ID, {
      name: 'Напоминание вибрацией',
      description: 'Беззвучное напоминание о подъезде к остановке',
      importance: Notifications.AndroidImportance.MAX,
      sound: null,
      enableVibrate: true,
      vibrationPattern: [0, 600, 250, 600, 250, 600],
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      lightColor: '#FF6B35',
    });
  } catch (error) {
    console.error('Error creating notification channels:', error);
  }
}

/**
 * Показать уведомление «Вы на месте!» в канале будильника.
 * Работает и при погашенном экране — Android сам проиграет звук канала.
 */
export async function showArrivalNotification(reminder: Reminder, alarmMode: boolean): Promise<void> {
  const silent = reminder.sound === 'vibrate';
  const channelId = silent ? VIBRATE_CHANNEL_ID : ALARM_CHANNEL_ID;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Вы на месте!',
        body: `${reminder.name} — пора выходить`,
        sound: silent ? false : 'alarm.wav',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 800, 400, 800],
        sticky: alarmMode,
        autoDismiss: !alarmMode,
        ...(alarmMode ? { categoryIdentifier: ALARM_CATEGORY_ID } : {}),
        data: { reminderId: reminder.id, alarmMode },
      },
      trigger: Platform.OS === 'android' ? { channelId } : null,
    });
  } catch (error) {
    console.error('Error showing arrival notification:', error);
  }
}
