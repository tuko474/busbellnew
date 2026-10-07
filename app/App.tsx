import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, Modal } from 'react-native';
import * as Notifications from 'expo-notifications';

import HomeScreen from './src/screens/HomeScreen';
import RemindersScreen from './src/screens/RemindersScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AccessoriesScreen from './src/screens/AccessoriesScreen';
import AlarmScreen from './src/screens/AlarmScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { useAppStore, THEMES } from './src/store/appStore';
import { useLocationTracking } from './src/hooks/useLocationTracking';
import { setupAudio } from './src/services/soundService';
import {
  setupNotificationChannels,
  setupNotificationCategories,
  DISMISS_ACTION_ID,
} from './src/services/alarmNotifications';

const Tab = createBottomTabNavigator();

// Настройка уведомлений, когда приложение открыто. В режиме будильника
// звук уже играет сам будильник — не накладываем на него звук уведомления.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { alarmMode?: boolean } | undefined;
    return {
      shouldShowAlert: true,
      shouldPlaySound: !data?.alarmMode,
      shouldSetBadge: false,
    };
  },
});

function MainApp() {
  const { theme, activeAlarm, setActiveAlarm, hasSeenOnboarding, setHasSeenOnboarding } = useAppStore();
  // Единственное место, где отслеживание включается/выключается автоматически
  const { dismissAlarm } = useLocationTracking({ autoStart: true });
  const colors = THEMES[theme];

  // Уведомление «Вы на месте!»: кнопка «Отключить» глушит будильник,
  // нажатие на само уведомление открывает экран будильника
  useEffect(() => {
    const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier === DISMISS_ACTION_ID) {
        dismissAlarm();
        return;
      }
      const data = response.notification.request.content.data as
        | { reminderId?: string; alarmMode?: boolean }
        | undefined;
      if (!data?.reminderId || !data.alarmMode) return;
      const state = useAppStore.getState();
      if (state.activeAlarm) return;
      const reminder = state.reminders.find((r) => r.id === data.reminderId);
      if (reminder) state.setActiveAlarm(reminder);
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    return () => subscription.remove();
  }, [dismissAlarm]);

  const handleDismissAlarm = () => {
    dismissAlarm();
    setActiveAlarm(null);
  };

  const handleOnboardingComplete = () => {
    setHasSeenOnboarding(true);
  };

  // Показываем онбординг при первом запуске
  if (!hasSeenOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  return (
    <>
      <NavigationContainer
        theme={{
          dark: theme === 'dark',
          colors: {
            primary: colors.accent,
            background: colors.background,
            card: colors.card,
            text: colors.text,
            border: colors.border,
            notification: colors.accent,
          },
        }}
      >
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
            },
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.textSecondary,
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              tabBarLabel: 'Карта',
              tabBarIcon: () => <Text style={{ fontSize: 20 }}>📍</Text>,
            }}
          />
          <Tab.Screen
            name="Reminders"
            component={RemindersScreen}
            options={{
              tabBarLabel: 'Напоминания',
              tabBarIcon: () => <Text style={{ fontSize: 20 }}>🔔</Text>,
            }}
          />
          <Tab.Screen
            name="Accessories"
            component={AccessoriesScreen}
            options={{
              tabBarLabel: 'Аксессуары',
              tabBarIcon: () => <Text style={{ fontSize: 20 }}>⌚</Text>,
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              tabBarLabel: 'Настройки',
              tabBarIcon: () => <Text style={{ fontSize: 20 }}>⚙️</Text>,
            }}
          />
        </Tab.Navigator>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      </NavigationContainer>

      {/* Модальный экран будильника */}
      <Modal
        visible={activeAlarm !== null}
        animationType="fade"
        statusBarTranslucent
      >
        {activeAlarm && (
          <AlarmScreen reminder={activeAlarm} onDismiss={handleDismissAlarm} />
        )}
      </Modal>
    </>
  );
}

export default function App() {
  useEffect(() => {
    const requestPermissions = async () => {
      await setupNotificationChannels();
      await setupNotificationCategories();
      await Notifications.requestPermissionsAsync();
      await setupAudio();
    };
    requestPermissions();
  }, []);

  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}
