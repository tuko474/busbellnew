import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { TRANSPORT_CONFIG, Reminder } from '../store/appStore';
import { startAlarm, stopAlarm } from '../services/soundService';

interface AlarmScreenProps {
  reminder: Reminder;
  onDismiss: () => void;
}

export default function AlarmScreen({ reminder, onDismiss }: AlarmScreenProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const config = TRANSPORT_CONFIG[reminder.type];

  useEffect(() => {
    // Запуск звука + вибрации
    startAlarm(reminder.sound, true);

    // Пульсация
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Тряска
    Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => {
      stopAlarm();
    };
  }, []);

  const handleDismiss = async () => {
    await stopAlarm();
    onDismiss();
  };

  return (
    <View style={styles.container}>
      <View style={styles.background}>
        <Animated.View
          style={[
            styles.pulse,
            { backgroundColor: config.color },
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
      </View>

      <View style={styles.content}>
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ translateX: shakeAnim }] },
          ]}
        >
          <Text style={styles.icon}>🔔</Text>
        </Animated.View>

        <Text style={styles.title}>Вы на месте!</Text>
        
        <View style={[styles.stopBadge, { backgroundColor: `${config.color}30` }]}>
          <Text style={styles.stopIcon}>{config.icon}</Text>
          <Text style={styles.stopName}>{reminder.name}</Text>
        </View>

        <Text style={styles.hint}>Пора выходить!</Text>

        <TouchableOpacity
          style={[styles.dismissButton, { backgroundColor: config.color }]}
          onPress={handleDismiss}
          activeOpacity={0.8}
        >
          <Text style={styles.dismissText}>Отключить</Text>
        </TouchableOpacity>

        <Text style={styles.subHint}>Нажмите чтобы отключить будильник</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulse: {
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 80,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  stopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginBottom: 16,
  },
  stopIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  stopName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    maxWidth: 200,
  },
  hint: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 40,
  },
  dismissButton: {
    paddingVertical: 20,
    paddingHorizontal: 60,
    borderRadius: 30,
    marginBottom: 16,
  },
  dismissText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  subHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
});
