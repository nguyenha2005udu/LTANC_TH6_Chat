import { AppState } from 'react-native';
import {
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
} from 'firebase/database';
import { database } from './firebase';

let current: (() => Promise<void>) | undefined;
export function stopPresence() {
  return current ? current() : Promise.resolve();
}

/**
 * One presence/{uid}/{connectionId} node per device, removed by onDisconnect.
 * lastSeen/{uid} is stamped by the server when the app disconnects (even if it
 * is killed) and when it goes to the background.
 */
export function presence(uid: string, onError: (error: Error) => void) {
  const connection = push(ref(database, `presence/${uid}`));
  const lastSeen = ref(database, `lastSeen/${uid}`);
  let active = true;
  let connected = false;
  let generation = 0;
  const sync = async () => {
    const ticket = ++generation;
    try {
      if (active && connected && AppState.currentState === 'active') {
        await onDisconnect(lastSeen).set(serverTimestamp());
        await onDisconnect(connection).remove();
        if (active && ticket === generation) {
          await set(connection, true);
        }
      } else {
        await remove(connection);
        if (connected) {
          await set(lastSeen, serverTimestamp());
        }
      }
    } catch (error) {
      if (active) {
        onError(error as Error);
      }
    }
  };
  const unsubscribe = onValue(
    ref(database, '.info/connected'),
    snap => {
      connected = snap.val() === true;
      sync();
    },
    onError,
  );
  const listener = AppState.addEventListener('change', () => {
    sync();
  });
  const stop = async () => {
    active = false;
    generation++;
    unsubscribe();
    listener.remove();
    // Both writes are queued before signOut runs.
    await Promise.all([remove(connection), set(lastSeen, serverTimestamp())]);
  };
  current = stop;
  return () => {
    stop().catch(() => {});
    if (current === stop) {
      current = undefined;
    }
  };
}

export function subscribeLastSeen(
  uid: string,
  onChange: (timestamp: number | null) => void,
  onError: (error: Error) => void,
) {
  return onValue(
    ref(database, `lastSeen/${uid}`),
    snap => onChange(typeof snap.val() === 'number' ? snap.val() : null),
    onError,
  );
}

export const TYPING_TIMEOUT = 3000;

/**
 * typing/{convId}/{uid} = true while I type. It is cleared 3 s after the last
 * keystroke, when the text is sent/emptied, when the screen is left, and by
 * onDisconnect if the app dies, so it never stays stuck.
 */
export function createTypingController(
  convId: string,
  uid: string,
  onError: (error: Error) => void,
) {
  const node = ref(database, `typing/${convId}/${uid}`);
  let on = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (!on) {
      return;
    }
    on = false;
    remove(node).catch(onError);
  };
  const keystroke = (text: string) => {
    if (!text.trim()) {
      stop();
      return;
    }
    if (!on) {
      on = true;
      onDisconnect(node)
        .remove()
        .then(() => (on ? set(node, true) : undefined))
        .catch(onError);
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(stop, TYPING_TIMEOUT);
  };
  return { keystroke, stop };
}

/** uids (other than me) currently typing in a conversation. */
export function subscribeTyping(
  convId: string,
  uid: string,
  onChange: (uids: string[]) => void,
  onError: (error: Error) => void,
) {
  return onValue(
    ref(database, `typing/${convId}`),
    snap =>
      onChange(
        Object.entries(snap.val() || {})
          .filter(([id, value]) => id !== uid && value === true)
          .map(([id]) => id),
      ),
    onError,
  );
}

/**
 * viewing/{convId}/{uid} = true while the conversation is on screen and the
 * app is in the foreground. Senders skip notifications for viewers.
 */
export async function setViewing(convId: string, uid: string, on: boolean) {
  const node = ref(database, `viewing/${convId}/${uid}`);
  if (on) {
    await onDisconnect(node).remove();
    await set(node, true);
  } else {
    await remove(node);
  }
}
export function subscribeViewers(
  convId: string,
  uid: string,
  onChange: (uids: string[]) => void,
  onError: (error: Error) => void,
) {
  return onValue(
    ref(database, `viewing/${convId}`),
    snap =>
      onChange(
        Object.entries(snap.val() || {})
          .filter(([id, value]) => id !== uid && value === true)
          .map(([id]) => id),
      ),
    onError,
  );
}
