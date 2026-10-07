import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TransportType = 'bus' | 'metro' | 'railway';
export type SoundType = 'vibrate' | 'bell' | 'alarm';
export type ThemeType = 'dark' | 'light';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface TransportStop {
  id: string;
  name: string;
  location: Location;
  type: TransportType;
  routes?: string[];
}

export interface Reminder {
  id: string;
  name: string;
  location: Location;
  radius: number;
  type: TransportType;
  sound: SoundType;
  enabled: boolean;
  triggered: boolean;
  favorite: boolean;
  stopId?: string;
  createdAt: string;
}

interface AppState {
  // Местоположение
  currentLocation: Location | null;
  setCurrentLocation: (location: Location | null) => void;
  
  // Город
  currentCity: string;
  setCurrentCity: (city: string) => void;
  
  // Тип транспорта
  activeTransportType: TransportType;
  setActiveTransportType: (type: TransportType) => void;
  
  // Напоминания
  reminders: Reminder[];
  addReminder: (reminder: Omit<Reminder, 'id' | 'createdAt' | 'favorite'>) => void;
  updateReminder: (id: string, updates: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
  triggerReminder: (id: string) => void;
  resetReminder: (id: string) => void;
  toggleFavoriteReminder: (id: string) => void;
  
  // Остановки (кэш)
  stops: {
    bus: TransportStop[];
    metro: TransportStop[];
    railway: TransportStop[];
  };
  setStops: (type: TransportType, stops: TransportStop[]) => void;
  
  // Избранные остановки
  favoriteStops: TransportStop[];
  addFavorite: (stop: TransportStop) => void;
  removeFavorite: (stopId: string) => void;
  isFavorite: (stopId: string) => boolean;
  
  // Отслеживание
  isTracking: boolean;
  setIsTracking: (value: boolean) => void;
  
  // Активный будильник
  activeAlarm: Reminder | null;
  setActiveAlarm: (reminder: Reminder | null) => void;
  
  // Тема
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  
  // Онбординг
  hasSeenOnboarding: boolean;
  setHasSeenOnboarding: (value: boolean) => void;
  
  // Настройки
  settings: {
    backgroundTracking: boolean;
    vibration: boolean;
    defaultRadius: number;
    defaultSound: SoundType;
    alarmMode: boolean; // Режим будильника
  };
  updateSettings: (updates: Partial<AppState['settings']>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Местоположение
      currentLocation: null,
      setCurrentLocation: (location) => set({ currentLocation: location }),
      
      // Город
      currentCity: 'Определение...',
      setCurrentCity: (city) => set({ currentCity: city }),
      
      // Тип транспорта
      activeTransportType: 'bus',
      setActiveTransportType: (type) => set({ activeTransportType: type }),
      
      // Напоминания
      reminders: [],
      addReminder: (reminder) => {
        const newReminder: Reminder = {
          ...reminder,
          id: Date.now().toString(),
          favorite: false,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ reminders: [...state.reminders, newReminder] }));
      },
      updateReminder: (id, updates) => {
        set((state) => ({
          reminders: state.reminders.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }));
      },
      deleteReminder: (id) => {
        set((state) => ({
          reminders: state.reminders.filter((r) => r.id !== id),
        }));
      },
      triggerReminder: (id) => {
        set((state) => ({
          reminders: state.reminders.map((r) =>
            r.id === id ? { ...r, triggered: true } : r
          ),
        }));
      },
      resetReminder: (id) => {
        set((state) => ({
          reminders: state.reminders.map((r) =>
            r.id === id ? { ...r, triggered: false } : r
          ),
        }));
      },
      toggleFavoriteReminder: (id) => {
        set((state) => ({
          reminders: state.reminders.map((r) =>
            r.id === id ? { ...r, favorite: !r.favorite } : r
          ),
        }));
      },
      
      // Остановки
      stops: {
        bus: [],
        metro: [],
        railway: [],
      },
      setStops: (type, stops) => {
        set((state) => ({
          stops: { ...state.stops, [type]: stops },
        }));
      },
      
      // Избранные
      favoriteStops: [],
      addFavorite: (stop) => {
        set((state) => {
          if (state.favoriteStops.some((s) => s.id === stop.id)) {
            return state;
          }
          return { favoriteStops: [...state.favoriteStops, stop] };
        });
      },
      removeFavorite: (stopId) => {
        set((state) => ({
          favoriteStops: state.favoriteStops.filter((s) => s.id !== stopId),
        }));
      },
      isFavorite: (stopId) => {
        return get().favoriteStops.some((s) => s.id === stopId);
      },
      
      // Отслеживание
      isTracking: false,
      setIsTracking: (value) => set({ isTracking: value }),
      
      // Будильник
      activeAlarm: null,
      setActiveAlarm: (reminder) => set({ activeAlarm: reminder }),
      
      // Тема
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      
      // Онбординг
      hasSeenOnboarding: false,
      setHasSeenOnboarding: (value) => set({ hasSeenOnboarding: value }),
      
      // Настройки
      settings: {
        backgroundTracking: true,
        vibration: true,
        defaultRadius: 200,
        defaultSound: 'bell',
        alarmMode: true,
      },
      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },
    }),
    {
      name: 'busbell-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        reminders: state.reminders,
        favoriteStops: state.favoriteStops,
        settings: state.settings,
        currentCity: state.currentCity,
        theme: state.theme,
        hasSeenOnboarding: state.hasSeenOnboarding,
      }),
    }
  )
);

export const TRANSPORT_CONFIG = {
  bus: { label: 'Автобус', color: '#FF6B35', icon: '🚌' },
  metro: { label: 'Метро', color: '#E63946', icon: '🚇' },
  railway: { label: 'Ж/Д', color: '#457B9D', icon: '🚆' },
};

