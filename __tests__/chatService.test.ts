import {
  buildRecallUpdates,
  buildSendUpdates,
  countReactions,
  directId,
  ensureDirect,
  markRead,
  previewOf,
  replyRefOf,
  sendMessage,
} from '../src/services/chatService';
import { runTransaction, update } from 'firebase/database';
jest.mock('../src/services/firebase', () => ({
  auth: { currentUser: { uid: 'alice' } },
  database: {},
}));
jest.mock('firebase/database', () => ({
  ref: jest.fn((_db, path = '') => path),
  push: jest.fn(() => ({ key: 'message-key' })),
  serverTimestamp: jest.fn(() => ({ '.sv': 'timestamp' })),
  increment: jest.fn((n: number) => ({ '.sv': { increment: n } })),
  runTransaction: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
}));
beforeEach(() => jest.clearAllMocks());
const now = { '.sv': 'timestamp' };
test('both directions share one conversation id; blank text is not written', async () => {
  expect(directId('alice', 'bob')).toBe(directId('bob', 'alice'));
  await sendMessage('alice_bob', ['alice', 'bob'], { type: 'text', text: ' ' });
  expect(update).not.toHaveBeenCalled();
});
test('existing direct conversation is never overwritten', async () => {
  await ensureDirect('bob');
  const create = (runTransaction as jest.Mock).mock.calls[0][1];
  expect(create(null)).toMatchObject({
    type: 'direct',
    members: { alice: true, bob: true },
    createdBy: 'alice',
  });
  expect(create({ type: 'direct' })).toBeUndefined();
});
test('message, lastMessage and unread of every member go in one update', async () => {
  await sendMessage('g1', ['alice', 'bob', 'carol'], {
    type: 'text',
    text: '  hello  ',
  });
  expect(update).toHaveBeenCalledTimes(1);
  const writes = (update as jest.Mock).mock.calls[0][1];
  expect(writes['messages/g1/message-key']).toEqual({
    senderId: 'alice',
    type: 'text',
    text: 'hello',
    createdAt: now,
  });
  for (const member of ['alice', 'bob', 'carol']) {
    expect(writes[`userChats/${member}/g1/lastMessage`]).toBe('hello');
    expect(writes[`userChats/${member}/g1/lastMessageId`]).toBe('message-key');
  }
  expect(writes['userChats/bob/g1/unread']).toEqual({
    '.sv': { increment: 1 },
  });
  expect(writes['userChats/carol/g1/unread']).toEqual({
    '.sv': { increment: 1 },
  });
  expect(writes['userChats/alice/g1/unread']).toBeUndefined();
});
test('Home preview for image, location and recalled messages', () => {
  const location = buildSendUpdates('c', ['a', 'b'], 'k', 'a', {
    type: 'location',
    lat: 1,
    lng: 2,
  });
  expect(location['userChats/b/c/lastMessage']).toBe('📍 Vị trí');
  expect(previewOf({ type: 'image' })).toBe('📷 Hình ảnh');
  expect(previewOf({ type: 'text', text: 'x', recalled: true })).toBe(
    'Tin nhắn đã được thu hồi',
  );
});
test('opening a chat resets only my unread counter', async () => {
  await markRead('alice_bob', true);
  expect((update as jest.Mock).mock.calls[0][1]).toEqual({
    'readStatus/alice_bob/alice': now,
    'userChats/alice/alice_bob/unread': 0,
  });
});
test('recall keeps the node, drops content, and fixes Home if it was the last message', () => {
  const writes = buildRecallUpdates('c', 'm1', ['alice', 'bob'], true);
  expect(writes['messages/c/m1/recalled']).toBe(true);
  expect(writes['messages/c/m1/text']).toBeNull();
  expect(Object.keys(writes)).not.toContain('messages/c/m1');
  expect(writes['userChats/alice/c/lastMessage']).toBe(
    'Tin nhắn đã được thu hồi',
  );
  expect(writes['userChats/bob/c/lastMessage']).toBe(
    'Tin nhắn đã được thu hồi',
  );
  const older = buildRecallUpdates('c', 'm0', ['alice', 'bob'], false);
  expect(Object.keys(older).some(path => path.startsWith('userChats/'))).toBe(
    false,
  );
});
test('reactions are counted per emoji in a fixed order', () => {
  expect(countReactions({ a: '❤️', b: '👍', c: '❤️' })).toEqual([
    { emoji: '👍', count: 1 },
    { emoji: '❤️', count: 2 },
  ]);
  expect(countReactions(undefined)).toEqual([]);
});
test('a reply stores a short snapshot of the quoted message', () => {
  const quoted = replyRefOf({
    id: 'm0',
    senderId: 'bob',
    type: 'image',
  });
  expect(quoted).toEqual({ id: 'm0', senderId: 'bob', text: '📷 Hình ảnh' });
  const writes = buildSendUpdates(
    'c',
    ['alice', 'bob'],
    'm1',
    'alice',
    { type: 'text', text: 'Đẹp quá' },
    [],
    quoted,
  );
  expect(writes['messages/c/m1']).toMatchObject({ replyTo: quoted });
  expect(
    replyRefOf({ id: 'x', senderId: 'a', type: 'text', text: 'a'.repeat(500) })
      .text,
  ).toHaveLength(200);
});
