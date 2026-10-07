import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAppStore, SOUND_OPTIONS, THEMES } from '../store/appStore';

export default function SettingsScreen() {
  const { 
    settings, 
    updateSettings, 
    reminders, 
    isTracking, 
    theme, 
    setTheme,
    favoriteStops,
  } = useAppStore();
  
  const colors = THEMES[theme];

  const handleClearAll = () => {
    Alert.alert(
      'Удалить все напоминания?',
      `Будет удалено ${reminders.length} напоминаний`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: () => useAppStore.setState({ reminders: [] }) },
      ]
    );
  };

  const handleClearFavorites = () => {
    Alert.alert(
      'Очистить избранное?',
      `Будет удалено ${favoriteStops.length} остановок`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Очистить', style: 'destructive', onPress: () => useAppStore.setState({ favoriteStops: [] }) },
      ]
    );
  };

  const testVibration = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const testAlarm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 500);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 1000);
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
        <Text style={[styles.title, dynamicStyles.text]}>Настройки</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Тема */}
        <View style={[styles.section, dynamicStyles.border]}>
          <Text style={styles.sectionTitle}>ОФОРМЛЕНИЕ</Text>
          
          <View style={styles.themeSelector}>
            <TouchableOpacity
              style={[
                styles.themeOption,
                theme === 'dark' && styles.themeOptionActive
              ]}
              onPress={() => setTheme('dark')}
            >
              <Text style={styles.themeIcon}>🌙</Text>
              <Text style={[styles.themeLabel, dynamicStyles.text]}>Тёмная</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.themeOption,
                theme === 'light' && styles.themeOptionActive
              ]}
              onPress={() => setTheme('light')}
            >
              <Text style={styles.themeIcon}>☀️</Text>
              <Text style={[styles.themeLabel, dynamicStyles.text]}>Светлая</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Отслеживание */}
        <View style={[styles.section, dynamicStyles.border]}>
          <Text style={styles.sectionTitle}>ОТСЛЕЖИВАНИЕ</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, dynamicStyles.text]}>Фоновое отслеживание</Text>
              <Text style={[styles.settingDescription, dynamicStyles.textSecondary]}>
                Отслеживать когда приложение свёрнуто
              </Text>
            </View>
            <Switch
              value={settings.backgroundTracking}
              onValueChange={(value) => updateSettings({ backgroundTracking: value })}
              trackColor={{ false: '#555', true: '#FF6B3580' }}
              thumbColor={settings.backgroundTracking ? '#FF6B35' : '#888'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, dynamicStyles.text]}>Вибрация</Text>
              <Text style={[styles.settingDescription, dynamicStyles.textSecondary]}>
                Вибрировать при срабатывании
              </Text>
            </View>
            <Switch
              value={settings.vibration}
              onValueChange={(value) => updateSettings({ vibration: value })}
              trackColor={{ false: '#555', true: '#FF6B3580' }}
              thumbColor={settings.vibration ? '#FF6B35' : '#888'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, dynamicStyles.text]}>Режим будильника ⏰</Text>
              <Text style={[styles.settingDescription, dynamicStyles.textSecondary]}>
                Звонить и вибрировать пока не отключите
              </Text>
            </View>
            <Switch
              value={settings.alarmMode}
              onValueChange={(value) => updateSettings({ alarmMode: value })}
              trackColor={{ false: '#555', true: '#FF6B3580' }}
              thumbColor={settings.alarmMode ? '#FF6B35' : '#888'}
            />
          </View>

          <View style={styles.testButtons}>
            <TouchableOpacity style={styles.testButton} onPress={testVibration}>
              <Text style={styles.testButtonText}>📳 Тест вибрации</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.testButton} onPress={testAlarm}>
              <Text style={styles.testButtonText}>⏰ Тест будильника</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, isTracking && styles.statusDotActive]} />
            <Text style={[styles.statusText, dynamicStyles.textSecondary]}>
              {isTracking ? 'Отслеживание активно' : 'Отслеживание неактивно'}
            </Text>
          </View>
        </View>

        {/* По умолчанию */}
        <View style={[styles.section, dynamicStyles.border]}>
          <Text style={styles.sectionTitle}>ПО УМОЛЧАНИЮ</Text>

          <Text style={[styles.settingLabel, dynamicStyles.text]}>Радиус срабатывания</Text>
          <View style={styles.options}>
            {[100, 150, 200, 300, 500].map((radius) => (
              <TouchableOpacity
                key={radius}
                style={[styles.option, settings.defaultRadius === radius && styles.optionActive]}
                onPress={() => updateSettings({ defaultRadius: radius })}
              >
                <Text style={[styles.optionText, settings.defaultRadius === radius && styles.optionTextActive]}>
                  {radius}м
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.settingLabel, { marginTop: 20 }, dynamicStyles.text]}>Оповещение</Text>
          <View style={styles.options}>
            {SOUND_OPTIONS.map((sound) => (
              <TouchableOpacity
                key={sound.id}
                style={[styles.soundOption, settings.defaultSound === sound.id && styles.optionActive]}
                onPress={() => updateSettings({ defaultSound: sound.id })}
              >
                <Text style={styles.soundIcon}>{sound.icon}</Text>
                <Text style={[styles.soundName, dynamicStyles.textSecondary]}>{sound.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Данные */}
        <View style={[styles.section, dynamicStyles.border]}>
          <Text style={styles.sectionTitle}>ДАННЫЕ</Text>
          
          <TouchableOpacity style={styles.dangerButton} onPress={handleClearAll}>
            <Text style={styles.dangerButtonText}>🗑️ Удалить все напоминания ({reminders.length})</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.dangerButton, { marginTop: 10 }]} onPress={handleClearFavorites}>
            <Text style={styles.dangerButtonText}>⭐ Очистить избранное ({favoriteStops.length})</Text>
          </TouchableOpacity>
        </View>

        {/* О приложении */}
        <View style={styles.about}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>BB</Text>
          </View>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeIcon}>🔔</Text>
          </View>
          <Text style={[styles.appName, dynamicStyles.text]}>Bus Bell</Text>
          <Text style={[styles.version, dynamicStyles.textSecondary]}>Версия 2.0.0</Text>
          <Text style={[styles.description, dynamicStyles.textSecondary]}>
            Умные напоминания для общественного транспорта.{'\n'}
            Никогда не пропустите свою остановку!
          </Text>
          <Text style={[styles.footer, dynamicStyles.textSecondary]}>Сделано с ❤️ в России</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 28, fontWeight: '700' },
  content: { flex: 1 },
  section: { padding: 20, borderBottomWidth: 1 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#FF6B35', marginBottom: 16, letterSpacing: 1 },
  themeSelector: { flexDirection: 'row', gap: 12 },
  themeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  themeOptionActive: { backgroundColor: '#FF6B35' },
  themeIcon: { fontSize: 24 },
  themeLabel: { fontSize: 15, fontWeight: '500' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  settingInfo: { flex: 1, marginRight: 16 },
  settingLabel: { fontSize: 15, fontWeight: '500', marginBottom: 4 },
  settingDescription: { fontSize: 12 },
  testButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  testButton: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  testButtonText: { color: '#fff', fontSize: 13 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#666', marginRight: 8 },
  statusDotActive: { backgroundColor: '#4CAF50' },
  statusText: { fontSize: 13 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  option: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  optionActive: { backgroundColor: '#FF6B35' },
  optionText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  optionTextActive: { color: '#fff' },
  soundOption: { alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', minWidth: 70 },
  soundIcon: { fontSize: 24, marginBottom: 4 },
  soundName: { fontSize: 10 },
  dangerButton: { backgroundColor: 'rgba(239,83,80,0.15)', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12 },
  dangerButtonText: { color: '#EF5350', fontSize: 15, textAlign: 'center' },
  about: { alignItems: 'center', padding: 40, position: 'relative' },
  logo: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#FFB74D', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoText: { fontSize: 32, fontWeight: '800', color: '#1a1a2e' },
  logoBadge: { position: 'absolute', top: 28, right: '50%', marginRight: -55, width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  logoBadgeIcon: { fontSize: 14 },
  appName: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  version: { fontSize: 14, marginBottom: 12 },
  description: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  footer: { marginTop: 20, fontSize: 12 },
});
