import notifee from '@notifee/react-native';
import {
  newForBanner,
  onNotificationOpen,
  showLocalNotification,
} from '../src/services/localNotificationService';
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    displayNotification: jest.fn(() => Promise.resolve()),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    onForegroundEvent: jest.fn(() => jest.fn()),
    onBackgroundEvent: jest.fn(),
    cancelNotification: jest.fn(() => Promise.resolve()),
  },
  AndroidImportance: { HIGH: 4 },
  EventType: { PRESS: 1 },
}));
const item = (id: string, read = false) => ({
  id,
  type: 'message' as const,
  convId: 'c1',
  fromUid: 'bob',
  text: 'Chào',
  createdAt: 1,
  read,
});
beforeEach(() => jest.clearAllMocks());
test('only new, unread items get a banner, and only in the background', () => {
  const seen = new Set(['old']);
  expect(newForBanner([item('old'), item('n1')], seen, true)).toEqual([]);
  // n1 arrived while in the foreground: never shown later.
  expect(newForBanner([item('n1')], seen, false)).toEqual([]);
  const shown = newForBanner(
    [item('n1'), item('n2'), item('n3', true)],
    seen,
    false,
  );
  expect(shown.map(n => n.id)).toEqual(['n2']);
});
test('banner carries the conversation so a tap opens the right chat', async () => {
  await showLocalNotification(item('n2'), 'Bob', 'Chào', 'bob');
  expect(notifee.displayNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'n2',
      title: 'Bob',
      data: { notificationId: 'n2', convId: 'c1', peerId: 'bob' },
    }),
  );
});
test('pressing a banner calls the open handler', () => {
  const open = jest.fn();
  const stop = onNotificationOpen(open);
  const handler = (notifee.onForegroundEvent as jest.Mock).mock.calls[0][0];
  handler({
    type: 1,
    detail: {
      notification: {
        data: { notificationId: 'n2', convId: 'c1', peerId: '' },
      },
    },
  });
  expect(open).toHaveBeenCalledWith({
    notificationId: 'n2',
    convId: 'c1',
    peerId: undefined,
  });
  stop();
});