export const SOUND_OPTIONS = [
  { id: 'vibrate' as SoundType, name: 'Вибрация', icon: '📳' },
  { id: 'bell' as SoundType, name: 'Колокольчик', icon: '🔔' },
  { id: 'alarm' as SoundType, name: 'Сигнал', icon: '🔊' },
];

// Полный список городов России
export const RUSSIAN_CITIES = [
  { name: 'Москва', latitude: 55.7558, longitude: 37.6173 },
  { name: 'Санкт-Петербург', latitude: 59.9343, longitude: 30.3351 },
  { name: 'Новосибирск', latitude: 55.0084, longitude: 82.9357 },
  { name: 'Екатеринбург', latitude: 56.8389, longitude: 60.6057 },
  { name: 'Казань', latitude: 55.7887, longitude: 49.1221 },
  { name: 'Нижний Новгород', latitude: 56.2965, longitude: 43.9361 },
  { name: 'Челябинск', latitude: 55.1644, longitude: 61.4368 },
  { name: 'Самара', latitude: 53.1959, longitude: 50.1002 },
  { name: 'Омск', latitude: 54.9885, longitude: 73.3242 },
  { name: 'Ростов-на-Дону', latitude: 47.2357, longitude: 39.7015 },
  { name: 'Уфа', latitude: 54.7388, longitude: 55.9721 },
  { name: 'Красноярск', latitude: 56.0153, longitude: 92.8932 },
  { name: 'Воронеж', latitude: 51.6720, longitude: 39.1843 },
  { name: 'Пермь', latitude: 58.0105, longitude: 56.2502 },
  { name: 'Волгоград', latitude: 48.7080, longitude: 44.5133 },
  { name: 'Краснодар', latitude: 45.0355, longitude: 38.9753 },
  { name: 'Саратов', latitude: 51.5924, longitude: 45.9601 },
  { name: 'Тюмень', latitude: 57.1522, longitude: 65.5272 },
  { name: 'Тольятти', latitude: 53.5303, longitude: 49.3461 },
  { name: 'Ижевск', latitude: 56.8527, longitude: 53.2114 },
  { name: 'Барнаул', latitude: 53.3548, longitude: 83.7698 },
  { name: 'Ульяновск', latitude: 54.3142, longitude: 48.4031 },
  { name: 'Иркутск', latitude: 52.2978, longitude: 104.2964 },
  { name: 'Хабаровск', latitude: 48.4827, longitude: 135.0838 },
  { name: 'Ярославль', latitude: 57.6261, longitude: 39.8845 },
  { name: 'Владивосток', latitude: 43.1332, longitude: 131.9113 },
  { name: 'Махачкала', latitude: 42.9849, longitude: 47.5047 },
  { name: 'Томск', latitude: 56.4884, longitude: 84.9480 },
  { name: 'Оренбург', latitude: 51.7727, longitude: 55.0988 },
  { name: 'Кемерово', latitude: 55.3908, longitude: 86.0779 },
  { name: 'Новокузнецк', latitude: 53.7596, longitude: 87.1216 },
  { name: 'Рязань', latitude: 54.6269, longitude: 39.6916 },
  { name: 'Астрахань', latitude: 46.3497, longitude: 48.0408 },
  { name: 'Набережные Челны', latitude: 55.7431, longitude: 52.3959 },
  { name: 'Пенза', latitude: 53.1959, longitude: 45.0183 },
  { name: 'Липецк', latitude: 52.6031, longitude: 39.5708 },
  { name: 'Киров', latitude: 58.5966, longitude: 49.6601 },
  { name: 'Чебоксары', latitude: 56.1322, longitude: 47.2519 },
  { name: 'Тула', latitude: 54.1961, longitude: 37.6182 },
  { name: 'Калининград', latitude: 54.7104, longitude: 20.4522 },
  { name: 'Курск', latitude: 51.7373, longitude: 36.1874 },
  { name: 'Сочи', latitude: 43.5855, longitude: 39.7231 },
  { name: 'Ставрополь', latitude: 45.0428, longitude: 41.9734 },
  { name: 'Улан-Удэ', latitude: 51.8335, longitude: 107.5842 },
  { name: 'Тверь', latitude: 56.8587, longitude: 35.9176 },
  { name: 'Магнитогорск', latitude: 53.4072, longitude: 58.9801 },
  { name: 'Брянск', latitude: 53.2521, longitude: 34.3717 },
  { name: 'Иваново', latitude: 57.0004, longitude: 40.9739 },
  { name: 'Белгород', latitude: 50.5997, longitude: 36.5986 },
  { name: 'Сургут', latitude: 61.2500, longitude: 73.4167 },
];

// Функция определения города по координатам
export const detectCity = (location: Location): string => {
  let closestCity = RUSSIAN_CITIES[0];
  let minDistance = Infinity;

  for (const city of RUSSIAN_CITIES) {
    const distance = Math.sqrt(
      Math.pow(location.latitude - city.latitude, 2) +
      Math.pow(location.longitude - city.longitude, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestCity = city;
    }
  }

  // Примерно 1 градус = 111 км, если расстояние > ~0.9 (100 км), то "Россия"
  return minDistance < 0.9 ? closestCity.name : 'Россия';
};

// Цвета темы
export const THEMES = {
  dark: {
    background: '#1a1a2e',
    card: '#16213e',
    text: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.6)',
    border: 'rgba(255,255,255,0.1)',
    accent: '#FF6B35',
  },
  light: {
    background: '#f5f5f5',
    card: '#ffffff',
    text: '#1a1a2e',
    textSecondary: 'rgba(0,0,0,0.6)',
    border: 'rgba(0,0,0,0.1)',
    accent: '#FF6B35',
  },
};
