import {
  endBefore,
  get,
  increment,
  limitToLast,
  onValue,
  orderByKey,
  push,
  query,
  ref,
  runTransaction,
  serverTimestamp,
  startAt,
  update,
  type Database,
} from 'firebase/database';
import { auth, database } from './firebase';
import type { ReplyRef, WireMessage } from '../types';
import { buildNotifications } from './notificationService';

export const PAGE_SIZE = 20;
export const RECALLED_TEXT = 'Tin nhắn đã được thu hồi';

export type OutgoingMessage =
  | { type: 'text'; text: string }
  | { type: 'location'; lat: number; lng: number }
  | { type: 'image'; imageUrl: string }
  /** "A đã rời nhóm", "A đã đổi tên nhóm…": no unread, no notification. */
  | { type: 'system'; text: string };

export function currentUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Bạn cần đăng nhập trước.');
  }
  return uid;
}
const me = currentUid;

/** One deterministic id per pair, so both people open the same conversation. */
export const directId = (a: string, b: string) => [a, b].sort().join('_');

/** Text shown on Home for the last message of a conversation. */
export function previewOf(message: {
  type: WireMessage['type'];
  text?: string;
  recalled?: boolean;
}) {
  if (message.recalled) {
    return RECALLED_TEXT;
  }
  if (message.type === 'image') {
    return '📷 Hình ảnh';
  }
  if (message.type === 'location') {
    return '📍 Vị trí';
  }
  return message.text || '';
}

/** What a reply stores about the message it quotes. */
export function replyRefOf(message: {
  id: string;
  senderId: string;
  type: WireMessage['type'];
  text?: string;
}): ReplyRef {
  return {
    id: message.id,
    senderId: message.senderId,
    text: previewOf(message).slice(0, 200),
  };
}

/** Creates the direct conversation once; an existing node is never overwritten. */
export async function ensureDirect(peer: string) {
  return ensureDirectAs(me(), peer, database);
}
export async function ensureDirectAs(uid: string, peer: string, db: Database) {
  const id = directId(uid, peer);
  await runTransaction(ref(db, `conversations/${id}`), current =>
    current
      ? undefined
      : {
          type: 'direct',
          members: { [uid]: true, [peer]: true },
          createdBy: uid,
          createdAt: Date.now(),
        },
  );
  return id;
}

/** Reserve a message id up front (used by image upload to show a pending bubble). */
export function newMessageKey(convId: string) {
  return push(ref(database, `messages/${convId}`)).key!;
}

/**
 * Message, lastMessage of every member and unread counters go out in ONE
 * multi-path update. Unread uses increment(1) on the server, never read-then-add.
 * Members who are not looking at the conversation right now (`viewers`) also
 * get a notifications/{uid}/{messageKey} entry in the same update.
 */
export function buildSendUpdates(
  convId: string,
  members: string[],
  key: string,
  senderId: string,
  body: OutgoingMessage,
  viewers: string[] = [],
  replyTo?: ReplyRef,
) {
  const message: Record<string, unknown> = {
    senderId,
    createdAt: serverTimestamp(),
    ...body,
  };
  if (replyTo && body.type !== 'system') {
    message.replyTo = replyTo;
  }
  if (body.type === 'text') {
    message.text = body.text.trim();
  }
  const preview = previewOf({
    type: body.type,
    text: message.text as string | undefined,
  });
  const system = body.type === 'system';
  const updates: Record<string, unknown> = {
    [`messages/${convId}/${key}`]: message,
    [`readStatus/${convId}/${senderId}`]: serverTimestamp(),
  };
  if (!system) {
    Object.assign(
      updates,
      buildNotifications(
        members.filter(member => !viewers.includes(member)),
        key,
        { type: 'message', convId, fromUid: senderId, text: preview },
      ),
    );
  }
  members.forEach(member => {
    const base = `userChats/${member}/${convId}`;
    updates[`${base}/lastMessage`] = preview;
    // System lines already contain the actor's name: no "Bạn: " prefix.
    updates[`${base}/lastSenderId`] = system ? null : senderId;
    updates[`${base}/lastMessageId`] = key;
    updates[`${base}/updatedAt`] = serverTimestamp();
    if (member !== senderId && !system) {
      updates[`${base}/unread`] = increment(1);
    }
  });
  return updates;
}

export async function sendMessage(
  convId: string,
  members: string[],
  body: OutgoingMessage,
  key = newMessageKey(convId),
  viewers: string[] = [],
  replyTo?: ReplyRef,
) {
  if (body.type === 'text' && !body.text.trim()) {
    return;
  }
  const uid = me();
  await update(
    ref(database),
    buildSendUpdates(convId, members, key, uid, body, viewers, replyTo),
  );
}

/** Resets my unread counter and stores the time I last read this conversation. */
export function markRead(convId: string, resetUnread: boolean) {
  const uid = me();
  const updates: Record<string, unknown> = {
    [`readStatus/${convId}/${uid}`]: serverTimestamp(),
  };
  if (resetUnread) {
    updates[`userChats/${uid}/${convId}/unread`] = 0;
  }
  return update(ref(database), updates);
}

export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢'] as const;

/**
 * Recall = mark recalled: true (the node is kept) and drop its content.
 * When it was the conversation's last message, every member's Home preview is
 * updated in the same multi-path update.
 */
