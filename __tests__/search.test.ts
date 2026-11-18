import {
  findMatch,
  fold,
  matchMessages,
  searchMessages,
} from '../src/services/searchService';
import { get } from 'firebase/database';
jest.mock('../src/services/firebase', () => ({ database: {} }));
jest.mock('firebase/database', () => ({
  ref: jest.fn((_db, path = '') => path),
  get: jest.fn(),
}));
const msg = (text: string, extra = {}) => ({
  senderId: 'bob',
  type: 'text' as const,
  text,
  createdAt: 1,
  ...extra,
});
test('search ignores case and Vietnamese tone marks', () => {
  expect(fold('Đường Phố HÀ NỘI')).toBe('duong pho ha noi');
  const text = 'Hẹn bạn ở Hà Nội nhé';
  const match = findMatch(text, 'ha noi');
  expect(match).not.toBeNull();
  expect(text.slice(...match!)).toBe('Hà Nội');
  expect(findMatch(text, 'sài gòn')).toBeNull();
  expect(findMatch(text, '   ')).toBeNull();
});
test('only text messages that are not recalled are found, newest first', () => {
  const hits = matchMessages(
    {
      a: msg('Bài thực hành'),
      b: msg('bài tập', { recalled: true }),
      c: { senderId: 'bob', type: 'image', imageUrl: 'x', createdAt: 2 },
      d: msg('Nộp BÀI chưa?'),
    },
    'bai',
  );
  expect(hits.map(hit => hit.id)).toEqual(['d', 'a']);
});
test('reads the conversation once and filters on the device', async () => {
  (get as jest.Mock).mockResolvedValue({
    val: () => ({ m1: msg('xin chào') }),
  });
  await expect(searchMessages('c1', 'chao')).resolves.toHaveLength(1);
  expect(get).toHaveBeenCalledWith('messages/c1');
  (get as jest.Mock).mockClear();
  await expect(searchMessages('c1', ' ')).resolves.toEqual([]);
  expect(get).not.toHaveBeenCalled();
});
