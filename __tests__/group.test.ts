import {
  addMembers,
  createGroup,
  leaveGroup,
  removeMember,
  renameGroup,
  validateGroup,
} from '../src/services/groupService';
import { set, update } from 'firebase/database';
jest.mock('../src/services/firebase', () => ({
  auth: { currentUser: { uid: 'alice' } },
  database: {},
}));
jest.mock('firebase/database', () => ({
  ref: jest.fn((_db, path = '') => path),
  push: jest.fn(() => ({ key: 'group-1' })),
  serverTimestamp: jest.fn(() => ({ '.sv': 'timestamp' })),
  increment: jest.fn(),
  set: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
}));
beforeEach(() => jest.clearAllMocks());
test('a group needs a name and at least 2 people besides me', async () => {
  expect(validateGroup('  ', ['bob', 'carol'])).toContain('tên nhóm');
  expect(validateGroup('Nhóm', ['bob'])).toContain('ít nhất 2');
  expect(validateGroup('Nhóm', ['bob', 'carol'])).toBeNull();
  // Selecting myself does not count toward the minimum.
  await expect(createGroup('Nhóm', ['alice', 'bob'], 'Alice')).rejects.toThrow(
    'ít nhất 2',
  );
  expect(set).not.toHaveBeenCalled();
});
test('creates the conversation, then every member inbox in one update', async () => {
  await expect(
    createGroup(' Lớp RN ', ['bob', 'carol', 'bob'], 'Alice'),
  ).resolves.toBe('group-1');
  expect(set).toHaveBeenCalledWith(
    'conversations/group-1',
    expect.objectContaining({
      type: 'group',
      name: 'Lớp RN',
      members: { alice: true, bob: true, carol: true },
      createdBy: 'alice',
    }),
  );
  expect(update).toHaveBeenCalledTimes(1);
  const writes = (update as jest.Mock).mock.calls[0][1];
  for (const member of ['alice', 'bob', 'carol']) {
    expect(writes[`userChats/${member}/group-1/lastMessage`]).toBe(
      'Alice đã tạo nhóm',
    );
  }
});
test('members added to a group are notified (but not the creator)', async () => {
  await createGroup('Lớp RN', ['bob', 'carol'], 'Alice');
  const writes = (update as jest.Mock).mock.calls[0][1];
  expect(writes['notifications/bob/g_group-1']).toMatchObject({
    type: 'group_added',
    convId: 'group-1',
    fromUid: 'alice',
  });
  expect(writes['notifications/carol/g_group-1']).toBeDefined();
  expect(writes['notifications/alice/g_group-1']).toBeUndefined();
});
describe('group admin', () => {
  const members = ['alice', 'bob', 'carol'];
  const calls = () => (update as jest.Mock).mock.calls.map(call => call[1]);
  test('rename writes the name and a system line together, without unread or notifications', async () => {
    await renameGroup('g', members, ' Nhóm mới ', 'Alice');
    expect(update).toHaveBeenCalledTimes(1);
    const [writes] = calls();
    expect(writes['conversations/g/name']).toBe('Nhóm mới');
    expect(writes['messages/g/group-1']).toMatchObject({
      type: 'system',
      text: 'Alice đã đổi tên nhóm thành "Nhóm mới"',
    });
    expect(writes['userChats/bob/g/lastSenderId']).toBeNull();
    expect(Object.keys(writes).some(p => p.endsWith('/unread'))).toBe(false);
    expect(Object.keys(writes).some(p => p.startsWith('notifications/'))).toBe(
      false,
    );
  });
  test('adding: membership first, then system line + "added" notification', async () => {
    await addMembers(
      'g',
      'Lớp',
      members,
      [
        { id: 'dan', name: 'Dân' },
        { id: 'bob', name: 'Bob' },
      ],
      'Alice',
    );
    const [first, second] = calls();
    expect(first).toEqual({ 'conversations/g/members/dan': true });
    expect(second['messages/g/group-1']).toMatchObject({
      text: 'Alice đã thêm Dân vào nhóm',
    });
    expect(second['userChats/dan/g/lastMessage']).toBeDefined();
    expect(second['notifications/dan/g_group-1']).toMatchObject({
      type: 'group_added',
    });
    expect(second['notifications/bob/g_group-1']).toBeUndefined();
  });
  test('leaving posts "A đã rời nhóm" to the others, then removes me', async () => {
    await leaveGroup('g', members, 'Alice');
    const [line, exit] = calls();
    expect(line['messages/g/group-1']).toMatchObject({
      type: 'system',
      text: 'Alice đã rời nhóm',
    });
    expect(line['userChats/alice/g/lastMessage']).toBeUndefined();
    expect(exit).toEqual({
      'conversations/g/members/alice': null,
      'userChats/alice/g': null,
      'typing/g/alice': null,
      'viewing/g/alice': null,
    });
  });
  test('admin removing someone never touches their typing/viewing', async () => {
    await removeMember('g', members, { id: 'bob', name: 'Bob' }, 'Alice');
    const [line, exit] = calls();
    expect(line['messages/g/group-1']).toMatchObject({
      text: 'Alice đã xóa Bob khỏi nhóm',
    });
    expect(exit).toEqual({
      'conversations/g/members/bob': null,
      'userChats/bob/g': null,
    });
  });
});
