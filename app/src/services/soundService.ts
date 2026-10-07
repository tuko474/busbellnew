import { Audio } from 'expo-av';
import { Vibration } from 'react-native';
import { SoundType } from '../store/appStore';

// Sound file mappings
const SOUND_FILES: Record<string, any> = {
  bell: require('../assets/sounds/bell.wav'),
  alarm: require('../assets/sounds/alarm.wav'),
};

// Паттерны вибрации (мс): пауза, вибрация, пауза, вибрация...
// Vibration из react-native на Android — это настоящий вибромотор с повтором,
// а не короткие тактильные «щелчки» expo-haptics.
const ALARM_VIBRATION = [0, 800, 400, 800, 400, 1200, 700];
const VIBRATE_ONLY_PATTERN = [0, 600, 250, 600, 250, 600, 900];

let currentSound: Audio.Sound | null = null;
let alarmActive = false;

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

/** Идёт ли сейчас будильник */
export function isAlarmActive(): boolean {
  return alarmActive;
}

/**
 * Воспроизвести звук напоминания (по умолчанию — по кругу, пока не остановят)
 */
export async function playReminderSound(soundType: SoundType, loop: boolean = true): Promise<void> {
  await stopSound();

  if (soundType === 'vibrate') return;

  const soundFile = SOUND_FILES[soundType];
  if (!soundFile) {
    console.warn(`Sound file not found for type: ${soundType}`);
    return;
  }

  try {
    const { sound } = await Audio.Sound.createAsync(soundFile, {
      shouldPlay: true,
      isLooping: loop,
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
  const sound = currentSound;
  currentSound = null;
  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch (error) {
      // Ignore errors on cleanup
    }
  }
}

/** Сильная повторяющаяся вибрация для будильника */
export function startStrongVibration(): void {
  Vibration.cancel();
  Vibration.vibrate(ALARM_VIBRATION, true);
}

/** Вибрация для режима «только вибрация» */
export function startVibrateOnlyMode(): void {
  Vibration.cancel();
  Vibration.vibrate(VIBRATE_ONLY_PATTERN, true);
}

/** Однократная серия вибрации (без режима будильника) */
export function vibrateOnce(): void {
  Vibration.vibrate([0, 500, 200, 500, 200, 700]);
}

/** Остановить вибрацию */
export function stopVibration(): void {
  Vibration.cancel();
}

/**
 * Запустить полный будильник (звук + вибрация).
 * Повторный вызов, пока будильник уже звонит, ничего не делает —
 * поэтому фоновая задача, обычное отслеживание и экран будильника
 * не перебивают друг друга.
 */
export async function startAlarm(soundType: SoundType, useVibration: boolean): Promise<void> {
  if (alarmActive) return;
  alarmActive = true;

  if (soundType === 'vibrate') {
    startVibrateOnlyMode();
    return;
  }

  if (useVibration) startStrongVibration();
  await playReminderSound(soundType, true);
}

/**
 * Остановить всё
 */
export async function stopAlarm(): Promise<void> {
  alarmActive = false;
  stopVibration();
  await stopSound();
}

/** Короткая проверка будильника из настроек */
export async function previewAlarm(soundType: SoundType, durationMs: number = 3000): Promise<void> {
  await stopAlarm();
  await startAlarm(soundType, true);
  setTimeout(() => {
    stopAlarm();
  }, durationMs);
}
