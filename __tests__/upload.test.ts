import { PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import {
  MAX_IMAGE_SIDE,
  pickImage,
  uploadImage,
} from '../src/services/uploadService';
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
jest.mock('../src/services/cloudinaryConfig', () => ({
  cloudinaryConfig: { cloudName: 'demo-cloud', uploadPreset: 'unsigned_chat' },
  cloudinaryConfigured: true,
}));
const image = { uri: 'file:///a.jpg', type: 'image/jpeg', fileName: 'a.jpg' };
beforeEach(() => jest.clearAllMocks());
// Works with both React Native's FormData (getParts) and Node's (entries).
function formFields(body: any): Record<string, unknown> {
  if (typeof body.getParts === 'function') {
    return Object.fromEntries(
      body
        .getParts()
        .map((part: { fieldName: string; string?: string }) => [
          part.fieldName,
          part.string ?? part,
        ]),
    );
  }
  return Object.fromEntries(body.entries());
}
test('picker scales the photo so the long side is at most 1024 px', async () => {
  (launchImageLibrary as jest.Mock).mockResolvedValue({
    assets: [{ uri: 'file:///b.jpg', type: 'image/jpeg', fileName: 'b.jpg' }],
  });
  await expect(pickImage('library')).resolves.toMatchObject({
    uri: 'file:///b.jpg',
  });
  expect((launchImageLibrary as jest.Mock).mock.calls[0][0]).toMatchObject({
    maxWidth: MAX_IMAGE_SIDE,
    maxHeight: MAX_IMAGE_SIDE,
  });
  (launchImageLibrary as jest.Mock).mockResolvedValue({ didCancel: true });
  await expect(pickImage('library')).resolves.toBeNull();
});
test('denied camera permission shows a message and never opens the camera', async () => {
  Platform.OS = 'android';
  jest
    .spyOn(PermissionsAndroid, 'request')
    .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
  await expect(pickImage('camera')).rejects.toThrow('từ chối quyền camera');
  expect(launchCamera).not.toHaveBeenCalled();
});
test('unsigned upload sends only the preset and returns the secure URL', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({ secure_url: 'https://res.cloudinary.com/x/a.jpg' }),
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await expect(uploadImage(image)).resolves.toBe(
    'https://res.cloudinary.com/x/a.jpg',
  );
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.cloudinary.com/v1_1/demo-cloud/image/upload');
  const fields = formFields(init.body);
  expect(fields.upload_preset).toBe('unsigned_chat');
  expect(fields).not.toHaveProperty('api_secret');
  expect(fields).not.toHaveProperty('api_key');
});
test('failed upload rejects so the bubble can offer "Thử lại"', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: () =>
      Promise.resolve({ error: { message: 'Upload preset not found' } }),
  }) as unknown as typeof fetch;
  await expect(uploadImage(image)).rejects.toThrow('Upload preset not found');
});
