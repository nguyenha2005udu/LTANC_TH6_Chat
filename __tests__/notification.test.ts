import {
  buildReactionUpdates,
  buildSendUpdates,
} from '../src/services/chatService';
import { markNotificationsRead } from '../src/services/notificationService';
import { update } from 'firebase/database';
jest.mock('../src/services/firebase', () => ({
  auth: { currentUser: { uid: 'alice' } },
  database: {},
}));
jest.mock('firebase/database', () => ({
  ref: jest.fn((_db, path = '') => path),
  serverTimestamp: jest.fn(() => ({ '.sv': 'timestamp' })),
  increment: jest.fn(),
  update: jest.fn(() => Promise.resolve()),
}));
beforeEach(() => jest.clearAllMocks());
test('new message notifies members who are not viewing the chat, in the same update', () => {
  const writes = buildSendUpdates(
    'g1',
    ['alice', 'bob', 'carol'],
    'm1',
    'alice',
    { type: 'text', text: 'Chào' },
    ['carol'],
  );
  expect(writes['notifications/bob/m1']).toMatchObject({
    type: 'message',
    convId: 'g1',
    fromUid: 'alice',
    text: 'Chào',
    read: false,
  });
  expect(writes['notifications/carol/m1']).toBeUndefined();
  expect(writes['notifications/alice/m1']).toBeUndefined();
});
test('a new reaction notifies the sender; removing it or reacting to myself does not', () => {
  const message = {
    id: 'm1',
    senderId: 'bob',
    type: 'text' as const,
    text: 'Hi',
  };
  const added = buildReactionUpdates('c', message, 'alice', '❤️');
  expect(added['messages/c/m1/reactions/alice']).toBe('❤️');
  expect(added['notifications/bob/r_m1_alice']).toMatchObject({
    type: 'reaction',
    fromUid: 'alice',
  });
  const removed = buildReactionUpdates('c', message, 'alice', '❤️', '❤️');
  expect(removed).toEqual({ 'messages/c/m1/reactions/alice': null });
  const own = buildReactionUpdates(
    'c',
    { ...message, senderId: 'alice' },
    'alice',
    '👍',
  );
  expect(Object.keys(own)).toEqual(['messages/c/m1/reactions/alice']);
});
test('"Đánh dấu tất cả đã đọc" writes every id in one update', async () => {
  await markNotificationsRead(['n1', 'n2']);
  expect(update).toHaveBeenCalledTimes(1);
  expect((update as jest.Mock).mock.calls[0][1]).toEqual({
    'notifications/alice/n1/read': true,
    'notifications/alice/n2/read': true,
  });
});
