import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore, THEMES } from '../store/appStore';

// Типы для браслета
interface BraceletDevice {
  id: string;
  name: string;
  rssi: number;
}

interface BraceletState {
  connected: boolean;
  batteryLevel: number;
  firmwareVersion: string;
  vibrationLevel: number; // 1-3
  vibrationPattern: number; // 0-2
}

const VIBRATION_LEVELS = [
  { id: 1, name: 'Лёгкая', icon: '📳', desc: 'Деликатная вибрация' },
  { id: 2, name: 'Средняя', icon: '📳📳', desc: 'Стандартная сила' },
  { id: 3, name: 'Максимальная', icon: '📳📳📳', desc: 'Гарантированно разбудит' },
];

const VIBRATION_PATTERNS = [
  { id: 0, name: 'Непрерывная', icon: '━━━', desc: 'Постоянная вибрация' },
  { id: 1, name: 'Пульсирующая', icon: '━ ━ ━', desc: 'Короткие импульсы' },
  { id: 2, name: 'Нарастающая', icon: '╺━━', desc: 'От слабой к сильной' },
];

export default function AccessoriesScreen() {
  const { theme } = useAppStore();
  const colors = THEMES[theme];

  const [isScanning, setIsScanning] = useState(false);
  const [foundDevices, setFoundDevices] = useState<BraceletDevice[]>([]);
  const [bracelet, setBracelet] = useState<BraceletState | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<BraceletDevice | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(scanAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scanAnim.setValue(0);
    }
  }, [isScanning]);

  useEffect(() => {
    if (bracelet?.connected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [bracelet?.connected]);

  // Имитация BLE-сканирования (в реальном приложении будет react-native-ble-plx)
  const handleScan = () => {
    setIsScanning(true);
    setFoundDevices([]);

    // Симуляция нахождения устройств
    setTimeout(() => {
      setFoundDevices([
        { id: 'BB-V1-001A', name: 'BusBell Bracelet', rssi: -45 },
      ]);
    }, 2000);

    setTimeout(() => {
      setIsScanning(false);
    }, 4000);
  };

  const handleConnect = (device: BraceletDevice) => {
    setIsScanning(false);
    setConnectedDevice(device);

    // Симуляция подключения
    setTimeout(() => {
      setBracelet({
        connected: true,
        batteryLevel: 78,
        firmwareVersion: '1.0.0',
        vibrationLevel: 2,
        vibrationPattern: 1,
      });
    }, 1500);
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Отключить браслет?',
      'Оповещения будут приходить только на телефон',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Отключить', style: 'destructive', onPress: () => {
          setBracelet(null);
          setConnectedDevice(null);
          setFoundDevices([]);
        }},
      ]
    );
  };

  const handleSetVibrationLevel = (level: number) => {
    if (bracelet) {
      setBracelet({ ...bracelet, vibrationLevel: level });
      // TODO: отправить BLE-команду на браслет
    }
  };

  const handleSetVibrationPattern = (pattern: number) => {
    if (bracelet) {
      setBracelet({ ...bracelet, vibrationPattern: pattern });
    }
  };

  const handleTestVibration = () => {
    Alert.alert('Тест вибрации', 'Команда отправлена на браслет');
    // TODO: BLE write 0xBB01
  };

  const handleSyncTime = () => {
    Alert.alert('Синхронизация', 'Время синхронизировано с телефоном');
    // TODO: BLE write 0xBB05
  };

  const getBatteryIcon = (level: number) => {
    if (level > 75) return '🔋';
    if (level > 40) return '🔋';
    if (level > 15) return '🪫';
    return '🪫';
  };

  const getBatteryColor = (level: number) => {
    if (level > 40) return '#4CAF50';
    if (level > 15) return '#FF9800';
    return '#F44336';
  };

  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border },
  };

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top']}>
      <View style={[styles.header, dynamicStyles.border]}>
        <Text style={[styles.title, dynamicStyles.text]}>⌚ Аксессуары</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Состояние подключения */}
        {bracelet?.connected ? (
          // === ПОДКЛЮЧЕНО ===
          <>
            {/* Device card */}
            <Animated.View style={[styles.deviceCard, { borderColor: '#4CAF50', transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.deviceCardHeader}>
                <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={[styles.deviceCardTitle, dynamicStyles.text]}>
                  {connectedDevice?.name || 'BusBell Bracelet'}
                </Text>
              </View>
              <Text style={[styles.deviceCardId, dynamicStyles.textSecondary]}>
                ID: {connectedDevice?.id}
              </Text>

              {/* Battery */}
              <View style={styles.batteryRow}>
                <Text style={styles.batteryIcon}>{getBatteryIcon(bracelet.batteryLevel)}</Text>
                <View style={styles.batteryBarBg}>
                  <View style={[styles.batteryBarFill, {
                    width: `${bracelet.batteryLevel}%`,
                    backgroundColor: getBatteryColor(bracelet.batteryLevel),
                  }]} />
                </View>
                <Text style={[styles.batteryText, { color: getBatteryColor(bracelet.batteryLevel) }]}>
                  {bracelet.batteryLevel}%
                </Text>
              </View>

              <Text style={[styles.firmwareText, dynamicStyles.textSecondary]}>
                Прошивка: v{bracelet.firmwareVersion}
              </Text>
            </Animated.View>

            {/* Vibration level */}
            <Text style={[styles.sectionTitle, dynamicStyles.textSecondary]}>Сила вибрации</Text>
            <View style={styles.optionsList}>
              {VIBRATION_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.id}
                  style={[
                    styles.optionCard,
                    dynamicStyles.card,
                    bracelet.vibrationLevel === level.id && styles.optionCardActive,
                  ]}
                  onPress={() => handleSetVibrationLevel(level.id)}
                >
                  <Text style={styles.optionIcon}>{level.icon}</Text>
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionName, dynamicStyles.text]}>{level.name}</Text>
                    <Text style={[styles.optionDesc, dynamicStyles.textSecondary]}>{level.desc}</Text>
                  </View>
                  {bracelet.vibrationLevel === level.id && (
                    <Text style={styles.checkIcon}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Vibration pattern */}
            <Text style={[styles.sectionTitle, dynamicStyles.textSecondary]}>Паттерн вибрации</Text>
            <View style={styles.optionsList}>
              {VIBRATION_PATTERNS.map((pattern) => (
                <TouchableOpacity
                  key={pattern.id}
                  style={[
                    styles.optionCard,
                    dynamicStyles.card,
                    bracelet.vibrationPattern === pattern.id && styles.optionCardActive,
                  ]}
                  onPress={() => handleSetVibrationPattern(pattern.id)}
                >
                  <Text style={styles.patternIcon}>{pattern.icon}</Text>
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionName, dynamicStyles.text]}>{pattern.name}</Text>
                    <Text style={[styles.optionDesc, dynamicStyles.textSecondary]}>{pattern.desc}</Text>
                  </View>
                  {bracelet.vibrationPattern === pattern.id && (
                    <Text style={styles.checkIcon}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Actions */}
            <Text style={[styles.sectionTitle, dynamicStyles.textSecondary]}>Действия</Text>

            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#FF6B35' }]} onPress={handleTestVibration}>
              <Text style={styles.actionIcon}>📳</Text>
              <Text style={styles.actionText}>Тестовая вибрация</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#457B9D' }]} onPress={handleSyncTime}>
              <Text style={styles.actionIcon}>🕐</Text>
              <Text style={styles.actionText}>Синхронизировать время</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#E63946' }]} onPress={handleDisconnect}>
              <Text style={styles.actionIcon}>🔌</Text>
              <Text style={styles.actionText}>Отключить браслет</Text>
            </TouchableOpacity>

            {/* Info */}
            <View style={[styles.infoBox, dynamicStyles.card]}>
              <Text style={styles.infoIcon}>💡</Text>
              <Text style={[styles.infoText, dynamicStyles.textSecondary]}>
                Когда браслет подключён, оповещения приходят вибрацией на браслет вместо звука на телефоне. 
                Если браслет отключится, оповещения автоматически вернутся на телефон.
              </Text>
            </View>
          </>
        ) : (
          // === НЕ ПОДКЛЮЧЕНО ===
          <>
            {/* Hero section */}
            <View style={styles.heroSection}>
              <Text style={styles.heroIcon}>⌚</Text>
              <Text style={[styles.heroTitle, dynamicStyles.text]}>BusBell Bracelet</Text>
              <Text style={[styles.heroSubtitle, dynamicStyles.textSecondary]}>
                Бесшумное пробуждение на вашей остановке
              </Text>
            </View>

            {/* Features */}
            <View style={styles.featuresGrid}>
              {[
                { icon: '📳', title: 'Мощная вибрация', desc: '3 уровня силы' },
                { icon: '🔇', title: 'Бесшумно', desc: 'Не мешает окружающим' },
                { icon: '🕐', title: 'Часы', desc: 'Время на дисплее' },
                { icon: '🔋', title: '5-7 дней', desc: 'Без подзарядки' },
              ].map((f, i) => (
                <View key={i} style={[styles.featureCard, dynamicStyles.card]}>
                  <Text style={styles.featureIcon}>{f.icon}</Text>
                  <Text style={[styles.featureTitle, dynamicStyles.text]}>{f.title}</Text>
                  <Text style={[styles.featureDesc, dynamicStyles.textSecondary]}>{f.desc}</Text>
                </View>
              ))}
            </View>

            {/* Scan button */}
            <TouchableOpacity
              style={[styles.scanButton, isScanning && styles.scanButtonActive]}
              onPress={handleScan}
              disabled={isScanning}
            >
              {isScanning ? (
                <Animated.View style={{ opacity: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }}>
                  <ActivityIndicator color="#fff" size="small" />
                </Animated.View>
              ) : (
                <Text style={styles.scanButtonIcon}>📡</Text>
              )}
              <Text style={styles.scanButtonText}>
                {isScanning ? 'Поиск устройств...' : 'Найти браслет'}
              </Text>
            </TouchableOpacity>

            {/* Found devices */}
            {foundDevices.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, dynamicStyles.textSecondary]}>
                  Найденные устройства
                </Text>
                {foundDevices.map((device) => (
                  <TouchableOpacity
                    key={device.id}
                    style={[styles.foundDevice, dynamicStyles.card]}
                    onPress={() => handleConnect(device)}
                  >
                    <View style={styles.foundDeviceIcon}>
                      <Text style={styles.foundDeviceEmoji}>⌚</Text>
                    </View>
                    <View style={styles.foundDeviceInfo}>
                      <Text style={[styles.foundDeviceName, dynamicStyles.text]}>{device.name}</Text>
                      <Text style={[styles.foundDeviceId, dynamicStyles.textSecondary]}>
                        {device.id} • Сигнал: {device.rssi > -50 ? 'отличный' : device.rssi > -70 ? 'хороший' : 'слабый'}
                      </Text>
                    </View>
                    <View style={styles.connectBtn}>
                      <Text style={styles.connectBtnText}>Подключить</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Connection in progress */}
            {connectedDevice && !bracelet?.connected && (
              <View style={styles.connectingBox}>
                <ActivityIndicator color="#FF6B35" />
                <Text style={[styles.connectingText, dynamicStyles.text]}>
                  Подключение к {connectedDevice.name}...
                </Text>
              </View>
            )}

            {/* No bracelet hint */}
            {!isScanning && foundDevices.length === 0 && !connectedDevice && (
              <View style={[styles.infoBox, dynamicStyles.card]}>
                <Text style={styles.infoIcon}>ℹ️</Text>
                <Text style={[styles.infoText, dynamicStyles.textSecondary]}>
                  Убедитесь, что браслет включён и находится рядом. Нажмите кнопку на браслете для активации режима сопряжения.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 28, fontWeight: '700' },
  content: { flex: 1, padding: 16 },

  // Hero
  heroSection: { alignItems: 'center', paddingVertical: 30 },
  heroIcon: { fontSize: 64, marginBottom: 12 },
  heroTitle: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  heroSubtitle: { fontSize: 14, textAlign: 'center' },

  // Features grid
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  featureCard: { width: '48%', flexGrow: 1, padding: 16, borderRadius: 14, alignItems: 'center' },
  featureIcon: { fontSize: 28, marginBottom: 8 },
  featureTitle: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  featureDesc: { fontSize: 11 },

  // Scan
  scanButton: { backgroundColor: '#FF6B35', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 16, gap: 10, marginBottom: 20 },
  scanButtonActive: { backgroundColor: '#CC5529' },
  scanButtonIcon: { fontSize: 22 },
  scanButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },

  // Found devices
  foundDevice: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, marginBottom: 10 },
  foundDeviceIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,107,53,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  foundDeviceEmoji: { fontSize: 24 },
  foundDeviceInfo: { flex: 1 },
  foundDeviceName: { fontSize: 15, fontWeight: '600' },
  foundDeviceId: { fontSize: 11, marginTop: 2 },
  connectBtn: { backgroundColor: '#FF6B35', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  connectBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Connecting
  connectingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  connectingText: { fontSize: 15 },

  // Connected device card
  deviceCard: { borderWidth: 2, borderRadius: 16, padding: 20, marginBottom: 24 },
  deviceCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  deviceCardTitle: { fontSize: 18, fontWeight: '700' },
  deviceCardId: { fontSize: 12, marginBottom: 14 },
  batteryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  batteryIcon: { fontSize: 20 },
  batteryBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
  batteryBarFill: { height: 8, borderRadius: 4 },
  batteryText: { fontSize: 14, fontWeight: '600', minWidth: 40 },
  firmwareText: { fontSize: 12 },

  // Options
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 4 },
  optionsList: { marginBottom: 20 },
  optionCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 8 },
  optionCardActive: { borderWidth: 2, borderColor: '#FF6B35' },
  optionIcon: { fontSize: 18, marginRight: 12, minWidth: 50 },
  patternIcon: { fontSize: 14, marginRight: 12, minWidth: 50, fontFamily: 'monospace', color: '#FF6B35' },
  optionInfo: { flex: 1 },
  optionName: { fontSize: 14, fontWeight: '600' },
  optionDesc: { fontSize: 11, marginTop: 2 },
  checkIcon: { fontSize: 18, color: '#FF6B35', fontWeight: '700', marginLeft: 8 },

  // Actions
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 14, marginBottom: 10, gap: 10 },
  actionIcon: { fontSize: 20 },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Info box
  infoBox: { flexDirection: 'row', padding: 16, borderRadius: 14, marginTop: 16, marginBottom: 20 },
  infoIcon: { fontSize: 20, marginRight: 10 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
