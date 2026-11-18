import { seedDemoContacts, stopDemoSessions } from '../src/services/demo';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { get, update } from 'firebase/database';
jest.mock('../src/services/firebase', () => ({
  auth: { currentUser: { uid: 'owner' } },
}));
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  deleteApp: jest.fn(() => Promise.resolve()),
}));
jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(() => ({})),
  inMemoryPersistence: {},
  createUserWithEmailAndPassword: jest.fn((_auth, email: string) =>
    Promise.resolve({ user: { uid: email.split('@')[0] } }),
  ),
  updateProfile: jest.fn(() => Promise.resolve()),
  signInWithEmailAndPassword: jest.fn(),
}));
jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({})),
  ref: jest.fn((_db, path = '') => path),
  push: jest.fn(() => 'connection'),
  onValue: jest.fn(() => jest.fn()),
  set: jest.fn(() => Promise.resolve()),
  remove: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => ({ '.sv': 'timestamp' })),
  update: jest.fn(() => Promise.resolve()),
  runTransaction: jest.fn(() => Promise.resolve()),
  get: jest.fn(),
  increment: jest.fn((n: number) => ({ '.sv': { increment: n } })),
}));
afterEach(() => stopDemoSessions());
beforeEach(() => jest.clearAllMocks());
test('seeds three real profiles and six incoming messages for the current owner', async () => {
  (get as jest.Mock).mockResolvedValue({ val: () => null });
  await seedDemoContacts();
  expect(createUserWithEmailAndPassword).toHaveBeenCalledTimes(3);
  const writes = (update as jest.Mock).mock.calls.flatMap(call =>
    Object.entries(call[1]),
  );
  const messages = writes.filter(([path]) => path.startsWith('messages/'));
  expect(messages).toHaveLength(6);
  expect(
    messages.every(
      ([, message]) => (message as { senderId: string }).senderId !== 'owner',
    ),
  ).toBe(true);
  expect(
    writes.filter(([path]) => /^userChats\/owner\/.+\/unread$/.test(path)),
  ).toHaveLength(6);
});
test('repeated seeding never rewrites messages or unread counters', async () => {
  const existing = { '!demo-01': {}, '!demo-02': {}, '!demo-03': {} };
  (get as jest.Mock).mockResolvedValue({ val: () => existing });
  await seedDemoContacts();
  expect(update).not.toHaveBeenCalled();
});
