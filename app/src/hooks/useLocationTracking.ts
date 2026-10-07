import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { useAppStore, detectCity } from '../store/appStore';
import { calculateDistance } from '../services/stopsService';
import { startAlarm, stopAlarm, startStrongVibration, stopVibration } from '../services/soundService';

const LOCATION_TASK_NAME = 'BUSBELL_BACKGROUND_LOCATION';

// Настройка уведомлений
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Фоновая задача
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    
    if (location) {
      const state = useAppStore.getState();
      const currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      for (const reminder of state.reminders) {
        if (reminder.enabled && !reminder.triggered) {
          const distance = calculateDistance(currentLocation, reminder.location);
          
          if (distance <= reminder.radius) {
            state.triggerReminder(reminder.id);
            
            // Устанавливаем активный будильник если включен режим будильника
            if (state.settings.alarmMode) {
              state.setActiveAlarm(reminder);
            }
            
            // Вибрация (усиленная серия)
            if (state.settings.vibration) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 100);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
              setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 350);
            }

            // Уведомление
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🔔 Вы на месте!',
                body: reminder.name,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
                data: { reminderId: reminder.id, alarmMode: state.settings.alarmMode },
              },
              trigger: null,
            });
          }
        }
      }
    }
  }
});

export const useLocationTracking = () => {
  const {
    currentLocation,
    setCurrentLocation,
    setCurrentCity,
    reminders,
    triggerReminder,
    settings,
    isTracking,
    setIsTracking,
    setActiveAlarm,
  } = useAppStore();

  const watchSubscription = useRef<Location.LocationSubscription | null>(null);

  // Запуск будильника (звук + вибрация)
  const startAlarmMode = useCallback(async (reminder: any) => {
    await startAlarm(reminder.sound, settings.vibration);
  }, [settings.vibration]);

  // Остановка будильника
  const stopAlarmMode = useCallback(async () => {
    await stopAlarm();
  }, []);

  // Проверка напоминаний
  const checkReminders = useCallback(
    async (location: { latitude: number; longitude: number }) => {
      for (const reminder of reminders) {
        if (reminder.enabled && !reminder.triggered) {
          const distance = calculateDistance(location, reminder.location);

          if (distance <= reminder.radius) {
            triggerReminder(reminder.id);

            // Режим будильника
            if (settings.alarmMode) {
              setActiveAlarm(reminder);
              await startAlarmMode(reminder);
            } else if (settings.vibration) {
              // Усиленная вибрация даже без режима будильника
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 100);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
              setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 350);
            }

            // Уведомление
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🔔 Вы на месте!',
                body: reminder.name,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
                data: { reminderId: reminder.id, alarmMode: settings.alarmMode },
              },
              trigger: null,
            });
          }
        }
      }
    },
    [reminders, triggerReminder, settings, setActiveAlarm, startAlarmMode]
  );

  // Запуск отслеживания
  const startTracking = useCallback(async () => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.log('Foreground location permission denied');
        return;
      }

      if (settings.backgroundTracking) {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        
        if (backgroundStatus === 'granted') {
          const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
          
          if (!isTaskRegistered) {
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
              accuracy: Location.Accuracy.High,
              distanceInterval: 30,
              timeInterval: 5000,
              foregroundService: {
                notificationTitle: 'Bus Bell',
                notificationBody: 'Отслеживание активно',
                notificationColor: '#FF6B35',
              },
              pausesUpdatesAutomatically: false,
            });
          }
        }
      }

      watchSubscription.current = await Location.watchPositionAsync(
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
          const city = detectCity(newLocation);
          setCurrentCity(city);
          checkReminders(newLocation);
        }
      );

      setIsTracking(true);
    } catch (error) {
      console.error('Error starting location tracking:', error);
    }
  }, [settings.backgroundTracking, setCurrentLocation, setCurrentCity, checkReminders, setIsTracking]);

  // Остановка отслеживания
  const stopTracking = useCallback(async () => {
    try {
      if (watchSubscription.current) {
        watchSubscription.current.remove();
        watchSubscription.current = null;
      }

      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isTaskRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }

      await stopAlarmMode();
      setIsTracking(false);
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }, [setIsTracking, stopAlarmMode]);

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
      const city = detectCity(newLocation);
      setCurrentCity(city);

      return newLocation;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }, [setCurrentLocation, setCurrentCity]);

  // Отключение будильника
  const dismissAlarm = useCallback(async () => {
    await stopAlarmMode();
    setActiveAlarm(null);
    Notifications.dismissAllNotificationsAsync();
  }, [stopAlarmMode, setActiveAlarm]);

  // Автозапуск
  useEffect(() => {
    const activeReminders = reminders.filter((r) => r.enabled && !r.triggered);

    if (activeReminders.length > 0 && !isTracking) {
      startTracking();
    } else if (activeReminders.length === 0 && isTracking) {
      stopTracking();
    }
  }, [reminders, isTracking, startTracking, stopTracking]);

  // Начальное местоположение
  useEffect(() => {
    if (!currentLocation) {
      getCurrentLocation();
    }
  }, []);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      stopAlarmMode();
    };
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
