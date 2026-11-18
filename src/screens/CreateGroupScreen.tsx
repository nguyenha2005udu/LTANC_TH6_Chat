import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootRoutes } from '../navigation/types';
import { useChat } from '../ChatContext';
import Avatar from '../components/Avatar';
import { s } from './styles';
import {
  createGroup,
  MIN_GROUP_MEMBERS,
  validateGroup,
} from '../services/groupService';
import { errorMessage } from '../services/firebase';

export default function CreateGroupScreen({
  navigation,
}: NativeStackScreenProps<RootRoutes, 'CreateGroup'>) {
  const { contacts, displayName } = useChat();
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const shown = contacts
    .filter(contact =>
      contact.name
        .toLocaleLowerCase('vi')
        .includes(query.trim().toLocaleLowerCase('vi')),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const problem = validateGroup(name, selected);
  const toggle = (id: string) =>
    setSelected(old =>
      old.includes(id) ? old.filter(item => item !== id) : [...old, id],
    );
  const submit = async () => {
    if (problem || busy) {
      return;
    }
    setBusy(true);
    try {
      const convId = await createGroup(name, selected, displayName);
      navigation.replace('Detail', { convId });
    } catch (e) {
      Alert.alert(
        'Không tạo được nhóm',
        (e as { code?: string }).code ? errorMessage(e) : (e as Error).message,
      );
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={s.page}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.detailHeader}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Text style={s.back}>‹</Text>
          </Pressable>
          <Text style={[s.name, s.flex]}>Tạo nhóm</Text>
        </View>
        <View style={styles.form}>
          <Text style={s.label}>Tên nhóm</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            maxLength={100}
            placeholder="Ví dụ: Nhóm thực hành"
            placeholderTextColor="#9297A7"
            accessibilityLabel="Tên nhóm"
          />
        </View>
        <View style={s.search}>
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm trong danh bạ"
            placeholderTextColor="#9297A7"
            accessibilityLabel="Tìm thành viên"
          />
        </View>
        <View style={s.section}>
          <Text style={s.sectionTitle}>Thành viên</Text>
          <Text style={s.muted}>
            Đã chọn {selected.length} (tối thiểu {MIN_GROUP_MEMBERS})
          </Text>
        </View>
        <FlatList
          data={shown}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={s.empty}>Không tìm thấy liên hệ.</Text>
          }
          renderItem={({ item }) => {
            const checked = selected.includes(item.id);
            return (
              <Pressable
                style={[s.chatRow, styles.row]}
                onPress={() => toggle(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={item.name}
              >
                <Avatar id={item.id} name={item.name} online={item.online} />
                <Text style={[s.name, s.flex]}>{item.name}</Text>
                <View style={[styles.box, checked && styles.boxChecked]}>
                  {checked && <Text style={styles.tick}>✓</Text>}
                </View>
              </Pressable>
            );
          }}
        />
        <View style={styles.footer}>
          {!!problem && (name.length > 0 || selected.length > 0) && (
            <Text style={styles.hint}>{problem}</Text>
          )}
          <Pressable
            style={[s.button, styles.create, (!!problem || busy) && s.disabled]}
            disabled={!!problem || busy}
            onPress={submit}
            accessibilityRole="button"
            accessibilityLabel="Tạo nhóm"
          >
            <Text style={s.buttonText}>
              {busy ? 'Đang tạo…' : `Tạo nhóm (${selected.length + 1} người)`}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  form: { paddingHorizontal: 24, paddingBottom: 16 },
  row: { alignItems: 'center' },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#C9CCDA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: '#6658E8', borderColor: '#6658E8' },
  tick: { color: '#FFF', fontWeight: '800' },
  footer: { padding: 16, backgroundColor: '#FFF' },
  hint: { color: '#7E8297', textAlign: 'center' },
  create: { marginTop: 12 },
});
