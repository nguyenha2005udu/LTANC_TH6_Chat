import { PermissionsAndroid, Platform } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { cloudinaryConfig, cloudinaryConfigured } from './cloudinaryConfig';

export const MAX_IMAGE_SIDE = 1024;
export type PickedImage = { uri: string; type: string; fileName: string };

const DENIED =
  'Bạn đã từ chối quyền camera. Hãy bật quyền Camera cho UDU Chat trong Cài đặt để chụp ảnh.';

async function cameraPermission() {
  if (Platform.OS !== 'android') {
    return; // iOS asks by itself using NSCameraUsageDescription.
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
  );
  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error(DENIED);
  }
}

/**
 * Takes or picks one photo. The picker itself scales it down so the long side
 * is at most 1024 px (aspect ratio kept) and re-encodes it as JPEG.
 * Resolves null when the user cancels.
 */
export async function pickImage(
  source: 'camera' | 'library',
): Promise<PickedImage | null> {
  const options = {
    mediaType: 'photo' as const,
    maxWidth: MAX_IMAGE_SIDE,
    maxHeight: MAX_IMAGE_SIDE,
    quality: 0.8 as const,
    selectionLimit: 1,
    saveToPhotos: false,
  };
  let response: ImagePickerResponse;
  if (source === 'camera') {
    await cameraPermission();
    response = await launchCamera(options);
  } else {
    response = await launchImageLibrary(options);
  }
  if (response.didCancel) {
    return null;
  }
  if (response.errorCode === 'permission') {
    throw new Error(
      source === 'camera'
        ? DENIED
        : 'Bạn đã từ chối quyền thư viện ảnh. Hãy bật quyền trong Cài đặt.',
    );
  }
  if (response.errorCode === 'camera_unavailable') {
    throw new Error('Thiết bị không có camera khả dụng.');
  }
  const asset = response.assets?.[0];
  if (response.errorCode || !asset?.uri) {
    throw new Error(response.errorMessage || 'Không lấy được ảnh.');
  }
  return {
    uri: asset.uri,
    type: asset.type || 'image/jpeg',
    fileName: asset.fileName || `photo-${Date.now()}.jpg`,
  };
}

/**
 * Unsigned upload to Cloudinary. Returns the HTTPS URL, which is the only
 * thing stored in Realtime Database.
 */
export async function uploadImage(
  image: PickedImage,
  timeoutMs = 60000,
): Promise<string> {
  if (!cloudinaryConfigured) {
    throw new Error(
      'Chưa cấu hình Cloudinary: cập nhật src/services/cloudinaryConfig.ts.',
    );
  }
  const body = new FormData();
  body.append('file', {
    uri: image.uri,
    type: image.type,
    name: image.fileName,
  } as unknown as Blob);
  body.append('upload_preset', cloudinaryConfig.uploadPreset);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
      { method: 'POST', body, signal: controller.signal },
    );
    const json = await response.json().catch(() => ({}));
    if (!response.ok || typeof json.secure_url !== 'string') {
      throw new Error(json?.error?.message || 'Tải ảnh lên thất bại.');
    }
    return json.secure_url;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Tải ảnh lên quá lâu. Kiểm tra mạng và thử lại.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
