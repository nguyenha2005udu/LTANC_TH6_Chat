import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChat } from '../ChatContext';
import { s } from './styles';
import { errorMessage } from '../services/firebase';
import { firebaseConfigured } from '../services/firebaseConfig';
export default function LoginScreen() {
  const { login, register } = useChat();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) {
      return;
    }
    if (!firebaseConfigured) {
      setError('Vui lòng cấu hình Firebase trước khi sử dụng.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập tài khoản và mật khẩu.');
      return;
    }
    setError('');
    if (
      registering &&
      (!name.trim() || password.length < 6 || password !== confirmation)
    ) {
      setError(
        'Nhập họ tên, mật khẩu ít nhất 6 ký tự và xác nhận mật khẩu khớp nhau.',
      );
      return;
    }
    setBusy(true);
    try {
      if (registering) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={s.page}>
      <View style={s.flex}>
        <ScrollView
          style={s.flex}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          keyboardDismissMode="on-drag"
          contentContainerStyle={s.login}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.logo}>
            <Text style={s.logoText}>u.</Text>
          </View>
          <Text style={s.brand}>UDU CHAT</Text>
          <View style={s.card}>
            <Text style={s.title}>
              {registering ? 'Tạo tài khoản' : 'Chào mừng trở lại'}
            </Text>
            <Text style={s.muted}>Kết nối và trò chuyện cùng bạn bè.</Text>
            {registering && (
              <>
                <Text style={s.label}>Họ tên</Text>
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  accessibilityLabel="Họ tên"
                />
              </>
            )}
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              placeholder="Nhập email"
              keyboardType="email-address"
              placeholderTextColor="#9297A7"
              autoCapitalize="none"
              autoCorrect={false}
              {...(Platform.OS === 'ios'
                ? { textContentType: 'none' as const }
                : { autoComplete: 'off' as const })}
              value={email}
              onChangeText={setEmail}
              accessibilityLabel="Tài khoản"
            />
            <Text style={s.label}>Mật khẩu</Text>
            <View style={s.password}>
              <TextInput
                style={s.passwordInput}
                placeholder="Nhập mật khẩu"
                placeholderTextColor="#9297A7"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                {...(Platform.OS === 'ios'
                  ? { textContentType: 'none' as const }
                  : { autoComplete: 'off' as const })}
                secureTextEntry={!visible}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={submit}
                accessibilityLabel="Mật khẩu"
              />
              <Pressable
                onPress={() => setVisible(!visible)}
                accessibilityRole="button"
              >
                <Text style={s.link}>{visible ? 'Ẩn' : 'Hiện'}</Text>
              </Pressable>
            </View>
            {registering && (
              <>
                <Text style={s.label}>Nhập lại mật khẩu</Text>
                <TextInput
                  style={s.input}
                  value={confirmation}
                  onChangeText={setConfirmation}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  {...(Platform.OS === 'ios'
                    ? { textContentType: 'none' as const }
                    : { autoComplete: 'off' as const })}
                  secureTextEntry
                  accessibilityLabel="Nhập lại mật khẩu"
                />
              </>
            )}
            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            <Pressable
              disabled={busy}
              style={s.button}
              accessibilityLabel="Đăng nhập"
              onPress={submit}
              accessibilityRole="button"
            >
              <Text style={s.buttonText}>
                {busy ? 'Đang xử lý…' : registering ? 'Đăng ký' : 'Đăng nhập →'}
              </Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => {
                setRegistering(!registering);
                setError('');
              }}
            >
              <Text style={s.link}>
                {registering
                  ? 'Đã có tài khoản? Đăng nhập'
                  : 'Chưa có tài khoản? Đăng ký'}
              </Text>
            </Pressable>
          </View>
          <Text style={s.footer}>
            Những cuộc trò chuyện hay bắt đầu từ đây.
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
