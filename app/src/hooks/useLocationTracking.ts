import { useEffect, useCallback, useState } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { useAppStore, detectCity } from '../store/appStore';
import { stopAlarm } from '../services/soundService';
import { checkRemindersAt, ensureStoreHydrated } from '../services/reminderTrigger';

const LOCATION_TASK_NAME = 'BUSBELL_BACKGROUND_LOCATION';

// Фоновая задача: Android присылает сюда координаты, даже когда экран погашен
// и приложение свёрнуто (работает через foreground-сервис геолокации).
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  // Берём самую свежую точку из пачки
  const location = locations && locations.length > 0 ? locations[locations.length - 1] : null;
  if (!location) return;

  await ensureStoreHydrated();
  await checkRemindersAt({
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  });
});

// Одна подписка на всё приложение (хук используется на нескольких экранах)
let watchSubscription: Location.LocationSubscription | null = null;
let trackingBusy: Promise<void> | null = null;

async function startTrackingInternal(): Promise<void> {
  const { settings, setCurrentLocation, setCurrentCity, setIsTracking } = useAppStore.getState();

  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    console.log('Foreground location permission denied');
    return;
  }

  if (settings.backgroundTracking) {
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus === 'granted') {
      const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
      if (!started) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          distanceInterval: 30,
          timeInterval: 5000,
          foregroundService: {
            notificationTitle: 'Bus Bell',
            notificationBody: 'Слежу за остановкой — разбужу, когда подъедете',
            notificationColor: '#FF6B35',
          },
          pausesUpdatesAutomatically: false,
        });
      }
    }
  }

  if (!watchSubscription) {
    watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 15,
        timeInterval: 3000,
      },
      (location) => {
        const newLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setCurrentLocation(newLocation);
        setCurrentCity(detectCity(newLocation));
        checkRemindersAt(newLocation);
      }
    );
  }

  setIsTracking(true);
}

async function stopTrackingInternal(): Promise<void> {
  if (watchSubscription) {
    watchSubscription.remove();
    watchSubscription = null;
  }

  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  // Важно: будильник здесь НЕ останавливаем. Отслеживание выключается
  // как раз тогда, когда последнее напоминание сработало, — и раньше это
  // глушило только что зазвонивший будильник.
  useAppStore.getState().setIsTracking(false);
}

/** Запуск/остановка без гонок: следующий вызов ждёт окончания предыдущего */
function runExclusive(fn: () => Promise<void>): Promise<void> {
  const prev = trackingBusy ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(fn)
    .catch((error) => console.error('Location tracking error:', error));
  trackingBusy = next;
  return next;
}

/**
 * @param autoStart включать/выключать отслеживание по наличию активных
 *   напоминаний. Передавать true только в одном месте (App), чтобы не
 *   запускать отслеживание несколько раз.
 */
export const useLocationTracking = (options: { autoStart?: boolean } = {}) => {
  const { autoStart = false } = options;
  const {
    currentLocation,
    setCurrentLocation,
    setCurrentCity,
    reminders,
    isTracking,
    activeAlarm,
    setActiveAlarm,
  } = useAppStore();

  const startTracking = useCallback(() => runExclusive(startTrackingInternal), []);
  const stopTracking = useCallback(() => runExclusive(stopTrackingInternal), []);

  // Получение текущего местоположения
  const getCurrentLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentLocation(newLocation);
      setCurrentCity(detectCity(newLocation));

      return newLocation;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }, [setCurrentLocation, setCurrentCity]);

  // Отключение будильника
  const dismissAlarm = useCallback(async () => {
    await stopAlarm();
    setActiveAlarm(null);
    await Notifications.dismissAllNotificationsAsync();
  }, [setActiveAlarm]);

  // Ждём, пока сохранённые напоминания загрузятся из памяти телефона,
  // иначе на старте список пустой и отслеживание выключилось бы по ошибке
  const [hydrated, setHydrated] = useState(() => useAppStore.persist?.hasHydrated() ?? true);
  useEffect(() => {
    if (hydrated || !useAppStore.persist) return;
    const unsubscribe = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAppStore.persist.hasHydrated()) setHydrated(true);
    return unsubscribe;
  }, [hydrated]);

  // Автозапуск/остановка по наличию активных напоминаний
  const hasActiveReminders = reminders.some((r) => r.enabled && !r.triggered);
  const alarmRinging = activeAlarm !== null;
  useEffect(() => {
    if (!autoStart || !hydrated) return;
    if (hasActiveReminders && !isTracking) {
      startTracking();
    } else if (!hasActiveReminders && !alarmRinging) {
      // Пока будильник звонит, фоновый сервис геолокации не выключаем:
      // он держит приложение «живым», и Android не прерывает звук.
      // Заодно останавливает сервис, оставшийся с прошлого запуска.
      stopTracking();
    }
  }, [autoStart, hydrated, hasActiveReminders, alarmRinging, isTracking, startTracking, stopTracking]);

  // Начальное местоположение
  useEffect(() => {
    if (autoStart && !currentLocation) {
      getCurrentLocation();
    }
  }, []);

  return {
    currentLocation,
    isTracking,
    startTracking,
    stopTracking,
    getCurrentLocation,
    dismissAlarm,
  };
};
