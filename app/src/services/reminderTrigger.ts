import { useAppStore, Reminder, Location } from '../store/appStore';
import { calculateDistance } from './stopsService';
import { startAlarm, vibrateOnce } from './soundService';
import { showArrivalNotification } from './alarmNotifications';

/**
 * Дождаться загрузки сохранённых напоминаний из AsyncStorage.
 * Нужно, если Android разбудил фоновую задачу в «холодном» процессе,
 * где стор ещё пустой.
 */
export async function ensureStoreHydrated(): Promise<void> {
  const persist = useAppStore.persist;
  if (persist && !persist.hasHydrated()) {
    try {
      await persist.rehydrate();
    } catch (error) {
      console.error('Error rehydrating store:', error);
    }
  }
}

/**
 * Сработать по одному напоминанию: уведомление (самое надёжное при
 * заблокированном экране), затем будильник со звуком и вибрацией.
 */
async function fireReminder(reminder: Reminder): Promise<void> {
  const { settings, setActiveAlarm } = useAppStore.getState();

  await showArrivalNotification(reminder, settings.alarmMode);

  if (settings.alarmMode) {
    setActiveAlarm(reminder);
    try {
      await startAlarm(reminder.sound, settings.vibration);
    } catch (error) {
      console.error('Error starting alarm:', error);
    }
  } else if (settings.vibration) {
    vibrateOnce();
  }
}

/**
 * Проверить все активные напоминания для текущей точки.
 * Одна и та же функция вызывается и из фоновой задачи, и из обычного
 * отслеживания. Состояние читается напрямую из стора в момент проверки,
 * а напоминание помечается сработавшим до любого await — поэтому
 * двойного срабатывания не будет, даже если оба источника пришлют
 * координаты одновременно.
 */
export async function checkRemindersAt(location: Location): Promise<void> {
  const candidates = useAppStore.getState().reminders.filter(
    (r) => r.enabled && !r.triggered && calculateDistance(location, r.location) <= r.radius
  );

  for (const candidate of candidates) {
    const fresh = useAppStore.getState().reminders.find((r) => r.id === candidate.id);
    if (!fresh || !fresh.enabled || fresh.triggered) continue;

    useAppStore.getState().triggerReminder(fresh.id);
    await fireReminder(fresh);
  }
}
