# UDU Chat

Ứng dụng nhắn tin React Native CLI + TypeScript, dùng Firebase JS SDK
(Authentication + Realtime Database), Cloudinary để lưu ảnh và React Navigation.
Đây là phần phát triển tiếp của Bài thực hành 5.

Báo cáo Bài thực hành 6: [Nguyễn Thị Hà – B23DCCC057](docs/Bao-cao-TH6-UDUChat.docx).

## Tính năng

| Nhóm | Chức năng |
| --- | --- |
| Tài khoản | Đăng ký/đăng nhập Email + mật khẩu, đăng xuất |
| Home | Hội thoại 1-1 và nhóm, sắp xếp theo tin mới nhất, số chưa đọc riêng từng người, badge tổng ở tab |
| Danh bạ | Người dùng thật, chấm online/offline, tìm theo tên, mở chat 1-1 |
| Trạng thái | "đang soạn tin…" (tự tắt sau 3 giây, khi gửi, khi rời màn hình), "Đã gửi"/"Đã xem lúc …", "Hoạt động X phút trước" |
| Tin nhắn | Chữ, vị trí 📍 (mở Google Maps), ảnh 📷; tải 20 tin mỗi lần |
| Nhấn giữ tin | Sao chép, Thu hồi (tin của mình), thả cảm xúc 👍 ❤️ 😂 😮 😢 |
| Ảnh | Chụp hoặc chọn từ thư viện, thu nhỏ cạnh dài ≤ 1024px, bong bóng loading, nút "Thử lại", xem toàn màn hình |
| Nhóm | Tạo nhóm (tên + chọn ≥ 2 người), tên người gửi trên bong bóng, tiêu đề hiện số thành viên đang online |
| Thông báo | Dữ liệu thật từ `notifications/{uid}`, badge, nhấn để mở đúng chat, "Đánh dấu tất cả đã đọc" |

## 1. Cài đặt

Cần Node ≥ 22.11; Android Studio/SDK + JDK, hoặc macOS + Xcode + CocoaPods.

```sh
npm install
cd ios && bundle exec pod install && cd ..   # chỉ macOS/iOS
npm start
```

Terminal khác: `npm run android` hoặc `npm run ios`.

Android: đặt `ANDROID_HOME` hoặc `sdk.dir` trong `android/local.properties`
(file này không đưa vào Git). Nếu `pod install` báo lỗi *Unicode Normalization*,
chạy `export LANG=en_US.UTF-8` trước.

## 2. Cấu hình Firebase

1. Firebase Console → tạo project → thêm **Web app** để lấy cấu hình JS SDK
   (không cần `google-services.json` hay `GoogleService-Info.plist`).
2. Authentication → Sign-in method → bật **Email/Password**.
3. Tạo **Realtime Database**, sao chép đúng URL (có cả khu vực, ví dụ
   `asia-southeast1`).
4. Điền cấu hình vào `src/services/firebaseConfig.ts`.
5. Realtime Database → **Rules** → dán toàn bộ `database.rules.json` → **Publish**.
   Hoặc dùng Firebase CLI: `firebase deploy --only database --project <PROJECT_ID>`.

## 3. Cấu hình Cloudinary (gửi ảnh)

1. Đăng ký tại cloudinary.com, ghi lại **Cloud name** ở Dashboard.
2. Settings → Upload → **Upload presets** → *Add upload preset*:
   - Signing mode: **Unsigned**
   - (khuyến nghị) Folder: `uduchat`, Allowed formats: `jpg, png, heic, webp`,
     Max file size: 5 MB.
3. Điền vào `src/services/cloudinaryConfig.ts`:

   ```ts
   export const cloudinaryConfig = {
     cloudName: 'ten-cloud-cua-ban',
     uploadPreset: 'ten-unsigned-preset',
   };
   ```

**Không** đưa API Key/API Secret vào mã nguồn: ứng dụng chỉ dùng unsigned
preset. Ảnh được thu nhỏ trên máy (cạnh dài ≤ 1024px, JPEG 80%) rồi tải lên;
Realtime Database chỉ lưu URL `https://res.cloudinary.com/...`.

Quyền: Android khai báo `CAMERA` trong `AndroidManifest.xml` và xin quyền khi
nhấn Chụp ảnh; iOS dùng `NSCameraUsageDescription` và
`NSPhotoLibraryUsageDescription` trong `Info.plist`. Bị từ chối quyền thì ứng
dụng hiện thông báo hướng dẫn bật lại trong Cài đặt.

## 4. Cấu trúc dữ liệu

