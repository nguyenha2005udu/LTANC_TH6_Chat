// Shapes stored in Firebase Realtime Database (see README "Cấu trúc dữ liệu").
export type MessageType = 'text' | 'image' | 'location' | 'system';
/** Snapshot of the quoted message, stored with a reply. */
export type ReplyRef = { id: string; senderId: string; text: string };
export type WireMessage = {
  senderId: string;
  type: MessageType;
  text?: string;
  imageUrl?: string;
  lat?: number;
  lng?: number;
  createdAt: number;
  recalled?: boolean;
  reactions?: Record<string, string>;
  replyTo?: ReplyRef;
};
export type Message = WireMessage & {
  id: string;
  mine: boolean;
  /** Local image bubble that is not in the database yet. */
  pending?: 'uploading' | 'error';
  localUri?: string;
};
export type ConversationType = 'direct' | 'group';
export type Conversation = {
  type: ConversationType;
  name?: string;
  members: Record<string, boolean>;
  createdBy: string;
  createdAt: number;
};
export type UserChat = {
  lastMessage?: string;
  lastSenderId?: string;
  lastMessageId?: string;
  updatedAt?: number;
  unread?: number;
};
export type Profile = { name: string; avatar?: string };

// Shapes used by the UI.
export type Contact = { id: string; name: string; online: boolean };
export type ChatSummary = {
  id: string;
  type: ConversationType;
  name: string;
  /** Direct chat: the other person's uid. */
  peerId?: string;
  members: string[];
  /** Direct chat: peer online. Group: at least one other member online. */
  online: boolean;
  onlineCount: number;
  unread: number;
  lastMessage: string;
  lastSenderId?: string;
  lastMessageId?: string;
  updatedAt: number;
};
export type NotificationType = 'message' | 'group_added' | 'reaction';
export type AppNotification = {
  type: NotificationType;
  convId: string;
  fromUid: string;
  text: string;
  createdAt: number;
  read: boolean;
};
