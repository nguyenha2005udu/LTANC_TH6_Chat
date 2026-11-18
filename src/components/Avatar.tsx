import React, { useContext } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { s } from '../screens/styles';
import { ChatContext } from '../ChatContext';
import { avatarThumb } from '../services/profileService';
const images = [
  require('../assets/avatar-1.png'),
  require('../assets/avatar-2.png'),
  require('../assets/avatar-3.png'),
  require('../assets/avatar-4.png'),
  require('../assets/avatar-5.png'),
];
/** Stable sample avatar per uid, so each person keeps the same picture. */
function pick(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1000003;
  }
  return images[Math.abs(hash) % images.length];
}
export default function Avatar({
  id,
  name,
  online,
  group = false,
}: {
  id: string;
  name: string;
  online?: boolean;
  group?: boolean;
}) {
  // A person's uploaded photo (users/{uid}/avatar) is read live from context,
  // so a new picture shows up in Contacts, Home and chats at once.
  const avatar = useContext(ChatContext)?.users[id]?.avatar;
  return (
    <View style={[s.avatar, styles.background]}>
      {group ? (
        <Text style={s.initials} accessibilityLabel={`Ảnh nhóm ${name}`}>
          {name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(word => word[0]?.toLocaleUpperCase('vi'))
            .join('') || '#'}
        </Text>
      ) : (
        <Image
          source={avatar ? { uri: avatarThumb(avatar) } : pick(id)}
          style={styles.image}
          accessibilityLabel={`Ảnh đại diện ${name}`}
        />
      )}
      {online !== undefined && (
        <View
          accessible
          accessibilityLabel={online ? 'Đang hoạt động' : 'Ngoại tuyến'}
          style={[s.dot, !online && styles.offline]}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  background: { backgroundColor: '#E8DFFC' },
  offline: { backgroundColor: '#9297A7' },
  image: { width: 52, height: 52, borderRadius: 19 },
});