export function buildRecallUpdates(
  convId: string,
  msgId: string,
  members: string[],
  wasLastMessage: boolean,
) {
  const path = `messages/${convId}/${msgId}`;
  const updates: Record<string, unknown> = {
    [`${path}/recalled`]: true,
    [`${path}/text`]: null,
    [`${path}/imageUrl`]: null,
    [`${path}/lat`]: null,
    [`${path}/lng`]: null,
    [`${path}/reactions`]: null,
  };
  if (wasLastMessage) {
    members.forEach(member => {
      updates[`userChats/${member}/${convId}/lastMessage`] = RECALLED_TEXT;
    });
  }
  return updates;
}
export function recallMessage(
  convId: string,
  msgId: string,
  members: string[],
  wasLastMessage: boolean,
) {
  me();
  return update(
    ref(database),
    buildRecallUpdates(convId, msgId, members, wasLastMessage),
  );
}

/**
 * Sets my reaction; choosing the same emoji again removes it.
 * A new reaction on someone else's message also notifies its sender.
 */
export function buildReactionUpdates(
  convId: string,
  message: {
    id: string;
    senderId: string;
    type: WireMessage['type'];
    text?: string;
  },
  uid: string,
  emoji: string,
  current?: string,
) {
  const removing = current === emoji;
  const updates: Record<string, unknown> = {
    [`messages/${convId}/${message.id}/reactions/${uid}`]: removing
      ? null
      : emoji,
  };
  if (!removing && message.senderId !== uid) {
    const preview = previewOf(message);
    Object.assign(
      updates,
      buildNotifications([message.senderId], `r_${message.id}_${uid}`, {
        type: 'reaction',
        convId,
        fromUid: uid,
        text: `đã thả ${emoji} vào tin nhắn: "${preview.slice(0, 80)}"`,
      }),
    );
  }
  return updates;
}
export function react(
  convId: string,
  message: {
    id: string;
    senderId: string;
    type: WireMessage['type'];
    text?: string;
  },
  emoji: string,
  current?: string,
) {
  return update(
    ref(database),
    buildReactionUpdates(convId, message, me(), emoji, current),
  );
}

/** {'❤️': 2, '👍': 1} in the fixed REACTIONS order. */
export function countReactions(reactions?: Record<string, string>) {
  const counts = new Map<string, number>();
  Object.values(reactions || {}).forEach(emoji =>
    counts.set(emoji, (counts.get(emoji) || 0) + 1),
  );
  return REACTIONS.filter(emoji => counts.has(emoji)).map(emoji => ({
    emoji,
    count: counts.get(emoji)!,
  }));
}

/** readStatus/{convId}: uid → last time that member read the conversation. */
export function subscribeReadStatus(
  convId: string,
  onChange: (reads: Record<string, number>) => void,
  onError: (error: Error) => void,
) {
  return onValue(
    ref(database, `readStatus/${convId}`),
    snap => onChange(snap.val() || {}),
    onError,
  );
}

export type MessageFeed = {
  /** Loads PAGE_SIZE older messages. Resolves when they are on screen. */
  loadOlder: () => Promise<void>;
  stop: () => void;
};

/**
 * Paged, realtime message feed.
 * - First page: the newest PAGE_SIZE messages (limitToLast(20)), then a live
 *   listener from the oldest of those keys forward, so new messages append.
 * - Each older page is a fixed window (endBefore(cursor) + limitToLast(20)).
 *   Push keys never change, so the window stays stable while still receiving
 *   realtime changes such as recalls or reactions.
 */
export function subscribeMessages(
  convId: string,
  onChange: (messages: Record<string, WireMessage>, hasMore: boolean) => void,
  onError: (error: Error) => void,
): MessageFeed {
  const base = ref(database, `messages/${convId}`);
  const windows = new Map<number, Record<string, WireMessage>>();
  const stops: Array<() => void> = [];
  let stopped = false;
  let oldestKey: string | null = null;
  let hasMore = false;
  let loading: Promise<void> | null = null;
  let nextWindow = 0;
  const emit = () => {
    if (stopped) {
      return;
    }
    const all: Record<string, WireMessage> = {};
    windows.forEach(window => Object.assign(all, window));
    onChange(all, hasMore);
  };
  const fail = (error: Error) => {
    if (!stopped) {
      onError(error);
    }
  };

  const ready = get(query(base, orderByKey(), limitToLast(PAGE_SIZE)))
    .then(initial => {
      if (stopped) {
        return;
      }
      const keys = Object.keys(initial.val() || {}).sort();
      hasMore = keys.length === PAGE_SIZE;
      oldestKey = keys[0] ?? null;
      const index = nextWindow++;
      stops.push(
        onValue(
          oldestKey
            ? query(base, orderByKey(), startAt(oldestKey))
            : query(base, orderByKey()),
          snap => {
            windows.set(index, snap.val() || {});
            if (!oldestKey) {
              oldestKey = Object.keys(snap.val() || {}).sort()[0] ?? null;
            }
            emit();
          },
          fail,
        ),
      );
    })
    .catch(fail);

  const loadOlder = () => {
    if (loading) {
      return loading;
    }
    loading = ready
      .then(
        () =>
          new Promise<void>(resolve => {
            if (stopped || !hasMore || !oldestKey) {
              resolve();
              return;
            }
            const index = nextWindow++;
            let first = true;
            stops.push(
              onValue(
                query(
                  base,
                  orderByKey(),
                  endBefore(oldestKey),
                  limitToLast(PAGE_SIZE),
                ),
                snap => {
                  const value = snap.val() || {};
                  windows.set(index, value);
                  if (first) {
                    first = false;
                    const keys = Object.keys(value).sort();
                    hasMore = keys.length === PAGE_SIZE;
                    oldestKey = keys[0] ?? oldestKey;
                    resolve();
                  }
                  emit();
                },
                error => {
                  fail(error);
                  resolve();
                },
              ),
            );
          }),
      )
      .finally(() => {
        loading = null;
      });
    return loading;
  };

  return {
    loadOlder,
    stop: () => {
      stopped = true;
      stops.forEach(stop => stop());
    },
  };
}
