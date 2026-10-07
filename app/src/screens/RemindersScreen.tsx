import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useAppStore,
  TRANSPORT_CONFIG,
  SOUND_OPTIONS,
  Reminder,
  THEMES,
  TransportType,
  SoundType,
} from '../store/appStore';

export default function RemindersScreen() {
  const {
    reminders,
    updateReminder,
    deleteReminder,
    resetReminder,
    toggleFavoriteReminder,
    theme,
  } = useAppStore();
  const colors = THEMES[theme];

  // Edit modal state
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [editName, setEditName] = useState('');
  const [editRadius, setEditRadius] = useState(200);
  const [editSound, setEditSound] = useState<SoundType>('bell');
  const [editType, setEditType] = useState<TransportType>('bus');

  // Sorting: favorites first, then by date
  const sortedReminders = [...reminders].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const activeReminders = sortedReminders.filter((r) => !r.triggered);
  const triggeredReminders = sortedReminders.filter((r) => r.triggered);
  const favoriteActive = activeReminders.filter((r) => r.favorite);
  const nonFavoriteActive = activeReminders.filter((r) => !r.favorite);

  const handleDelete = (reminder: Reminder) => {
    Alert.alert(
      'Удалить напоминание?',
      `"${reminder.name}" будет удалено`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: () => deleteReminder(reminder.id) },
      ]
    );
  };

  const handleToggle = (reminder: Reminder) => {
    updateReminder(reminder.id, { enabled: !reminder.enabled });
  };

  const handleReset = (reminder: Reminder) => {
    resetReminder(reminder.id);
  };

  const handleToggleFavorite = (reminder: Reminder) => {
    toggleFavoriteReminder(reminder.id);
  };

  const handleOpenEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setEditName(reminder.name);
    setEditRadius(reminder.radius);
    setEditSound(reminder.sound);
    setEditType(reminder.type);
  };

  const handleSaveEdit = () => {
    if (!editingReminder || !editName.trim()) return;
    updateReminder(editingReminder.id, {
      name: editName.trim(),
      radius: editRadius,
      sound: editSound,
      type: editType,
    });
    setEditingReminder(null);
  };

  const handleCancelEdit = () => {
    setEditingReminder(null);
  };

  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    border: { borderColor: colors.border },
  };

  const renderReminder = (reminder: Reminder, isTriggered: boolean = false) => {
    const config = TRANSPORT_CONFIG[reminder.type];
    const soundInfo = SOUND_OPTIONS.find((s) => s.id === reminder.sound) || SOUND_OPTIONS[0];

    return (
      <View key={reminder.id} style={[styles.card, isTriggered && styles.cardTriggered]}>
        {/* Favorite star */}
        <TouchableOpacity
          style={styles.favoriteBtn}
          onPress={() => handleToggleFavorite(reminder)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.favoriteStar}>
            {reminder.favorite ? '⭐' : '☆'}
          </Text>
        </TouchableOpacity>

        <View style={[styles.icon, { backgroundColor: `${config.color}30` }]}>
          <Text style={styles.iconText}>{config.icon}</Text>
        </View>

        {/* Tap to edit */}
        <TouchableOpacity
          style={styles.info}
          onPress={() => handleOpenEdit(reminder)}
          activeOpacity={0.7}
        >
          <View style={styles.nameRow}>
            <Text style={[styles.name, dynamicStyles.text]} numberOfLines={1}>
              {reminder.name}
            </Text>
            <Text style={styles.editHint}>✏️</Text>
          </View>
          <Text style={[styles.details, dynamicStyles.textSecondary]}>
            {config.label} • {reminder.radius}м • {soundInfo.icon} {soundInfo.name}
          </Text>
          {isTriggered && (
            <TouchableOpacity onPress={() => handleReset(reminder)}>
              <Text style={styles.resetButton}>↻ Активировать снова</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {!isTriggered && (
          <Switch
            value={reminder.enabled}
            onValueChange={() => handleToggle(reminder)}
            trackColor={{ false: '#555', true: `${config.color}80` }}
            thumbColor={reminder.enabled ? config.color : '#888'}
          />
        )}

        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(reminder)}>
          <Text style={styles.deleteBtnText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const editTransportColor = TRANSPORT_CONFIG[editType]?.color || '#FF6B35';

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top']}>
      <View style={[styles.header, dynamicStyles.border]}>
        <Text style={[styles.title, dynamicStyles.text]}>🔔 Напоминания</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Favorites section */}
        {favoriteActive.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, dynamicStyles.textSecondary]}>
              ⭐ Избранные ({favoriteActive.length})
            </Text>
            {favoriteActive.map((r) => renderReminder(r))}
          </>
        )}

        {/* Active non-favorite */}
        <Text style={[styles.sectionTitle, dynamicStyles.textSecondary, favoriteActive.length > 0 && { marginTop: 20 }]}>
          Активные ({activeReminders.length})
        </Text>

        {activeReminders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={[styles.emptyText, dynamicStyles.textSecondary]}>Нет активных напоминаний</Text>
            <Text style={[styles.emptyHint, dynamicStyles.textSecondary]}>
              Выберите остановку на карте или найдите через поиск
            </Text>
          </View>
        ) : (
          nonFavoriteActive.map((r) => renderReminder(r))
        )}

        {/* Triggered */}
        {triggeredReminders.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }, dynamicStyles.textSecondary]}>
              Сработавшие ({triggeredReminders.length})
            </Text>
            {triggeredReminders.map((r) => renderReminder(r, true))}
          </>
        )}

        {/* Hint */}
        {reminders.length > 0 && (
          <View style={styles.hint}>
            <Text style={[styles.hintText, dynamicStyles.textSecondary]}>
              💡 Нажмите на напоминание для редактирования
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editingReminder !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Редактирование</Text>
              <TouchableOpacity onPress={handleCancelEdit}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Favorite toggle in edit */}
            {editingReminder && (
              <TouchableOpacity
                style={styles.favoriteRow}
                onPress={() => {
                  handleToggleFavorite(editingReminder);
                  setEditingReminder({ ...editingReminder, favorite: !editingReminder.favorite });
                }}
              >
                <Text style={styles.favoriteRowIcon}>
                  {editingReminder.favorite ? '⭐' : '☆'}
                </Text>
                <Text style={[styles.favoriteRowText, dynamicStyles.text]}>
                  {editingReminder.favorite ? 'В избранном' : 'Добавить в избранное'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Name */}
            <Text style={[styles.inputLabel, dynamicStyles.textSecondary]}>Название</Text>
            <TextInput
              style={[styles.textInput, dynamicStyles.text, { borderColor: colors.border }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Название напоминания"
              placeholderTextColor={colors.textSecondary}
            />

            {/* Transport type */}
            <Text style={[styles.inputLabel, dynamicStyles.textSecondary]}>Тип транспорта</Text>
            <View style={styles.transportRow}>
              {(['bus', 'metro', 'railway'] as TransportType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.transportBtn,
                    editType === type && { backgroundColor: TRANSPORT_CONFIG[type].color },
                  ]}
                  onPress={() => setEditType(type)}
                >
                  <Text style={styles.transportIcon}>{TRANSPORT_CONFIG[type].icon}</Text>
                  <Text style={styles.transportLabel}>{TRANSPORT_CONFIG[type].label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Radius */}
            <Text style={[styles.inputLabel, dynamicStyles.textSecondary]}>
              Радиус: {editRadius}м
            </Text>
            <View style={styles.radiusButtons}>
              {[100, 150, 200, 300, 500].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.radiusButton,
                    editRadius === r && { backgroundColor: editTransportColor },
                  ]}
                  onPress={() => setEditRadius(r)}
                >
                  <Text style={styles.radiusButtonText}>{r}м</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sound */}
            <Text style={[styles.inputLabel, dynamicStyles.textSecondary]}>Оповещение</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.soundOptions}>
                {SOUND_OPTIONS.map((sound) => (
                  <TouchableOpacity
                    key={sound.id}
                    style={[
                      styles.soundButton,
                      editSound === sound.id && {
                        borderColor: editTransportColor,
                        backgroundColor: `${editTransportColor}30`,
                      },
                    ]}
                    onPress={() => setEditSound(sound.id)}
                  >
                    <Text style={styles.soundIcon}>{sound.icon}</Text>
                    <Text style={[styles.soundName, dynamicStyles.textSecondary]}>
                      {sound.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={handleCancelEdit}
              >
                <Text style={[styles.cancelButtonText, dynamicStyles.text]}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  { backgroundColor: editName.trim() ? editTransportColor : '#555' },
                ]}
                onPress={handleSaveEdit}
                disabled={!editName.trim()}
              >
                <Text style={styles.confirmButtonText}>Сохранить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 28, fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12, opacity: 0.5 },
  emptyText: { fontSize: 16, marginBottom: 4 },
  emptyHint: { fontSize: 12, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardTriggered: { opacity: 0.6 },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: { fontSize: 22 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '600', marginBottom: 4, flexShrink: 1 },
  editHint: { fontSize: 12, opacity: 0.5 },
  details: { fontSize: 12 },
  resetButton: { fontSize: 12, color: '#FF6B35', marginTop: 6, fontWeight: '500' },
  favoriteBtn: { marginRight: 8, padding: 2 },
  favoriteStar: { fontSize: 20 },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239,83,80,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteBtnText: { fontSize: 16 },
  hint: { alignItems: 'center', padding: 20 },
  hintText: { fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  closeButton: { fontSize: 24, padding: 4, color: '#888' },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  favoriteRowIcon: { fontSize: 24, marginRight: 10 },
  favoriteRowText: { fontSize: 15 },
  inputLabel: { fontSize: 13, marginBottom: 8 },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 20,
    borderWidth: 1,
  },
  transportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 20,
  },
  transportBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  transportIcon: { fontSize: 22, marginBottom: 2 },
  transportLabel: { fontSize: 11, color: '#fff' },
  radiusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  radiusButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  radiusButtonText: { color: '#fff', fontSize: 13 },
  soundOptions: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  soundButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 75,
  },
  soundIcon: { fontSize: 24, marginBottom: 4 },
  soundName: { fontSize: 10 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 15 },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
