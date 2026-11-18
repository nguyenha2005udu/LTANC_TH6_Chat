import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChat } from '../ChatContext';
import { s } from './styles';
import { errorMessage } from '../services/firebase';
import { pickImage } from '../services/uploadService';
import {
  avatarThumb,
  updateAvatar,
  updateName,
} from '../services/profileService';

function failMessage(e: unknown) {
  return (e as { code?: string }).code ? errorMessage(e) : (e as Error).message;
}

function ProfileField({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.field, !last && styles.fieldBorder]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text selectable style={styles.fieldValue}>
        {value}
      </Text>
    </View>
  );
}

export default function SettingScreen() {
  const { logout, account, displayName, uid, users } = useChat();
  const avatar = users[uid]?.avatar;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const saveName = async () => {
    setSavingName(true);
    try {
      await updateName(name);
      setEditing(false);
    } catch (e) {
      Alert.alert('Không đổi được họ tên', failMessage(e));
    } finally {
      setSavingName(false);
    }
  };
  const changePhoto = (source: 'camera' | 'library') => {
    pickImage(source)
      .then(async image => {
        if (!image) {
          return;
        }
        setUploading(true);
        try {
          await updateAvatar(image);
        } finally {
          setUploading(false);
        }
      })
      .catch(e => Alert.alert('Không đổi được ảnh', failMessage(e)));
  };
  const askPhoto = () =>
    Alert.alert('Ảnh đại diện', undefined, [
      { text: 'Chụp ảnh', onPress: () => changePhoto('camera') },
      { text: 'Chọn từ thư viện', onPress: () => changePhoto('library') },
      { text: 'Hủy', style: 'cancel' },
    ]);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)
    ? account
    : 'Chưa cập nhật';
  return (
    <SafeAreaView style={s.page} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={s.brandSmall}>UDU CHAT</Text>
          <Text style={s.heading}>Hồ sơ cá nhân</Text>
          <Text style={styles.subtitle}>Thông tin của bạn trên UDU Chat</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.cover} />
          <View style={styles.profileBody}>
            <Pressable
              style={styles.avatarRing}
              onPress={askPhoto}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel="Đổi ảnh đại diện"
            >
              <Image
                source={
                  avatar
                    ? { uri: avatarThumb(avatar, 240) }
                    : require('../assets/avatar-1.png')
                }
                style={styles.avatar}
                accessibilityLabel="Ảnh đại diện cá nhân"
              />
              {uploading && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#FFF" />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Text style={styles.cameraText}>📷</Text>
              </View>
            </Pressable>
            {editing ? (
              <View style={styles.nameEdit}>
                <TextInput
                  style={[s.input, s.flex]}
                  value={name}
                  onChangeText={setName}
                  maxLength={100}
                  autoFocus
                  accessibilityLabel="Họ tên mới"
                />
                <Pressable
                  style={[styles.save, savingName && s.disabled]}
                  disabled={savingName}
                  onPress={saveName}
                  accessibilityRole="button"
                  accessibilityLabel="Lưu họ tên"
                >
                  <Text style={s.buttonText}>Lưu</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setName(displayName);
                  setEditing(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Đổi họ tên"
              >
                <Text style={styles.displayName}>{displayName} ✎</Text>
              </Pressable>
            )}
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Đang hoạt động</Text>
            </View>
            <Text style={styles.bio}>Một lời chào, mở ra ngàn câu chuyện.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
        <View style={styles.infoCard}>
          <ProfileField label="Tài khoản" value={account} />
          <ProfileField label="Email" value={email} />
          <ProfileField label="Số điện thoại" value="Chưa cập nhật" />
          <ProfileField label="Ngày sinh" value="Chưa cập nhật" last />
        </View>

        <Text style={styles.sectionTitle}>Giới thiệu</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutText}>
            Chào mừng bạn đến với UDU Chat. Kết nối với bạn bè và chia sẻ những
            câu chuyện mỗi ngày.
          </Text>
          <Text style={styles.demoNote}>
            Nhấn vào ảnh để đổi ảnh đại diện, nhấn vào tên để đổi họ tên. Thay
            đổi hiện ngay ở Danh bạ, Home và các cuộc trò chuyện.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          accessibilityRole="button"
          accessibilityLabel="Đăng xuất từ cài đặt"
          onPress={() =>
            Alert.alert('Đăng xuất?', 'Bạn muốn kết thúc phiên đăng nhập?', [
              { text: 'Hủy', style: 'cancel' },
              {
                text: 'Đăng xuất',
                style: 'destructive',
                onPress: () => {
                  logout().catch(e => Alert.alert('Lỗi', errorMessage(e)));
                },
              },
            ])
          }
        >
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
        <Text style={styles.version}>UDU Chat · Phiên bản 1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 32 },
  header: { marginBottom: 24 },
  subtitle: { fontSize: 14, color: '#7E8297', marginTop: 8 },
  profileCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EAEBF2',
  },
  cover: { height: 84, backgroundColor: '#E8E3FC' },
  profileBody: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  avatarRing: {
    marginTop: -44,
    padding: 5,
    backgroundColor: '#FFF',
    borderRadius: 52,
  },
  avatar: { width: 86, height: 86, borderRadius: 43 },
  avatarOverlay: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(20, 20, 40, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EAEBF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraText: { fontSize: 14 },
  nameEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    alignSelf: 'stretch',
  },
  save: {
    backgroundColor: '#6658E8',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#242439',
    marginTop: 14,
    textAlign: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EAF7F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#25845F',
  },
  statusText: { color: '#25845F', fontSize: 12, fontWeight: '600' },
  bio: {
    color: '#7E8297',
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#242439',
    marginTop: 26,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#EAEBF2',
  },
  field: { paddingVertical: 16 },
  fieldBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F1F6' },
  fieldLabel: { fontSize: 12, color: '#7E8297', marginBottom: 7 },
  fieldValue: {
    fontSize: 15,
    color: '#34364F',
    fontWeight: '500',
    lineHeight: 22,
  },
  aboutCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAEBF2',
  },
  aboutText: { color: '#60647B', fontSize: 14, lineHeight: 23 },
  demoNote: { fontSize: 11, color: '#9297A7', lineHeight: 18, marginTop: 12 },
  logoutButton: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1D6DD',
    backgroundColor: '#FFF5F7',
    marginTop: 28,
  },
  logoutText: { color: '#BD425D', fontSize: 15, fontWeight: '700' },
  version: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9297A7',
    marginTop: 20,
  },
});
