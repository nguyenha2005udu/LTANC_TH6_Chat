import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';
const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const database = getDatabase(app);
export function errorMessage(error: unknown) {
  const code = (error as { code?: string }).code;
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
    'auth/user-not-found': 'Email hoặc mật khẩu không đúng.',
    'auth/wrong-password': 'Email hoặc mật khẩu không đúng.',
    'auth/email-already-in-use': 'Email này đã được đăng ký.',
    'auth/invalid-email': 'Email không hợp lệ.',
    'auth/weak-password': 'Mật khẩu cần ít nhất 6 ký tự.',
    'auth/network-request-failed': 'Không thể kết nối. Vui lòng kiểm tra mạng.',
    'auth/too-many-requests': 'Thử quá nhiều lần. Vui lòng thử lại sau.',
    PERMISSION_DENIED: 'Không có quyền truy cập. Kiểm tra Database Rules.',
  };
  return (
    messages[code || ''] ||
    'Thao tác thất bại. Vui lòng kiểm tra kết nối và cấu hình Firebase.'
  );
}
