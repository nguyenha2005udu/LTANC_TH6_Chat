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
import { directId } from '../services/chatService';
type Props = CompositeScreenProps<
  BottomTabScreenProps<TabRoutes, 'Contact'>,
  NativeStackScreenProps<RootRoutes, 'Main'>
>;
export default function ContactScreen({ navigation }: Props) {
  const { contacts: users, uid } = useChat();
  const [query, setQuery] = useState('');
  const contacts = users
    .filter(chat =>
      chat.name
        .toLocaleLowerCase('vi')
        .includes(query.trim().toLocaleLowerCase('vi')),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  return (
    <SafeAreaView style={s.page} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <View>
          <Text style={s.brandSmall}>UDU CHAT</Text>
          <Text style={s.heading}>Danh bạ</Text>
        </View>
      </View>
      <View style={s.search}>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm kiếm danh bạ"
          placeholderTextColor="#9297A7"
          accessibilityLabel="Tìm kiếm danh bạ"
        />
      </View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Bạn bè</Text>
        <Text style={s.muted}>{contacts.length} liên hệ</Text>
      </View>
      <FlatList
        data={contacts}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={s.empty}>Không tìm thấy liên hệ.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.chatRow}
            accessibilityRole="button"
            accessibilityLabel={`Nhắn tin ${item.name}`}
            onPress={() => {
              navigation.navigate('Detail', {
                convId: directId(uid, item.id),
                peerId: item.id,
              });
            }}
          >
            <Avatar id={item.id} name={item.name} online={item.online} />
            <View style={s.flex}>
              <Text style={s.name}>{item.name}</Text>
            </View>
            <Text style={s.link}>Nhắn tin</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
