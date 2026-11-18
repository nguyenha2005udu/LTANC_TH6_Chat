import type { ChatSummary, Conversation, Profile, UserChat } from '../types';

/** Builds the Home rows from userChats/{uid} + conversations/{convId}. */
export function buildSummaries(
  uid: string,
  userChats: Record<string, UserChat>,
  conversations: Record<string, Conversation>,
  users: Record<string, Profile>,
  isOnline: (uid: string) => boolean,
): ChatSummary[] {
  return Object.entries(userChats)
    .flatMap(([id, meta]) => {
      const conversation = conversations[id];
      if (!conversation) {
        return [];
      }
      const members = Object.keys(conversation.members || {}).filter(
        member => conversation.members[member],
      );
      const others = members.filter(member => member !== uid);
      const group = conversation.type === 'group';
      // An empty direct chat (opened but never written to) stays off Home.
      if (!group && !meta.lastMessageId) {
        return [];
      }
      const peerId = group ? undefined : others[0];
      const onlineCount = others.filter(isOnline).length;
      const summary: ChatSummary = {
        id,
        type: conversation.type,
        name: group
          ? conversation.name || 'Nhóm'
          : users[peerId || '']?.name || 'Người dùng',
        peerId,
        members,
        online: onlineCount > 0,
        onlineCount,
        unread: meta.unread || 0,
        lastMessage: meta.lastMessage || '',
        lastSenderId: meta.lastSenderId,
        lastMessageId: meta.lastMessageId,
        updatedAt: meta.updatedAt || conversation.createdAt || 0,
      };
      return [summary];
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function formatTime(timestamp?: number) {
  if (!timestamp) {
    return '';
  }
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return date.toLocaleString(
    'vi-VN',
    sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        },
  );
}

/** "Hoạt động X phút trước" for an offline person. */
export function lastSeenText(lastSeen: number | null, now = Date.now()) {
  if (!lastSeen) {
    return 'Ngoại tuyến';
  }
  const minutes = Math.max(0, Math.floor((now - lastSeen) / 60000));
  if (minutes < 1) {
    return 'Vừa mới hoạt động';
  }
  if (minutes < 60) {
    return `Hoạt động ${minutes} phút trước`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Hoạt động ${hours} giờ trước`;
  }
  return `Hoạt động ${Math.floor(hours / 24)} ngày trước`;
}
