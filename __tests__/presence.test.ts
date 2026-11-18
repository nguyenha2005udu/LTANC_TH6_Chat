import {
  createTypingController,
  TYPING_TIMEOUT,
} from '../src/services/presenceService';
import { lastSeenText } from '../src/services/summaries';
import { onDisconnect, remove, set } from 'firebase/database';
jest.mock('../src/services/firebase', () => ({ database: {} }));
const mockDisconnectRemove = jest.fn(() => Promise.resolve());
jest.mock('firebase/database', () => ({
  ref: jest.fn((_db, path = '') => path),
  onDisconnect: jest.fn(() => ({ remove: mockDisconnectRemove })),
  set: jest.fn(() => Promise.resolve()),
  remove: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-native', () => ({ AppState: {} }));
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
beforeEach(() => jest.clearAllMocks());
test('typing flag is guarded by onDisconnect and turns off after 3 s idle', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  const typing = createTypingController('c1', 'alice', jest.fn());
  typing.keystroke('h');
  typing.keystroke('he');
  await flush();
  expect(onDisconnect).toHaveBeenCalledTimes(1);
  expect(mockDisconnectRemove).toHaveBeenCalledTimes(1);
  expect(set).toHaveBeenCalledWith('typing/c1/alice', true);
  jest.advanceTimersByTime(TYPING_TIMEOUT - 1);
  expect(remove).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(remove).toHaveBeenCalledWith('typing/c1/alice');
  jest.useRealTimers();
});
test('sending (stop) or clearing the text removes the flag at once', async () => {
  const typing = createTypingController('c1', 'alice', jest.fn());
  typing.keystroke('hi');
  await flush();
  typing.stop();
  expect(remove).toHaveBeenCalledTimes(1);
  typing.keystroke('x');
  await flush();
  typing.keystroke('  ');
  expect(remove).toHaveBeenCalledTimes(2);
});
test('last active text', () => {
  const now = 10 * 24 * 3600000;
  expect(lastSeenText(null, now)).toBe('Ngoại tuyến');
  expect(lastSeenText(now - 20000, now)).toBe('Vừa mới hoạt động');
  expect(lastSeenText(now - 5 * 60000, now)).toBe('Hoạt động 5 phút trước');
  expect(lastSeenText(now - 3 * 3600000, now)).toBe('Hoạt động 3 giờ trước');
  expect(lastSeenText(now - 2 * 86400000, now)).toBe('Hoạt động 2 ngày trước');
});
