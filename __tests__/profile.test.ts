import {
  avatarThumb,
  updateAvatar,
  updateName,
} from '../src/services/profileService';
import { uploadImage } from '../src/services/uploadService';
import { updateProfile } from 'firebase/auth';
import { set } from 'firebase/database';
jest.mock('../src/services/firebase', () => ({
  auth: { currentUser: { uid: 'alice' } },
  database: {},
}));
jest.mock('../src/services/uploadService', () => ({
  uploadImage: jest.fn(() =>
    Promise.resolve('https://res.cloudinary.com/demo/image/upload/v1/a.jpg'),
  ),
}));
jest.mock('firebase/auth', () => ({
  updateProfile: jest.fn(() => Promise.resolve()),
}));
jest.mock('firebase/database', () => ({
  ref: jest.fn((_db, path = '') => path),
  set: jest.fn(() => Promise.resolve()),
}));
beforeEach(() => jest.clearAllMocks());
test('name change updates the public profile and the Auth display name', async () => {
  await expect(updateName('   ')).rejects.toThrow('Họ tên');
  await updateName('  Hà Nguyễn ');
  expect(set).toHaveBeenCalledWith('users/alice/name', 'Hà Nguyễn');
  expect(updateProfile).toHaveBeenCalledWith(
    { uid: 'alice' },
    { displayName: 'Hà Nguyễn' },
  );
});
test('new avatar is uploaded to Cloudinary and only its URL is stored', async () => {
  const image = {
    uri: 'file:///me.jpg',
    type: 'image/jpeg',
    fileName: 'me.jpg',
  };
  await updateAvatar(image);
  expect(uploadImage).toHaveBeenCalledWith(image);
  expect(set).toHaveBeenCalledWith(
    'users/alice/avatar',
    'https://res.cloudinary.com/demo/image/upload/v1/a.jpg',
  );
});
test('avatar thumbnails are cropped by Cloudinary', () => {
  expect(
    avatarThumb('https://res.cloudinary.com/demo/image/upload/v1/a.jpg', 100),
  ).toBe(
    'https://res.cloudinary.com/demo/image/upload/c_fill,g_face,w_100,h_100,q_auto/v1/a.jpg',
  );
});
