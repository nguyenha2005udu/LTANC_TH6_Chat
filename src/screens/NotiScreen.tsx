import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootRoutes, TabRoutes } from '../navigation/types';
import type { AppNotification } from '../types';
import { useChat } from '../ChatContext';
import Avatar from '../components/Avatar';
import { s } from './styles';
import { markNotificationsRead } from '../services/notificationService';
import { formatTime } from '../services/summaries';
import { errorMessage } from '../services/firebase';
type Props = CompositeScreenProps<
  BottomTabScreenProps<TabRoutes, 'Noti'>,
  NativeStackScreenProps<RootRoutes, 'Main'>
>;
const icons: Record<AppNotification['type'], string> = {
  message: '💬',
  group_added: '👥',
  reaction: '❤️',
};
export default function NotiScreen({ navigation }: Props) {
  const { notifications, users, conversations } = useChat();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const unreadIds = notifications.filter(item => !item.read).map(i => i.id);
  const filtered = notifications.filter(item => !unreadOnly || !item.read);
  const fail = (e: unknown) => Alert.alert('Lỗi', errorMessage(e));
  const open = (item: AppNotification & { id: string }) => {
    if (!item.read) {
      markNotificationsRead([item.id]).catch(fail);
    }
    const conversation = conversations[item.convId];
    navigation.navigate('Detail', {
      convId: item.convId,
      peerId: conversation?.type === 'group' ? undefined : item.fromUid,
    });
  };
  return (
    <SafeAreaView style={s.page} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <View>
          <Text style={s.brandSmall}>UDU CHAT</Text>
          <Text style={s.heading}>Thông báo</Text>
        </View>
      </View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>
          {unreadIds.length} thông báo chưa đọc
        </Text>
        <TouchableOpacity
          disabled={unreadIds.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Đánh dấu tất cả đã đọc"
          onPress={() => markNotificationsRead(unreadIds).catch(fail)}
        >
          <Text style={[s.link, unreadIds.length === 0 && s.disabled]}>
            Đánh dấu tất cả đã đọc
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.filter}>
        <Text style={s.muted}>Chỉ hiển thị chưa đọc</Text>
        <Switch
          accessibilityLabel="Chỉ hiển thị thông báo chưa đọc"
          value={unreadOnly}
          onValueChange={setUnreadOnly}
          trackColor={{ false: '#D9DCE8', true: '#6658E8' }}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <Text style={s.empty}>
            {unreadOnly ? 'Không có thông báo chưa đọc.' : 'Chưa có thông báo.'}
          </Text>
        }
        renderItem={({ item }) => {
          const from = users[item.fromUid]?.name || 'Ai đó';
          const conversation = conversations[item.convId];
          const where =
            conversation?.type === 'group' && item.type !== 'group_added'
              ? ` · ${conversation.name}`
              : '';
          return (
            <TouchableOpacity
              style={[s.chatRow, !item.read && styles.unread]}
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={`${from} ${item.text}${
                item.read ? '' : ', chưa đọc'
              }`}
            >
              <View>
                <Avatar id={item.fromUid} name={from} />
                <Text style={styles.icon}>{icons[item.type]}</Text>
              </View>
              <View style={s.flex}>
                <Text style={s.name} numberOfLines={1}>
                  {from}
                  {where}
                </Text>
                <Text style={styles.body} numberOfLines={2}>
                  {item.type === 'message' ? item.text : `${from} ${item.text}`}
                </Text>
                <View style={s.row}>
                  <Text style={s.time}>{formatTime(item.createdAt)}</Text>
                  <Text style={[s.muted, !item.read && s.unreadText]}>
                    {item.read ? 'Đã đọc' : '● Chưa đọc'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  unread: {
    backgroundColor: '#EFEDFF',
    borderLeftWidth: 3,
    borderLeftColor: '#6658E8',
  },
  body: { color: '#60647B', lineHeight: 21, marginVertical: 6 },
  icon: { position: 'absolute', right: -6, bottom: -4, fontSize: 16 },
  filter: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
