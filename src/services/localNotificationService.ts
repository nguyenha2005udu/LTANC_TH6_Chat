import notifee, {
  AndroidImportance,
  EventType,
  type Event,
} from '@notifee/react-native';
import type { AppNotification } from '../types';

const CHANNEL_ID = 'messages';
export type OpenTarget = {
  notificationId: string;
  convId: string;
  peerId?: string;
};

/** Asks for permission (Android 13+ / iOS) and creates the Android channel. */
export async function setupLocalNotifications() {
  await notifee.requestPermission();
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Tin nhắn',
    importance: AndroidImportance.HIGH,
  });
}

/**
 * Decides which items of notifications/{uid} become a system notification:
 * unread, not seen in an earlier snapshot, and only while the app is not in
 * the foreground (the in-app list and badges cover the foreground case).
 */
export function newForBanner(
  items: Array<AppNotification & { id: string }>,
  seen: Set<string>,
  appActive: boolean,
) {
  const fresh = items.filter(item => !seen.has(item.id));
  fresh.forEach(item => seen.add(item.id));
  return appActive ? [] : fresh.filter(item => !item.read);
}

export function showLocalNotification(
  notification: AppNotification & { id: string },
  title: string,
  body: string,
  peerId?: string,
) {
  return notifee.displayNotification({
    id: notification.id,
    title,
    body,
    data: {
      notificationId: notification.id,
      convId: notification.convId,
      peerId: peerId || '',
    },
    android: {
      channelId: CHANNEL_ID,
      smallIcon: 'ic_launcher',
      pressAction: { id: 'default' },
    },
    ios: { sound: 'default' },
  });
}

export function cancelLocalNotification(id: string) {
  return notifee.cancelNotification(id).catch(() => {});
}

function targetOf(event: Event): OpenTarget | null {
  const data = event.detail.notification?.data;
  if (event.type !== EventType.PRESS || typeof data?.convId !== 'string') {
    return null;
  }
  return {
    notificationId: String(data.notificationId || ''),
    convId: data.convId,
    peerId: data.peerId ? String(data.peerId) : undefined,
  };
}

// A tap that arrives while JS runs in the background is kept until the UI
// subscribes (see onNotificationOpen).
let pending: OpenTarget | null = null;
let listener: ((target: OpenTarget) => void) | null = null;
function deliver(target: OpenTarget | null) {
  if (!target) {
    return;
  }
  if (listener) {
    listener(target);
  } else {
    pending = target;
  }
}

/** Registered once in index.js, outside React. */
export function registerBackgroundHandler() {
  notifee.onBackgroundEvent(async event => deliver(targetOf(event)));
}

/** Calls `open` for taps: app launched from a notification, background or foreground. */
export function onNotificationOpen(open: (target: OpenTarget) => void) {
  listener = open;
  if (pending) {
    const target = pending;
    pending = null;
    open(target);
  }
  notifee
    .getInitialNotification()
    .then(initial => {
      const data = initial?.notification.data;
      if (typeof data?.convId === 'string') {
        open({
          notificationId: String(data.notificationId || ''),
          convId: data.convId,
          peerId: data.peerId ? String(data.peerId) : undefined,
        });
      }
    })
    .catch(() => {});
  const unsubscribe = notifee.onForegroundEvent(event =>
    deliver(targetOf(event)),
  );
  return () => {
    unsubscribe();
    if (listener === open) {
      listener = null;
    }
  };
}
