import { push, ref, serverTimestamp, set, update } from 'firebase/database';
import { database } from './firebase';
import { buildSendUpdates, currentUid, newMessageKey } from './chatService';
import { buildNotifications } from './notificationService';

/** Members besides the creator. */
export const MIN_GROUP_MEMBERS = 2;

export function validateGroup(name: string, others: string[]) {
  if (!name.trim()) {
    return 'Vui lòng nhập tên nhóm.';
  }
  if (name.trim().length > 100) {
    return 'Tên nhóm tối đa 100 ký tự.';
  }
  if (others.length < MIN_GROUP_MEMBERS) {
    return `Chọn ít nhất ${MIN_GROUP_MEMBERS} thành viên ngoài bạn.`;
  }
  return null;
}

/** Puts the new group on every member's Home in one multi-path update. */
export function buildGroupInboxUpdates(
  convId: string,
  members: string[],
  text: string,
) {
  const updates: Record<string, unknown> = {};
  members.forEach(member => {
    const base = `userChats/${member}/${convId}`;
    updates[`${base}/lastMessage`] = text;
    updates[`${base}/updatedAt`] = serverTimestamp();
  });
  return updates;
}

/**
 * 1) conversations/{id} (rules need it to exist before members' inboxes),
 * 2) userChats of every member in a single update().
 */
export async function createGroup(
  name: string,
  memberIds: string[],
  creatorName: string,
) {
  const uid = currentUid();
  const others = [...new Set(memberIds)].filter(id => id !== uid);
  const problem = validateGroup(name, others);
  if (problem) {
    throw new Error(problem);
  }
  const id = push(ref(database, 'conversations')).key!;
  const members = [uid, ...others];
  await set(ref(database, `conversations/${id}`), {
    type: 'group',
    name: name.trim(),
    members: Object.fromEntries(members.map(member => [member, true])),
    createdBy: uid,
    createdAt: Date.now(),
  });
  // Every member's Home row + an "added to group" notification, in one update.
  await update(ref(database), {
    ...buildGroupInboxUpdates(
      id,
      members,
      `${creatorName || 'Một thành viên'} đã tạo nhóm`,
    ),
    ...buildNotifications(others, `g_${id}`, {
      type: 'group_added',
      convId: id,
      fromUid: uid,
      text: `đã thêm bạn vào nhóm "${name.trim()}"`,
    }),
  });
  return id;
}

function systemLine(convId: string, members: string[], text: string) {
  return buildSendUpdates(
    convId,
    members,
    newMessageKey(convId),
    currentUid(),
    {
      type: 'system',
      text: text.slice(0, 2000),
    },
  );
}

/** New name + "A đã đổi tên nhóm…" line, in one update. */
export async function renameGroup(
  convId: string,
  members: string[],
  name: string,
  actorName: string,
) {
  const clean = name.trim();
  if (!clean || clean.length > 100) {
    throw new Error('Tên nhóm cần từ 1 đến 100 ký tự.');
  }
  await update(ref(database), {
    [`conversations/${convId}/name`]: clean,
    ...systemLine(
      convId,
      members,
      `${actorName} đã đổi tên nhóm thành "${clean}"`,
    ),
  });
}

/**
 * 1) add members (rules require them to be members before their inbox can be
 *    written), 2) system line to everyone + "added" notification, one update.
 */
export async function addMembers(
  convId: string,
  groupName: string,
  members: string[],
  newMembers: { id: string; name: string }[],
  actorName: string,
) {
  const added = newMembers.filter(person => !members.includes(person.id));
  if (!added.length) {
    return;
  }
  const additions: Record<string, boolean> = {};
  added.forEach(person => {
    additions[`conversations/${convId}/members/${person.id}`] = true;
  });
  await update(ref(database), additions);
  const key = newMessageKey(convId);
  const all = [...members, ...added.map(person => person.id)];
  await update(ref(database), {
    ...buildSendUpdates(convId, all, key, currentUid(), {
      type: 'system',
      text: `${actorName} đã thêm ${added
        .map(person => person.name)
        .join(', ')} vào nhóm`,
    }),
    ...buildNotifications(
      added.map(person => person.id),
      `g_${key}`,
      {
        type: 'group_added',
        convId,
        fromUid: currentUid(),
        text: `đã thêm bạn vào nhóm "${groupName}"`,
      },
    ),
  });
}

/**
 * Paths that take one person out of a group (membership + their inbox row).
 * typing/viewing are only writable by their owner, so they are cleared only
 * when I leave myself.
 */
function exitUpdates(convId: string, uid: string, self: boolean) {
  const updates: Record<string, null> = {
    [`conversations/${convId}/members/${uid}`]: null,
    [`userChats/${uid}/${convId}`]: null,
  };
  if (self) {
    updates[`typing/${convId}/${uid}`] = null;
    updates[`viewing/${convId}/${uid}`] = null;
  }
  return updates;
}

/** Group admin (creator) removes a member. */
export async function removeMember(
  convId: string,
  members: string[],
  target: { id: string; name: string },
  actorName: string,
) {
  const remaining = members.filter(member => member !== target.id);
  await update(
    ref(database),
    systemLine(
      convId,
      remaining,
      `${actorName} đã xóa ${target.name} khỏi nhóm`,
    ),
  );
  await update(ref(database), exitUpdates(convId, target.id, false));
}

/** "A đã rời nhóm" is written while I am still a member, then I leave. */
export async function leaveGroup(
  convId: string,
  members: string[],
  actorName: string,
) {
  const uid = currentUid();
  const remaining = members.filter(member => member !== uid);
  await update(
    ref(database),
    systemLine(convId, remaining, `${actorName} đã rời nhóm`),
  );
  await update(ref(database), exitUpdates(convId, uid, true));
}