```text
users/{uid}                     { name }
presence/{uid}/{connectionId}   true            (xóa bằng onDisconnect)
lastSeen/{uid}                  timestamp       (ghi bằng onDisconnect)
conversations/{convId}          { type: "direct"|"group", name?, members: {uid: true}, createdBy, createdAt }
messages/{convId}/{msgId}       { senderId, type: "text"|"image"|"location", text?, imageUrl?, lat?, lng?,
                                  createdAt, recalled?, reactions?: {uid: "❤️"} }
userChats/{uid}/{convId}        { lastMessage, lastSenderId, lastMessageId, updatedAt, unread }
readStatus/{convId}/{uid}       thời điểm đọc cuối
typing/{convId}/{uid}           true            (xóa bằng onDisconnect)
viewing/{convId}/{uid}          true            (đang mở chat; xóa bằng onDisconnect)
notifications/{uid}/{id}        { type: "message"|"group_added"|"reaction", convId, fromUid, text, createdAt, read }
```

- `convId` của chat 1-1 = hai uid sắp xếp, nối bằng `_`; nhóm dùng push key.
- **Gửi tin** (`chatService.sendMessage`): tin nhắn, `lastMessage`,
  `lastSenderId`, `updatedAt` của **mọi** thành viên, `unread: increment(1)`
  của người nhận, `readStatus` của người gửi và thông báo cho người không mở chat
  nằm trong **một** lệnh `update()` nhiều đường dẫn. Không đọc số cũ rồi cộng.
- **Thu hồi**: đặt `recalled: true`, xóa nội dung, không xóa node. Nếu là tin
  cuối, `lastMessage` của mọi thành viên đổi thành "Tin nhắn đã được thu hồi"
  trong cùng lệnh.
- **Phân trang**: lần đầu `limitToLast(20)`, sau đó lắng nghe realtime từ khóa
  cũ nhất trở đi. Kéo lên đầu → `endBefore(khóa cũ nhất) + limitToLast(20)`.
  Danh sách dùng `FlatList inverted` nên không bị nhảy khi chèn tin cũ.
- Mọi listener (`onValue`, `AppState`, bộ đếm) được hủy trong cleanup của
  `useEffect`/`useFocusEffect`.

Mã Firebase/Cloudinary nằm trong `src/services/`: `authService`,
`chatService`, `groupService`, `uploadService`, `notificationService`,
`presenceService` (online, lastSeen, đang soạn tin, đang xem).

## 5. Luật bảo mật (`database.rules.json`)

| Yêu cầu | Luật |
| --- | --- |
| Chỉ thành viên đọc/ghi tin | `messages/$conv` `.read` và tạo `$msg` đều kiểm tra `conversations/$conv/members/auth.uid === true` |
| Không giả mạo người gửi | `senderId` khi tạo phải bằng `auth.uid`; `createdAt` gần `now` |
| Chỉ người gửi thu hồi | `recalled` chỉ ghi được khi `senderId === auth.uid`; nội dung chỉ được xóa kèm `recalled: true` |
| Cảm xúc của chính mình | `reactions/$uid` chỉ ghi khi `$uid === auth.uid`, chỉ 5 emoji, không vào tin đã thu hồi |
| Đang gõ của chính mình | `typing/$conv/$uid`, `viewing/$conv/$uid`, `readStatus/$conv/$uid` chỉ chủ ghi được |
| Số chưa đọc | Người khác chỉ tăng đúng +1; chủ chỉ đặt về 0 |
| Chat 1-1 hợp lệ | id phải chứa uid người tạo và người còn lại phải là thành viên; nhóm phải có tên và id dạng push key |
| Hộp thư | `userChats/$uid`, `notifications/$uid` chỉ chủ đọc; thông báo do người khác tạo phải có `fromUid === auth.uid`, cả hai cùng là thành viên; chủ chỉ đổi `read` thành `true` |
| Mặc định | Mọi đường dẫn khác bị từ chối (`.read/.write: false`) |

### Chứng minh một thao tác bị từ chối (Rules Playground)

Firebase Console → Realtime Database → Rules → **Rules Playground**:

1. *Simulation type*: `set`; *Location*: `/messages/<convId của A và B>/test1`;
   *Authenticated*: bật, *Provider* Password, *UID*: uid của người C.
2. Data: `{"senderId": "<uid C>", "type": "text", "text": "hack", "createdAt": {".sv": "timestamp"}}`
3. **Run** → *Simulated write denied* (C không phải thành viên).
4. Thử thêm: UID = A, Location `/messages/<convId>/<msgId của B>/recalled`,
   Data `true` → bị từ chối (A không phải người gửi).

