import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Animated,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useAppStore,
  TRANSPORT_CONFIG,
  SOUND_OPTIONS,
  RUSSIAN_CITIES,
  TransportType,
  SoundType,
  TransportStop,
  Location,
  detectCity,
  THEMES,
} from '../store/appStore';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { fetchTransportStops, searchRoutes, RouteResult } from '../services/stopsService';

const getMapHTML = (lat: number, lon: number, isDark: boolean) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://api-maps.yandex.ru/2.1/?apikey=43bcf47b-c9da-4b7e-8336-ac41095908e6&lang=ru_RU"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    let map, currentPlacemark, selectedPlacemark;
    const stopPlacemarks = [];
    const reminderCircles = {};
    let routeLine = null;
    const routeStopPlacemarks = [];
    
    ymaps.ready(function() {
      map = new ymaps.Map('map', {
        center: [${lat}, ${lon}],
        zoom: 15,
        controls: ['zoomControl']
      });
      
      currentPlacemark = new ymaps.Placemark([${lat}, ${lon}], {
        hintContent: 'Вы здесь'
      }, {
        preset: 'islands#greenCircleDotIcon'
      });
      map.geoObjects.add(currentPlacemark);
      
      map.events.add('click', function(e) {
        const coords = e.get('coords');
        if (selectedPlacemark) {
          selectedPlacemark.geometry.setCoordinates(coords);
        } else {
          selectedPlacemark = new ymaps.Placemark(coords, {}, {
            preset: 'islands#redCircleDotIcon',
            draggable: true
          });
          map.geoObjects.add(selectedPlacemark);
        }
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'pointSelected', lat: coords[0], lon: coords[1]
        }));
      });
      
      map.events.add('boundschange', function(e) {
        const center = map.getCenter();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'mapMoved', lat: center[0], lon: center[1], zoom: map.getZoom()
        }));
      });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
    });
    
    function setCenter(lat, lon, zoom) {
      if (map) map.setCenter([lat, lon], zoom || 15, { duration: 300 });
    }
    function updateLocation(lat, lon) {
      if (currentPlacemark) currentPlacemark.geometry.setCoordinates([lat, lon]);
    }
    function clearSelected() {
      if (selectedPlacemark) { map.geoObjects.remove(selectedPlacemark); selectedPlacemark = null; }
    }
    function clearStops() {
      stopPlacemarks.forEach(p => map.geoObjects.remove(p));
      stopPlacemarks.length = 0;
    }
    function addStops(stopsJson, color) {
      clearStops();
      const stops = JSON.parse(stopsJson);
      stops.forEach(stop => {
        const placemark = new ymaps.Placemark([stop.lat, stop.lon], {
          hintContent: stop.name, balloonContent: stop.name
        }, { preset: 'islands#dotIcon', iconColor: color });
        placemark.events.add('click', function(e) {
          e.stopPropagation();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stopSelected', stop: stop }));
        });
        map.geoObjects.add(placemark);
        stopPlacemarks.push(placemark);
      });
    }
    function addReminderCircle(id, lat, lon, radius, color) {
      if (reminderCircles[id]) map.geoObjects.remove(reminderCircles[id]);
      const circle = new ymaps.Circle([[lat, lon], radius], {}, {
        fillColor: color + '40', strokeColor: color, strokeWidth: 2
      });
      map.geoObjects.add(circle);
      reminderCircles[id] = circle;
    }
    function removeReminderCircle(id) {
      if (reminderCircles[id]) { map.geoObjects.remove(reminderCircles[id]); delete reminderCircles[id]; }
    }
    function selectStop(lat, lon) {
      if (selectedPlacemark) {
        selectedPlacemark.geometry.setCoordinates([lat, lon]);
      } else {
        selectedPlacemark = new ymaps.Placemark([lat, lon], {}, {
          preset: 'islands#redCircleDotIcon', draggable: true
        });
        map.geoObjects.add(selectedPlacemark);
      }
      map.setCenter([lat, lon], 16, { duration: 300 });
    }

    // === МАРШРУТЫ ===
    function clearRoute() {
      if (routeLine) { map.geoObjects.remove(routeLine); routeLine = null; }
      routeStopPlacemarks.forEach(p => map.geoObjects.remove(p));
      routeStopPlacemarks.length = 0;
    }

    function drawRoute(pathJson, stopsJson, color, favoriteIdsJson) {
      clearRoute();
      const path = JSON.parse(pathJson);
      const stops = JSON.parse(stopsJson);
      const favoriteIds = JSON.parse(favoriteIdsJson);
      const favSet = new Set(favoriteIds);

      // Полилиния маршрута
      if (path.length > 1) {
        const coords = path.map(function(p) { return [p.lat, p.lon]; });
        routeLine = new ymaps.Polyline(coords, {}, {
          strokeColor: color,
          strokeWidth: 4,
          strokeOpacity: 0.8
        });
        map.geoObjects.add(routeLine);
      }

      // Остановки маршрута
      stops.forEach(function(stop) {
        var isFav = favSet.has(stop.id);
        var stopColor = isFav ? '#FFD700' : color;
        var preset = isFav ? 'islands#yellowCircleDotIcon' : 'islands#circleDotIcon';
        var placemark = new ymaps.Placemark([stop.lat, stop.lon], {
          hintContent: stop.name + (isFav ? ' ⭐' : ''),
          balloonContent: stop.name
        }, {
          preset: preset,
          iconColor: stopColor
        });
        placemark.events.add('click', function(e) {
          e.stopPropagation();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stopSelected', stop: stop }));
        });
        map.geoObjects.add(placemark);
        routeStopPlacemarks.push(placemark);
      });

      // Подогнать камеру под маршрут
      if (path.length > 1) {
        var bounds = routeLine.geometry.getBounds();
        if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 40, duration: 400 });
      }
    }
  </script>
