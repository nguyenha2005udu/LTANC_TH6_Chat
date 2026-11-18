import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse',
});
export async function currentLocation(): Promise<{
  latitude: number;
  longitude: number;
}> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error(
        'Bạn đã từ chối quyền vị trí. Hãy bật quyền trong Cài đặt để gửi vị trí.',
      );
    }
  }
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      error =>
        reject(
          new Error(
            error.code === 1
              ? 'Bạn đã từ chối quyền vị trí. Hãy bật quyền trong Cài đặt.'
              : 'Không lấy được vị trí. Kiểm tra GPS và thử lại.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}
