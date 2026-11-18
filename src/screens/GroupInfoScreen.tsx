import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
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
  addMembers,
  leaveGroup,
  removeMember,
  renameGroup,
} from '../services/groupService';
import { errorMessage } from '../services/firebase';

function failMessage(e: unknown) {
  return (e as { code?: string }).code ? errorMessage(e) : (e as Error).message;
}

/** Group admin: rename, add/remove members (creator), leave. */
export default function GroupInfoScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootRoutes, 'GroupInfo'>) {
  const { convId } = route.params;
  const { uid, users, contacts, conversations, isOnline, displayName } =
    useChat();
  const conversation = conversations[convId];
  const [name, setName] = useState(conversation?.name || '');
  const [adding, setAdding] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  if (!conversation || conversation.type !== 'group') {
    return (
      <SafeAreaView style={s.page}>
        <Text style={s.empty}>Bạn không còn trong nhóm này.</Text>
      </SafeAreaView>
    );
  }
  const members = Object.keys(conversation.members || {});
  const admin = conversation.createdBy === uid;
  const nameOf = (id: string) => users[id]?.name || 'Người dùng';
  const candidates = contacts
    .filter(contact => !members.includes(contact.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const run = async (action: () => Promise<void>, title: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await action();
    } catch (e) {
      Alert.alert(title, failMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const rename = () =>
    run(
      () => renameGroup(convId, members, name, displayName),
      'Không đổi được tên nhóm',
    );
  const add = () =>
    run(async () => {
      await addMembers(
        convId,
        conversation.name || '',
        members,
        adding.map(id => ({ id, name: nameOf(id) })),
        displayName,
      );
      setAdding([]);
    }, 'Không thêm được thành viên');
  const remove = (id: string) =>
    Alert.alert('Xóa khỏi nhóm?', `${nameOf(id)} sẽ không còn trong nhóm.`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () =>
          run(
            () =>
              removeMember(
                convId,
                members,
                { id, name: nameOf(id) },
                displayName,
              ),
            'Không xóa được thành viên',
          ),
      },
    ]);
  const leave = () =>
    Alert.alert('Rời nhóm?', 'Bạn sẽ không nhận tin của nhóm này nữa.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Rời nhóm',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await leaveGroup(convId, members, displayName);
            navigation.popToTop();
          }, 'Không rời được nhóm'),
      },
    ]);
  return (
    <SafeAreaView style={s.page}>
      <View style={s.detailHeader}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Text style={s.back}>‹</Text>
        </Pressable>
        <Text style={[s.name, s.flex]}>Thông tin nhóm</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={s.label}>Tên nhóm</Text>
        <View style={styles.inline}>
          <TextInput
            style={[s.input, s.flex]}
            value={name}
            onChangeText={setName}
            maxLength={100}
            accessibilityLabel="Tên nhóm"
          />
          <Pressable
            style={[
              styles.small,
              (busy || !name.trim() || name.trim() === conversation.name) &&
                s.disabled,
            ]}
            disabled={busy || !name.trim() || name.trim() === conversation.name}
            onPress={rename}
            accessibilityRole="button"
            accessibilityLabel="Lưu tên nhóm"
          >
            <Text style={s.buttonText}>Lưu</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>Thành viên ({members.length})</Text>
        {members.map(id => (
          <View key={id} style={styles.member}>
            <Avatar id={id} name={nameOf(id)} online={isOnline(id)} />
            <View style={s.flex}>
              <Text style={s.name}>
                {nameOf(id)}
                {id === uid ? ' (bạn)' : ''}
              </Text>
              {id === conversation.createdBy && (
                <Text style={s.muted}>Quản trị viên</Text>
              )}
            </View>
            {admin && id !== uid && (
              <Pressable
                disabled={busy}
                onPress={() => remove(id)}
                accessibilityRole="button"
                accessibilityLabel={`Xóa ${nameOf(id)} khỏi nhóm`}
              >
                <Text style={styles.danger}>Xóa</Text>
              </Pressable>
            )}
          </View>
        ))}

        {candidates.length > 0 && (
          <>
            <Text style={styles.title}>Thêm thành viên</Text>
            {candidates.map(contact => {
              const checked = adding.includes(contact.id);
              return (
                <Pressable
                  key={contact.id}
                  style={styles.member}
                  onPress={() =>
                    setAdding(old =>
                      checked
                        ? old.filter(id => id !== contact.id)
                        : [...old, contact.id],
                    )
                  }
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={contact.name}
                >
                  <Avatar
                    id={contact.id}
                    name={contact.name}
                    online={contact.online}
                  />
                  <Text style={[s.name, s.flex]}>{contact.name}</Text>
                  <View style={[styles.box, checked && styles.boxChecked]}>
                    {checked && <Text style={styles.tick}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              style={[s.button, (busy || !adding.length) && s.disabled]}
              disabled={busy || !adding.length}
              onPress={add}
              accessibilityRole="button"
            >
              <Text style={s.buttonText}>Thêm {adding.length} người</Text>
            </Pressable>
          </>
        )}

        <Pressable
          style={styles.leave}
          disabled={busy}
          onPress={leave}
          accessibilityRole="button"
        >
          <Text style={styles.leaveText}>Rời nhóm</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 40 },
  inline: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  small: {
    backgroundColor: '#6658E8',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#242439',
    marginTop: 28,
    marginBottom: 8,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  danger: { color: '#C53950', fontWeight: '700', padding: 8 },
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
  leave: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1D6DD',
    backgroundColor: '#FFF5F7',
    marginTop: 32,
  },
  leaveText: { color: '#BD425D', fontSize: 15, fontWeight: '700' },
});