</body>
</html>
`;

export default function HomeScreen() {
  const {
    currentCity,
    setCurrentCity,
    activeTransportType,
    setActiveTransportType,
    reminders,
    addReminder,
    settings,
    stops,
    setStops,
    favoriteStops,
    addFavorite,
    removeFavorite,
    theme,
  } = useAppStore();

  const { currentLocation, getCurrentLocation } = useLocationTracking();
  const colors = THEMES[theme];

  const webViewRef = useRef<WebView>(null);
  const [selectedPoint, setSelectedPoint] = useState<{latitude: number; longitude: number} | null>(null);
  const [selectedStop, setSelectedStop] = useState<TransportStop | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reminderName, setReminderName] = useState('');
  const [reminderRadius, setReminderRadius] = useState(settings.defaultRadius);
  const [reminderSound, setReminderSound] = useState<SoundType>(settings.defaultSound);
  const [mapReady, setMapReady] = useState(false);
  const [isLoadingStops, setIsLoadingStops] = useState(false);
  const [mapCenter, setMapCenter] = useState<Location | null>(null);

  // Поиск маршрутов
  const [searchResults, setSearchResults] = useState<RouteResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);

  const tabAnimation = useRef(new Animated.Value(0)).current;

  // Загрузка остановок при смене типа транспорта
  const loadStops = useCallback(async (type: TransportType, center: Location) => {
    setIsLoadingStops(true);
    try {
      const loadedStops = await fetchTransportStops(type, center, 3);
      setStops(type, loadedStops);
      if (webViewRef.current && mapReady) {
        const stopsForMap = loadedStops.map(s => ({
          id: s.id, name: s.name, lat: s.location.latitude, lon: s.location.longitude,
        }));
        const color = TRANSPORT_CONFIG[type].color;
        webViewRef.current.injectJavaScript(
          `addStops('${JSON.stringify(stopsForMap).replace(/'/g, "\\'")}', '${color}'); true;`
        );
      }
    } catch (error) {
      console.error('Error loading stops:', error);
    }
    setIsLoadingStops(false);
  }, [setStops, mapReady]);

  // При смене типа транспорта
  useEffect(() => {
    const center = mapCenter || currentLocation;
    if (center && mapReady) {
      Animated.sequence([
        Animated.timing(tabAnimation, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(tabAnimation, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
      // Убрать маршрут при смене вкладки
      setActiveRoute(null);
      sendToMap('clearRoute()');
      loadStops(activeTransportType, center);
    }
  }, [activeTransportType, mapReady]);

  useEffect(() => {
    if (currentLocation) {
      const city = detectCity(currentLocation);
      setCurrentCity(city);
    }
  }, [currentLocation]);

  const sendToMap = useCallback((code: string) => {
    if (webViewRef.current && mapReady) {
      webViewRef.current.injectJavaScript(code + '; true;');
    }
  }, [mapReady]);

  useEffect(() => {
    if (currentLocation && mapReady) {
      sendToMap(`updateLocation(${currentLocation.latitude}, ${currentLocation.longitude})`);
    }
  }, [currentLocation, mapReady]);

  // Круги напоминаний
  useEffect(() => {
    if (mapReady) {
      reminders.forEach((r) => {
        if (r.enabled && !r.triggered) {
          const color = TRANSPORT_CONFIG[r.type].color;
          sendToMap(`addReminderCircle('${r.id}', ${r.location.latitude}, ${r.location.longitude}, ${r.radius}, '${color}')`);
        } else {
          sendToMap(`removeReminderCircle('${r.id}')`);
        }
      });
    }
  }, [reminders, mapReady]);

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'mapReady':
          setMapReady(true);
          if (currentLocation) loadStops(activeTransportType, currentLocation);
          break;
        case 'pointSelected':
          setSelectedPoint({ latitude: data.lat, longitude: data.lon });
          setSelectedStop(null);
          setReminderName('');
          break;
        case 'stopSelected':
          const stop = data.stop;
          setSelectedPoint({ latitude: stop.lat, longitude: stop.lon });
          setSelectedStop({
            id: stop.id, name: stop.name,
            location: { latitude: stop.lat, longitude: stop.lon },
            type: activeTransportType,
          });
          setReminderName(stop.name);
          break;
        case 'mapMoved':
          setMapCenter({ latitude: data.lat, longitude: data.lon });
          break;
      }
    } catch (e) {}
  };

  const centerOnLocation = async () => {
    if (currentLocation) {
      sendToMap(`setCenter(${currentLocation.latitude}, ${currentLocation.longitude}, 15)`);
      loadStops(activeTransportType, currentLocation);
    } else {
      const loc = await getCurrentLocation();
      if (loc) {
        sendToMap(`setCenter(${loc.latitude}, ${loc.longitude}, 15)`);
        loadStops(activeTransportType, loc);
      }
    }
  };

  const handleCreateReminder = () => {
    if (!selectedPoint || !reminderName) return;
    addReminder({
      name: reminderName, location: selectedPoint, radius: reminderRadius,
      type: activeTransportType, sound: reminderSound, enabled: true,
      triggered: false, stopId: selectedStop?.id,
    });
    setShowCreateModal(false);
    setSelectedPoint(null);
    setSelectedStop(null);
    setReminderName('');
    sendToMap('clearSelected()');
  };

  const handleCitySelect = (city: typeof RUSSIAN_CITIES[0]) => {
    sendToMap(`setCenter(${city.latitude}, ${city.longitude}, 13)`);
    setCurrentCity(city.name);
    setShowCityPicker(false);
    setActiveRoute(null);
    sendToMap('clearRoute()');
    loadStops(activeTransportType, { latitude: city.latitude, longitude: city.longitude });
  };

  // === ПОИСК МАРШРУТОВ ===
  const handleSearchRoutes = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    const center = mapCenter || currentLocation;
    if (!center) return;

    setIsSearching(true);
    try {
      const results = await searchRoutes(query, activeTransportType, center);
      setSearchResults(results);
    } catch (error) {
      console.error('Route search error:', error);
    }
    setIsSearching(false);
  };

  const handleSelectRoute = (route: RouteResult) => {
    setActiveRoute(route);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);

    // ID избранных остановок
    const favIds = favoriteStops.map((s) => s.id);

    // Данные для карты
    const pathForMap = route.path.map((p) => ({ lat: p.latitude, lon: p.longitude }));
    const stopsForMap = route.stops.map((s) => ({
      id: s.id, name: s.name, lat: s.location.latitude, lon: s.location.longitude,
    }));
    const color = TRANSPORT_CONFIG[activeTransportType].color;

    const pathJson = JSON.stringify(pathForMap).replace(/'/g, "\\'");
    const stopsJson = JSON.stringify(stopsForMap).replace(/'/g, "\\'");
    const favJson = JSON.stringify(favIds).replace(/'/g, "\\'");

    sendToMap(`drawRoute('${pathJson}', '${stopsJson}', '${color}', '${favJson}')`);
  };

  const handleClearRoute = () => {
    setActiveRoute(null);
    sendToMap('clearRoute()');
    const center = mapCenter || currentLocation;
    if (center) loadStops(activeTransportType, center);
  };

  const handleStopSelect = (stop: TransportStop) => {
    setSelectedPoint(stop.location);
    setSelectedStop(stop);
    setReminderName(stop.name);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    sendToMap(`selectStop(${stop.location.latitude}, ${stop.location.longitude})`);
  };

  const handleToggleFavorite = (stop: TransportStop) => {
    if (favoriteStops.some(s => s.id === stop.id)) {
      removeFavorite(stop.id);
    } else {
      addFavorite(stop);
    }
  };

  const transportColor = TRANSPORT_CONFIG[activeTransportType].color;
  const initialLat = currentLocation?.latitude || 55.7558;
  const initialLon = currentLocation?.longitude || 37.6173;

  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    card: { backgroundColor: colors.card },
  };

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>BB</Text>
            </View>
            <View style={styles.bellBadge}>
              <Text style={styles.bellIcon}>🔔</Text>
            </View>
          </View>
          <View>
            <Text style={[styles.title, dynamicStyles.text]}>Bus Bell</Text>
            <Text style={[styles.subtitle, dynamicStyles.textSecondary]}>Умные напоминания</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.searchButton} onPress={() => setShowSearch(true)}>
            <Text style={styles.searchIcon}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cityButton} onPress={() => setShowCityPicker(true)}>
            <Text style={[styles.cityName, dynamicStyles.text]}>📍 {currentCity}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active route banner */}
      {activeRoute && (
        <View style={[styles.routeBanner, { backgroundColor: `${transportColor}20`, borderColor: transportColor }]}>
          <View style={styles.routeBannerInfo}>
            <Text style={[styles.routeBannerRef, { color: transportColor }]}>
              {TRANSPORT_CONFIG[activeTransportType].icon} №{activeRoute.ref}
            </Text>
            <Text style={[styles.routeBannerName, dynamicStyles.textSecondary]} numberOfLines={1}>
              {activeRoute.from && activeRoute.to ? `${activeRoute.from} → ${activeRoute.to}` : activeRoute.name}
            </Text>
            <Text style={[styles.routeBannerStops, dynamicStyles.textSecondary]}>
              {activeRoute.stops.length} остановок
            </Text>
          </View>
          <TouchableOpacity style={styles.routeBannerClose} onPress={handleClearRoute}>
            <Text style={styles.routeBannerCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: getMapHTML(initialLat, initialLon, theme === 'dark') }}
          style={styles.map}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={[styles.loadingContainer, dynamicStyles.container]}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, dynamicStyles.text]}>Загрузка карты...</Text>
            </View>
          )}
        />
        <View style={styles.mapButtons}>
          <TouchableOpacity style={[styles.mapButton, dynamicStyles.card]} onPress={centerOnLocation}>
            <Text style={styles.mapButtonIcon}>📍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mapButton, dynamicStyles.card]}
            onPress={() => mapCenter && loadStops(activeTransportType, mapCenter)}
          >
            <Text style={styles.mapButtonIcon}>🔄</Text>
          </TouchableOpacity>
        </View>
        {isLoadingStops && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={transportColor} />
            <Text style={styles.loadingOverlayText}>Загрузка остановок...</Text>
          </View>
        )}
      </View>

      {/* Create reminder button */}
      {selectedPoint && (
        <Animated.View style={{ transform: [{ scale: tabAnimation.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] }) }] }}>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: transportColor }]}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.createButtonText}>
              🔔 {selectedStop ? `Напоминание: ${selectedStop.name}` : 'Создать напоминание'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Transport tabs */}
      <View style={styles.tabs}>
        {(['bus', 'metro', 'railway'] as TransportType[]).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.tab, dynamicStyles.card,
              activeTransportType === type && { backgroundColor: TRANSPORT_CONFIG[type].color }
            ]}
            onPress={() => setActiveTransportType(type)}
          >
            <Text style={styles.tabIcon}>{TRANSPORT_CONFIG[type].icon}</Text>
            <Text style={[styles.tabLabel, dynamicStyles.text]}>{TRANSPORT_CONFIG[type].label}</Text>
            {stops[type].length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{stops[type].length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Create reminder modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.card]}>
            <Text style={[styles.modalTitle, dynamicStyles.text]}>Новое напоминание</Text>
            {selectedStop && (
              <TouchableOpacity style={styles.favoriteButton} onPress={() => handleToggleFavorite(selectedStop)}>
                <Text style={styles.favoriteIcon}>
                  {favoriteStops.some(s => s.id === selectedStop.id) ? '⭐' : '☆'}
                </Text>
                <Text style={[styles.favoriteText, dynamicStyles.text]}>
                  {favoriteStops.some(s => s.id === selectedStop.id) ? 'В избранном' : 'Добавить в избранное'}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.inputLabel, dynamicStyles.textSecondary]}>Название</Text>
            <TextInput
              style={[styles.textInput, dynamicStyles.text, { borderColor: colors.border }]}
              value={reminderName} onChangeText={setReminderName}
              placeholder="Моя остановка" placeholderTextColor={colors.textSecondary}
            />
            <Text style={[styles.inputLabel, dynamicStyles.textSecondary]}>Радиус: {reminderRadius}м</Text>
            <View style={styles.radiusButtons}>
              {[100, 150, 200, 300, 500].map((r) => (
                <TouchableOpacity key={r}
                  style={[styles.radiusButton, reminderRadius === r && { backgroundColor: transportColor }]}
                  onPress={() => setReminderRadius(r)}
                >
                  <Text style={styles.radiusButtonText}>{r}м</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.inputLabel, dynamicStyles.textSecondary]}>Оповещение</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.soundOptions}>
                {SOUND_OPTIONS.map((sound) => (
                  <TouchableOpacity key={sound.id}
                    style={[styles.soundButton,
                      reminderSound === sound.id && { borderColor: transportColor, backgroundColor: `${transportColor}30` }
                    ]}
                    onPress={() => setReminderSound(sound.id)}
                  >
                    <Text style={styles.soundIcon}>{sound.icon}</Text>
                    <Text style={[styles.soundName, dynamicStyles.textSecondary]}>{sound.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => { setShowCreateModal(false); setSelectedPoint(null); setSelectedStop(null); sendToMap('clearSelected()'); }}
              >
                <Text style={[styles.cancelButtonText, dynamicStyles.text]}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: reminderName ? transportColor : '#555' }]}
                onPress={handleCreateReminder} disabled={!reminderName}
              >
                <Text style={styles.confirmButtonText}>Создать</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Search modal — МАРШРУТЫ */}
      <Modal visible={showSearch} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.card, { maxHeight: '85%' }]}>
            <View style={styles.searchHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>
                {TRANSPORT_CONFIG[activeTransportType].icon} Поиск маршрута
              </Text>
              <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <TextInput
                style={[styles.searchInput, dynamicStyles.text, { borderColor: colors.border, flex: 1 }]}
                value={searchQuery} onChangeText={setSearchQuery}
                placeholder={`Номер маршрута (напр. 28)...`}
                placeholderTextColor={colors.textSecondary}
                keyboardType="default" autoFocus
                onSubmitEditing={handleSearchRoutes}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={[styles.searchBtn, { backgroundColor: transportColor }]}
                onPress={handleSearchRoutes}
              >
                <Text style={styles.searchBtnText}>🔍</Text>
              </TouchableOpacity>
            </View>

            {/* Loading */}
            {isSearching && (
              <View style={styles.searchLoading}>
                <ActivityIndicator size="small" color={transportColor} />
                <Text style={[styles.searchLoadingText, dynamicStyles.textSecondary]}>
                  Поиск маршрута {searchQuery}...
                </Text>
              </View>
            )}

            {/* Results */}
            {!isSearching && searchResults.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, dynamicStyles.textSecondary]}>
                  Найдено маршрутов: {searchResults.length}
                </Text>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.routeItem, { borderColor: colors.border }]}
                      onPress={() => handleSelectRoute(item)}
                    >
                      <View style={[styles.routeRefBadge, { backgroundColor: transportColor }]}>
                        <Text style={styles.routeRefText}>{item.ref}</Text>
                      </View>
                      <View style={styles.routeInfo}>
                        <Text style={[styles.routeName, dynamicStyles.text]} numberOfLines={2}>
                          {item.from && item.to ? `${item.from} → ${item.to}` : item.name}
                        </Text>
                        <Text style={[styles.routeDetails, dynamicStyles.textSecondary]}>
                          {item.stops.length} остановок • {item.path.length > 0 ? `${(item.path.length / 100).toFixed(0)}+ точек` : 'нет пути'}
                        </Text>
                      </View>
                      <Text style={styles.routeArrow}>→</Text>
                    </TouchableOpacity>
                  )}
                />
              </>
            )}

            {/* No results */}
            {!isSearching && searchResults.length === 0 && searchQuery.trim() !== '' && (
              <View style={styles.emptySearch}>
                <Text style={styles.emptySearchIcon}>🔍</Text>
                <Text style={[styles.emptySearchText, dynamicStyles.textSecondary]}>
                  Маршрут «{searchQuery}» не найден
                </Text>
                <Text style={[styles.emptySearchHint, dynamicStyles.textSecondary]}>
                  Попробуйте другой номер или переключите тип транспорта
                </Text>
              </View>
            )}

            {/* Favorites */}
            {favoriteStops.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, dynamicStyles.textSecondary, { marginTop: 16 }]}>
                  ⭐ Избранные остановки
                </Text>
                {favoriteStops.map((stop) => (
                  <TouchableOpacity key={stop.id}
                    style={[styles.stopItem, { borderColor: colors.border }]}
                    onPress={() => handleStopSelect(stop)}
                  >
                    <Text style={styles.stopIcon}>{TRANSPORT_CONFIG[stop.type].icon}</Text>
                    <View style={styles.stopInfo}>
                      <Text style={[styles.stopName, dynamicStyles.text]}>{stop.name}</Text>
                      <Text style={[styles.stopType, dynamicStyles.textSecondary]}>{TRANSPORT_CONFIG[stop.type].label}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeFavorite(stop.id)}>
                      <Text style={styles.removeIcon}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* City picker */}
      <Modal visible={showCityPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.card, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Выберите город</Text>
              <TouchableOpacity onPress={() => setShowCityPicker(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {RUSSIAN_CITIES.map((city) => (
                <TouchableOpacity key={city.name}
                  style={[styles.cityItem, currentCity === city.name && styles.cityItemActive]}
                  onPress={() => handleCitySelect(city)}
                >
                  <Text style={[styles.cityItemText, dynamicStyles.text]}>{city.name}</Text>
                  {currentCity === city.name && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  logoSection: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoContainer: { position: 'relative' },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFB74D', justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },
  bellBadge: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  bellIcon: { fontSize: 10 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  searchIcon: { fontSize: 18 },
  cityButton: { backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  cityName: { fontSize: 14 },

  // Route banner
  routeBanner: { marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
  routeBannerInfo: { flex: 1 },
  routeBannerRef: { fontSize: 16, fontWeight: '700' },
  routeBannerName: { fontSize: 13, marginTop: 2 },
  routeBannerStops: { fontSize: 11, marginTop: 2 },
  routeBannerClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  routeBannerCloseText: { fontSize: 16, color: '#888' },

  mapContainer: { flex: 1, margin: 16, borderRadius: 16, overflow: 'hidden' },
  map: { flex: 1 },
  loadingContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12 },
  mapButtons: { position: 'absolute', right: 16, bottom: 16, gap: 8 },
  mapButton: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  mapButtonIcon: { fontSize: 20 },
  loadingOverlay: { position: 'absolute', top: 16, left: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  loadingOverlayText: { color: '#fff', marginLeft: 8, fontSize: 12 },
  createButton: { marginHorizontal: 16, marginBottom: 8, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: 12, padding: 16 },
  tab: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, minWidth: 90, position: 'relative' },
  tabIcon: { fontSize: 24, marginBottom: 4 },
  tabLabel: { fontSize: 12 },
  tabBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#FF6B35', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  closeButton: { fontSize: 24, padding: 4 },
  inputLabel: { fontSize: 13, marginBottom: 8 },
  textInput: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 20, borderWidth: 1 },

  // Search
  searchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  searchInput: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1 },
  searchBtn: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  searchBtnText: { fontSize: 20 },
  searchLoading: { alignItems: 'center', padding: 30, gap: 10 },
  searchLoadingText: { fontSize: 14 },
  emptySearch: { alignItems: 'center', padding: 30 },
  emptySearchIcon: { fontSize: 40, marginBottom: 10, opacity: 0.5 },
  emptySearchText: { fontSize: 15, textAlign: 'center', marginBottom: 4 },
  emptySearchHint: { fontSize: 12, textAlign: 'center' },

  // Route items
  routeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  routeRefBadge: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  routeRefText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  routeInfo: { flex: 1 },
  routeName: { fontSize: 14, fontWeight: '500' },
  routeDetails: { fontSize: 11, marginTop: 3 },
  routeArrow: { fontSize: 20, color: '#888', marginLeft: 8 },

  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12, marginTop: 8 },

  // Stop items
  stopItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  stopIcon: { fontSize: 24, marginRight: 12 },
  stopInfo: { flex: 1 },
  stopName: { fontSize: 15, fontWeight: '500' },
  stopType: { fontSize: 12, marginTop: 2 },
  removeIcon: { fontSize: 18, color: '#888', padding: 4 },

  favoriteButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 },
  favoriteIcon: { fontSize: 24, marginRight: 8 },
  favoriteText: { fontSize: 14 },
  radiusButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  radiusButton: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' },
  radiusButtonText: { color: '#fff', fontSize: 13 },
  soundOptions: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  soundButton: { alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', minWidth: 75 },
  soundIcon: { fontSize: 24, marginBottom: 4 },
  soundName: { fontSize: 10 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  cancelButtonText: { fontSize: 15 },
  confirmButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cityItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  cityItemActive: { backgroundColor: 'rgba(255,107,53,0.2)' },
  cityItemText: { fontSize: 16 },
  checkmark: { fontSize: 18, color: '#FF6B35' },
});
