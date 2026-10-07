# Bus Bell

Умные напоминания для общественного транспорта: приложение будит, когда вы подъезжаете к своей остановке.

## Что в репозитории

| Папка | Что это |
|---|---|
| `index.html` (корень) | Веб-версия: одна страница на React + Яндекс.Карты |
| `app/` | Мобильное приложение Bus Bell 2.0 на React Native / Expo (Android-сборка в APK) |

## Мобильное приложение (`app/`)

Expo SDK 50, React Native 0.73, TypeScript, zustand + AsyncStorage.

Возможности: карта с остановками и маршрутами из OpenStreetMap (Overpass API), поиск маршрута по номеру,
напоминания с радиусом и звуком, фоновое отслеживание геолокации, режим будильника, избранное, тёмная и светлая тема.

### Запуск для разработки

```bash
cd app
npm install
npx expo start
```

### Сборка APK

Проект привязан к EAS (Expo), `projectId` указан в `app/app.json`.

```bash
npm install -g eas-cli
cd app
eas login
eas build -p android --profile preview     # APK для установки на телефон
eas build -p android --profile production  # AAB для Google Play
```

Готовые сборки лежат на expo.dev → проект **busbell** → Builds.
