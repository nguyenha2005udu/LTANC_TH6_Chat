import { createContext, useContext } from 'react';
import type {
  AppNotification,
  ChatSummary,
  Contact,
  Conversation,
  Profile,
  UserChat,
} from './types';
export type Session = {
  uid: string;
  account: string;
  displayName: string;
  users: Record<string, Profile>;
  contacts: Contact[];
  /** Home list: direct + group conversations, newest first. */
  chats: ChatSummary[];
  conversations: Record<string, Conversation>;
  userChats: Record<string, UserChat>;
  isOnline: (uid: string) => boolean;
  /** notifications/{uid}, newest first (latest 50). */
  notifications: Array<AppNotification & { id: string }>;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};
export const ChatContext = createContext<Session | null>(null);
export function useChat() {
  const value = useContext(ChatContext);
  if (!value) {
    throw new Error('Missing chat provider');
  }
  return value;
}
