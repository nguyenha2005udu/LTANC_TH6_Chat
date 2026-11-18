import React, { useState } from 'react';
import {
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootRoutes, TabRoutes } from '../navigation/types';
import { useChat } from '../ChatContext';
import Avatar from '../components/Avatar';
import { s } from './styles';
import { formatTime } from '../services/summaries';
type Props = CompositeScreenProps<
  BottomTabScreenProps<TabRoutes, 'Chat'>,
  NativeStackScreenProps<RootRoutes, 'Main'>
>;
export default function ChatsScreen({ navigation }: Props) {
  const { chats, uid, users } = useChat();
  const [query, setQuery] = useState('');
  const totalUnread = chats.reduce((total, chat) => total + chat.unread, 0);
  const filtered = chats.filter(chat =>
    chat.name
      .toLocaleLowerCase('vi')
      .includes(query.trim().toLocaleLowerCase('vi')),
  );
  return (
    <SafeAreaView style={s.page} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <View>
          <Text style={s.brandSmall}>UDU CHAT</Text>
          <Text style={s.heading}>Home</Text>
          <Text style={s.muted}>{totalUnread} tin nhắn chưa đọc</Text>
        </View>
        <TouchableOpacity
          style={s.newGroup}
          onPress={() => navigation.navigate('CreateGroup')}
          accessibilityRole="button"
          accessibilityLabel="Tạo nhóm mới"
        >
          <Text style={s.newGroupText}>＋ Nhóm</Text>
        </TouchableOpacity>
      </View>
      <View style={s.search}>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm kiếm cuộc trò chuyện"
          placeholderTextColor="#9297A7"
          accessibilityLabel="Tìm kiếm cuộc trò chuyện"
        />
      </View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Tất cả hội thoại</Text>
        <Text style={s.muted}>{filtered.length} cuộc trò chuyện</Text>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={s.empty}>Không tìm thấy cuộc trò chuyện.</Text>
        }
        renderItem={({ item }) => {
          const sender =
            item.lastSenderId === uid
              ? 'Bạn: '
              : item.type === 'group' && item.lastSenderId
              ? `${users[item.lastSenderId]?.name || 'Thành viên'}: `
              : '';
          return (
            <TouchableOpacity
              style={s.chatRow}
              accessibilityRole="button"
              accessibilityLabel={`Mở chat ${item.name}`}
              onPress={() => {
                navigation.navigate('Detail', {
                  convId: item.id,
                  peerId: item.peerId,
                });
              }}
            >
              <Avatar
                id={item.peerId || item.id}
                name={item.name}
                online={item.online}
                group={item.type === 'group'}
              />
              <View style={s.flex}>
                <View style={s.row}>
                  <Text style={s.name}>{item.name}</Text>
                  <Text style={s.time}>{formatTime(item.updatedAt)}</Text>
                </View>
                <View style={s.row}>
                  <Text
                    numberOfLines={1}
                    style={[s.preview, item.unread > 0 && s.unreadText]}
                  >
                    {sender}
                    {item.lastMessage}
                  </Text>
                  {item.unread > 0 && (
                    <View style={s.badge}>
                      <Text
                        accessibilityLabel={`${item.unread} tin nhắn chưa đọc`}
                        style={s.badgeText}
                      >
                        {item.unread}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}