## 6. Kiểm tra

```sh
npx tsc --noEmit
npm run lint
npm test -- --runInBand
```

Các test đơn vị kiểm tra: multi-path update + `increment(1)`, thu hồi, đếm cảm
xúc, bộ đếm 3 giây của "đang soạn tin", "Hoạt động X phút trước", thu nhỏ ảnh,
upload unsigned không chứa secret, tạo nhóm và thông báo.

### Kịch bản quay video (3 máy, hoặc 2 máy và đổi tài khoản)

1. A tạo nhóm với B và C → B, C nhận thông báo "đã thêm bạn vào nhóm", badge tăng.
2. A gõ: B thấy "A đang soạn tin…"; A dừng 3 giây hoặc gửi → mất.
3. A gửi tin: B, C thấy ngay, tên "A" phía trên bong bóng; Home của B, C tăng
   số chưa đọc. B mở nhóm → số chưa đọc của B về 0; A thấy "Đã xem bởi B".
4. Chat 1-1 A–B: B mở chat → A thấy "Đã xem lúc …". Tắt app B → A thấy
   "Vừa mới hoạt động", sau vài phút "Hoạt động X phút trước".
5. A gửi ảnh (thấy bong bóng loading), nhấn ảnh xem toàn màn hình; tắt mạng để
   thấy nút "Thử lại". Home hiện "📷 Hình ảnh".
6. A thu hồi tin cuối → mọi máy và Home hiện "Tin nhắn đã được thu hồi".
7. B thả ❤️ vào tin của A → A nhận thông báo; nhấn vào mở đúng chat; "Đánh dấu
   tất cả đã đọc" đưa badge về 0.

## Phần C – Nâng cao

- **Quản trị nhóm** (nhấn tiêu đề nhóm → Thông tin nhóm): đổi tên, thêm thành
  viên, quản trị viên (người tạo) xóa thành viên, rời nhóm. Mỗi thao tác ghi
  một tin hệ thống, ví dụ "A đã rời nhóm".
- **Trả lời tin**: nhấn giữ → Trả lời. Tin lưu `replyTo: {id, senderId, text}`;
  nhấn phần trích dẫn để cuộn tới tin gốc (tự tải trang cũ nếu cần).
- **Hồ sơ cá nhân** (tab Cài đặt): nhấn ảnh để đổi ảnh đại diện (Cloudinary,
  lưu `users/{uid}/avatar`), nhấn tên để đổi họ tên. Danh bạ, Home, Chat cập
  nhật ngay.
- **Thông báo cục bộ** (`@notifee/react-native`): khi ứng dụng ở nền, mỗi mục
  mới trong `notifications/{uid}` hiện thành thông báo hệ thống; nhấn vào mở
  đúng cuộc trò chuyện. Android 13+ và iOS sẽ hỏi quyền thông báo lần đầu.
  Giới hạn: đây là thông báo cục bộ, chỉ hiện khi tiến trình JS còn chạy
  (Android giữ lâu hơn, iOS tạm dừng ứng dụng sau ít giây ở nền). Muốn nhận khi
  ứng dụng đã tắt hẳn cần thêm FCM/APNs (ngoài phạm vi bài).
- **Tìm kiếm tin nhắn** (🔍 trên tiêu đề chat): không phân biệt hoa thường và
  dấu tiếng Việt ("ha noi" tìm được "Hà Nội"), bỏ qua tin đã thu hồi, tô vàng
  phần khớp; nhấn kết quả để cuộn tới tin. Realtime Database không có tìm kiếm
  toàn văn nên ứng dụng đọc tin của cuộc trò chuyện một lần (chỉ thành viên mới
  đọc được) rồi lọc trên máy.

## Hội thoại demo

Khi đăng nhập, ứng dụng tự tạo (nếu chưa có) hội thoại với ba tài khoản demo.
Khởi tạo lại không ghi đè tin, số chưa đọc hay mốc đã đọc.

| Họ tên | Email | Mật khẩu |
| --- | --- | --- |
| Minh Anh | demo.minhanh@uduchat.example | UduDemo@123456 |
| Hoàng Nam | demo.hoangnam@uduchat.example | UduDemo@123456 |
| Linh Nguyễn | demo.linh@uduchat.example | UduDemo@123456 |

Dữ liệu cũ của Bài 5 (`rooms`, `userRooms`) không còn được dùng và bị rules từ
chối; có thể xóa trong Firebase Console.
