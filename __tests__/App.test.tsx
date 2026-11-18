import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import LoginScreen from '../src/screens/LoginScreen';
import { ChatContext, type Session } from '../src/ChatContext';
jest.mock('../src/services/firebase', () => ({
  errorMessage: () => 'Email hoặc mật khẩu không đúng.',
}));
jest.mock('../src/services/firebaseConfig', () => ({
  firebaseConfigured: true,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
let renderer: ReactTestRenderer.ReactTestRenderer;
const login = jest.fn();
const register = jest.fn();
beforeEach(async () => {
  jest.clearAllMocks();
  await act(() => {
    renderer = ReactTestRenderer.create(
      <ChatContext.Provider value={{ login, register } as unknown as Session}>
        <LoginScreen />
      </ChatContext.Provider>,
    );
  });
});
afterEach(async () => {
  await act(() => renderer.unmount());
});
async function input(label: string, value: string) {
  await act(() =>
    renderer.root
      .findAllByType(TextInput)
      .find(n => n.props.accessibilityLabel === label)!
      .props.onChangeText(value),
  );
}
async function press(label?: string) {
  const buttons = renderer.root.findAll(
    n => typeof n.props.onPress === 'function',
  );
  await act(async () => {
    await (label
      ? buttons.find(n => n.props.accessibilityLabel === label)!
      : buttons[buttons.length - 1]
    ).props.onPress();
  });
}
const contents = () => JSON.stringify(renderer.toJSON());
test('rejects empty login and displays Firebase credential errors', async () => {
  await press('Đăng nhập');
  expect(login).not.toHaveBeenCalled();
  await input('Tài khoản', 'a@example.com');
  await input('Mật khẩu', '123456');
  login.mockRejectedValueOnce(new Error('invalid'));
  await press('Đăng nhập');
  expect(login).toHaveBeenCalledWith('a@example.com', '123456');
  expect(contents()).toContain('Email hoặc mật khẩu không đúng.');
});
test('registration requires name, six characters and matching confirmation', async () => {
  await press();
  await input('Tài khoản', 'b@example.com');
  await input('Mật khẩu', '12345');
  await press('Đăng nhập');
  expect(register).not.toHaveBeenCalled();
  await input('Họ tên', 'Bình');
  await input('Mật khẩu', '123456');
  await input('Nhập lại mật khẩu', 'different');
  await press('Đăng nhập');
  expect(register).not.toHaveBeenCalled();
  await input('Nhập lại mật khẩu', '123456');
  await press('Đăng nhập');
  expect(register).toHaveBeenCalledWith('Bình', 'b@example.com', '123456');
});
