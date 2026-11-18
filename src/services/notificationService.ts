import {
  limitToLast,
  onValue,
  orderByKey,
  query,
  ref,
  serverTimestamp,
  update,
} from 'firebase/database';
import { auth, database } from './firebase';
import type { AppNotification, NotificationType } from '../types';

export const NOTIFICATION_LIMIT = 50;

/**
 * Paths for notifications/{uid}/{id}, meant to be merged into the same
 * multi-path update as the action that caused them.
 */
export function buildNotifications(
  recipients: string[],
  id: string,
  notification: {
    type: NotificationType;
    convId: string;
    fromUid: string;
    text: string;
  },
) {
  const updates: Record<string, unknown> = {};
  recipients
    .filter(uid => uid !== notification.fromUid)
    .forEach(uid => {
      updates[`notifications/${uid}/${id}`] = {
        ...notification,
        text: notification.text.slice(0, 200),
        createdAt: serverTimestamp(),
        read: false,
      };
    });
  return updates;
}

export function subscribeNotifications(
  uid: string,
  onChange: (items: Array<AppNotification & { id: string }>) => void,
  onError: (error: Error) => void,
) {
  return onValue(
    query(
      ref(database, `notifications/${uid}`),
      orderByKey(),
      limitToLast(NOTIFICATION_LIMIT),
    ),
    snap => {
      const value: Record<string, AppNotification> = snap.val() || {};
      onChange(
        Object.entries(value)
          .map(([id, item]) => ({ ...item, id }))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
      );
    },
    onError,
  );
}

/** Marks one or many of my notifications as read in a single update. */
export function markNotificationsRead(ids: string[]) {
  const uid = auth.currentUser?.uid;
  if (!uid || !ids.length) {
    return Promise.resolve();
  }
  const updates: Record<string, boolean> = {};
  ids.forEach(id => {
    updates[`notifications/${uid}/${id}/read`] = true;
  });
  return update(ref(database), updates);
}
