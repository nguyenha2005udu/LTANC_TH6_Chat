import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, AppState, StatusBar, Text } from 'react-native';
import {
  createNavigationContainerRef,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import LoginScreen from './src/screens/LoginScreen';
import DetailScreen from './src/screens/DetailScreen';
import CreateGroupScreen from './src/screens/CreateGroupScreen';
import GroupInfoScreen from './src/screens/GroupInfoScreen';
import MainTabs from './src/navigation/MainTabs';
import type { RootRoutes } from './src/navigation/types';
import { ChatContext } from './src/ChatContext';
import type {
  AppNotification,
  Contact,
  Conversation,
  Profile,
  UserChat,
} from './src/types';
import {
  markNotificationsRead,
  subscribeNotifications,
} from './src/services/notificationService';
import {
  newForBanner,
  onNotificationOpen,
  setupLocalNotifications,
  showLocalNotification,
  type OpenTarget,
} from './src/services/localNotificationService';
import { auth, database, errorMessage } from './src/services/firebase';
import { firebaseConfigured } from './src/services/firebaseConfig';
import * as authService from './src/services/authService';
import { presence } from './src/services/presenceService';
import { buildSummaries } from './src/services/summaries';
import { seedDemoContacts, stopDemoSessions } from './src/services/demo';
const Stack = createNativeStackNavigator<RootRoutes>();
const navigationRef = createNavigationContainerRef<RootRoutes>();
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Record<string, Profile>>({});
  const [online, setOnline] = useState<Record<string, Record<string, boolean>>>(
    {},
  );
  const [userChats, setUserChats] = useState<Record<string, UserChat>>({});
  const [conversations, setConversations] = useState<
    Record<string, Conversation>
  >({});
  const [notifications, setNotifications] = useState<
    Array<AppNotification & { id: string }>
  >([]);
  const [notificationsReady, setNotificationsReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(
    () =>
      onAuthStateChanged(auth, current => {
        setUser(current);
        setLoading(false);
      }),
    [],
  );
  useEffect(() => {
    setUsers({});
    setUserChats({});
    setConversations({});
    setOnline({});
    setNotifications([]);
    setNotificationsReady(false);
    setError('');
    if (!user) {
      return;
    }
    const fail = (e: Error) => setError(errorMessage(e));
    let active = true;
    authService
      .ensureProfile()
      .then(() => {
        if (active) {
          return seedDemoContacts();
        }
      })
      .catch(e => {
        if (active) {
          fail(e);
        }
      });
    // One listener per conversation the user belongs to; all removed in cleanup.
    const conversationListeners = new Map<string, () => void>();
    const stops = [
      onValue(ref(database, 'users'), snap => setUsers(snap.val() || {}), fail),
      onValue(
        ref(database, 'presence'),
        snap => setOnline(snap.val() || {}),
        fail,
      ),
      presence(user.uid, fail),
      subscribeNotifications(
        user.uid,
        items => {
          setNotifications(items);
          setNotificationsReady(true);
        },
        fail,
      ),
      onValue(
        ref(database, `userChats/${user.uid}`),
        snap => {
          const value: Record<string, UserChat> = snap.val() || {};
          setUserChats(value);
          const ids = Object.keys(value);
          conversationListeners.forEach((stop, id) => {
            if (!ids.includes(id)) {
              stop();
              conversationListeners.delete(id);
              setConversations(old => {
                const next = { ...old };
                delete next[id];
                return next;
              });
            }
          });
          ids.forEach(id => {
            if (!conversationListeners.has(id)) {
              conversationListeners.set(
                id,
                onValue(
                  ref(database, `conversations/${id}`),
                  conv =>
                    setConversations(old => ({ ...old, [id]: conv.val() })),
                  // Being removed from a group revokes read access: not an error.
                  e =>
                    (e as { code?: string }).code?.includes('PERMISSION_DENIED')
                      ? undefined
                      : fail(e),
                ),
              );
            }
          });
        },
        fail,
      ),
    ];
    return () => {
      active = false;
      stopDemoSessions();
      stops.forEach(stop => stop());
      conversationListeners.forEach(stop => stop());
    };
  }, [user]);
  const uid = user?.uid || '';

  // Local notifications (notifee) while the app runs in the background.
  const seenNotifications = useRef(new Set<string>());
  const primed = useRef(false);
  useEffect(() => {
    seenNotifications.current = new Set();
    primed.current = false;
    if (!user) {
      return;
    }
    setupLocalNotifications().catch(() => {});
    const open = (target: OpenTarget, attempt = 0) => {
      if (target.notificationId) {
        markNotificationsRead([target.notificationId]).catch(() => {});
      }
      if (navigationRef.isReady()) {
        navigationRef.navigate('Detail', {
          convId: target.convId,
          peerId: target.peerId,
        });
      } else if (attempt < 10) {
        setTimeout(() => open(target, attempt + 1), 300);
      }
    };
    return onNotificationOpen(target => open(target));
  }, [user]);
  useEffect(() => {
    if (!user || !notificationsReady) {
      return;
    }
    if (!primed.current) {
      // Whatever is already in the inbox at login is not "new".
      notifications.forEach(item => seenNotifications.current.add(item.id));
      primed.current = true;
      return;
    }
    newForBanner(
      notifications,
      seenNotifications.current,
      AppState.currentState === 'active',
    ).forEach(item => {
      const from = users[item.fromUid]?.name || 'UDU Chat';
      const conversation = conversations[item.convId];
      const group = conversation?.type === 'group';
      showLocalNotification(
        item,
        group && item.type !== 'group_added'
          ? `${from} · ${conversation?.name || 'Nhóm'}`
          : from,
        item.type === 'message' ? item.text : `${from} ${item.text}`,
        group ? undefined : item.fromUid,
      ).catch(() => {});
    });
  }, [notifications, notificationsReady, user, users, conversations]);
  const isOnline = useCallback(
    (id: string) => Object.keys(online[id] || {}).length > 0,
    [online],
  );
  const contacts: Contact[] = useMemo(
    () =>
      Object.entries(users)
        .filter(([id]) => id !== uid)
        .map(([id, profile]) => ({
          id,
          name: profile.name,
          online: isOnline(id),
        })),
    [users, uid, isOnline],
  );
  const chats = useMemo(
    () => buildSummaries(uid, userChats, conversations, users, isOnline),
    [uid, userChats, conversations, users, isOnline],
  );
  return (
    <SafeAreaProvider>
      <ChatContext.Provider
        value={{
          uid,
          account: user?.email || '',
          displayName: users[uid]?.name || user?.displayName || '',
          users,
          contacts,
          chats,
          conversations,
          userChats,
          isOnline,
          notifications,
          error,
          login: authService.login,
          register: authService.register,
          logout: authService.logout,
        }}
      >
        <StatusBar barStyle="dark-content" />
        {loading ? (
          <SafeAreaView>
            <ActivityIndicator />
          </SafeAreaView>
        ) : (
          <>
            {!firebaseConfigured && (
              <SafeAreaView edges={['top']}>
                <Text>
                  Chưa cấu hình Firebase: cập nhật
                  src/services/firebaseConfig.ts.
                </Text>
              </SafeAreaView>
            )}
            {!!error && <Text accessibilityRole="alert">{error}</Text>}
            <NavigationContainer ref={navigationRef}>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                {user ? (
                  <>
                    <Stack.Screen name="Main" component={MainTabs} />
                    <Stack.Screen name="Detail" component={DetailScreen} />
                    <Stack.Screen
                      name="CreateGroup"
                      component={CreateGroupScreen}
                    />
                    <Stack.Screen
                      name="GroupInfo"
                      component={GroupInfoScreen}
                    />
                  </>
                ) : (
                  <Stack.Screen name="Login" component={LoginScreen} />
                )}
              </Stack.Navigator>
            </NavigationContainer>
          </>
        )}
      </ChatContext.Provider>
    </SafeAreaProvider>
  );
}
