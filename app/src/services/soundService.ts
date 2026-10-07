import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { SoundType } from '../store/appStore';

// Sound file mappings
const SOUND_FILES: Record<string, any> = {
  bell: require('../assets/sounds/bell.wav'),
  alarm: require('../assets/sounds/alarm.wav'),
};

let currentSound: Audio.Sound | null = null;
let vibrationInterval: NodeJS.Timeout | null = null;

/**
 * Настройка аудио-режима (вызвать при запуске приложения)
 */
export async function setupAudio(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    console.error('Error setting up audio:', error);
  }
}

/**
 * Воспроизвести звук напоминания
 */
export async function playReminderSound(soundType: SoundType): Promise<void> {
  // Сначала остановим предыдущий звук
  await stopSound();

  if (soundType === 'vibrate') {
    return;
  }

  const soundFile = SOUND_FILES[soundType];
  if (!soundFile) {
    console.warn(`Sound file not found for type: ${soundType}`);
    return;
  }

  try {
    const { sound } = await Audio.Sound.createAsync(soundFile, {
      shouldPlay: true,
      isLooping: true,  // Зацикливаем пока пользователь не отключит
      volume: 1.0,
    });
    currentSound = sound;
  } catch (error) {
    console.error('Error playing sound:', error);
  }
}

/**
 * Остановить текущий звук
 */
export async function stopSound(): Promise<void> {
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch (error) {
      // Ignore errors on cleanup
    }
    currentSound = null;
  }
}

/**
 * Запустить агрессивную вибрацию (серии быстрых тяжёлых импульсов)
 * Паттерн: 3 быстрых вибрации, пауза, повтор
 */
export function startStrongVibration(): void {
  stopVibration();

  let burstCount = 0;

  const doBurst = async () => {
    // Серия из 3 быстрых тяжёлых вибраций
    for (let i = 0; i < 3; i++) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    // Пауза перед следующей нотификацией
    await new Promise((resolve) => setTimeout(resolve, 50));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  // Запускаем серию каждые 600мс (гораздо чаще чем было 800мс с одним лёгким импульсом)
  vibrationInterval = setInterval(() => {
    doBurst();
    burstCount++;
  }, 600);

  // Первый импульс сразу
  doBurst();
}

/**
 * Запустить лёгкую вибрацию (для режима "только вибрация")
 * Тоже усиленная — серия импульсов каждые 400мс
 */
export function startVibrateOnlyMode(): void {
  stopVibration();

  const doVibrate = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((resolve) => setTimeout(resolve, 80));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((resolve) => setTimeout(resolve, 80));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  vibrationInterval = setInterval(doVibrate, 400);
  doVibrate();
}

/**
 * Остановить вибрацию
 */
export function stopVibration(): void {
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
}

/**
 * Запустить полный будильник (звук + вибрация по типу)
 */
export async function startAlarm(soundType: SoundType, useVibration: boolean): Promise<void> {
  // Звук
  if (soundType !== 'vibrate') {
    await playReminderSound(soundType);
  }

  // Вибрация
  if (useVibration) {
    if (soundType === 'vibrate') {
      startVibrateOnlyMode();
    } else {
      startStrongVibration();
    }
  }
}

/**
 * Остановить всё
 */
export async function stopAlarm(): Promise<void> {
  await stopSound();
  stopVibration();
}
