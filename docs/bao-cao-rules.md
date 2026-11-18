# Báo cáo: Luật bảo mật Realtime Database – UDU Chat

**Nguyên tắc chung.** Gốc cơ sở dữ liệu đặt `.read: false`, `.write: false`.
Mỗi nhánh chỉ mở đúng quyền cần thiết, và mọi quyền đều yêu cầu đã đăng nhập
(`auth != null`). Quyền thành viên luôn được kiểm tra tại
`conversations/{convId}/members/{auth.uid} === true`, vì vậy biết `convId`
cũng không đủ để đọc.

## 1. Chỉ thành viên mới đọc và ghi được tin nhắn
- `messages/$conv/.read`: người đọc phải là thành viên của `$conv`.
- `messages/$conv/$msg/.write`: chỉ thành viên mới tạo được tin, và chỉ tạo
  khi tin chưa tồn tại (`!data.exists()`). Vì vậy không ai sửa được nội dung
  tin cũ.
- `.validate`:
  - `senderId` khi tạo phải bằng `auth.uid`, nên không thể giả mạo người gửi.
  - `type` chỉ là `text`, `image`, `location` hoặc `system` (tin hệ thống như "A đã rời nhóm"). Tin chữ dài 1–2000 ký tự.
  - `imageUrl` phải bắt đầu bằng `https://res.cloudinary.com/`.
  - `lat`/`lng` phải nằm trong miền hợp lệ.
  - `createdAt` phải gần thời gian máy chủ (`now`).
  - Mọi trường khác (`$other`) bị từ chối.
- Hai nhánh `typing` và `readStatus` cũng chỉ thành viên mới đọc được.

## 2. Chỉ người gửi mới được thu hồi tin của mình
- `messages/$conv/$msg/recalled/.write` yêu cầu
  `data.parent().child('senderId').val() === auth.uid`, và giá trị ghi vào chỉ
  được là `true`.
- Các trường `text`, `imageUrl`, `lat`, `lng`, `reactions` chỉ được **xóa**, và
  chỉ do người gửi xóa trong cùng thao tác có `recalled === true`. Node tin nhắn
  không bao giờ bị xóa.

## 3. Mỗi người chỉ ghi trạng thái của chính mình
- `typing/$conv/$uid`, `viewing/$conv/$uid`, `readStatus/$conv/$uid`,
  `lastSeen/$uid`, `presence/$uid` đều yêu cầu `auth.uid === $uid`.
  - `typing` và `viewing` chỉ nhận giá trị `true`.
  - `readStatus` và `lastSeen` phải là số và không vượt quá `now`.
- `messages/.../reactions/$uid`: chỉ ghi được khi `$uid === auth.uid`, giá trị
  chỉ là một trong 👍 ❤️ 😂 😮 😢, và tin chưa bị thu hồi.

## 4. Hộp thư và số chưa đọc
- `userChats/$uid` và `notifications/$uid`: chỉ chủ đọc được.
- `userChats/$uid/$conv`: người ghi và chủ hộp thư đều phải là thành viên.
  - `unread` của người khác chỉ được tăng đúng 1, khớp với `increment(1)`.
  - Chủ chỉ được đặt `unread` của mình về 0.
- `notifications/$uid/$id`:
  - Người tạo phải là người khác, có `fromUid === auth.uid`, và cả hai cùng là
    thành viên của `convId` ghi trong thông báo.
  - Chủ chỉ được đổi `read` thành `true`.
- `conversations`:
  - Không ai ghi đè được cuộc trò chuyện đã có.
  - Chat 1-1 phải có id chứa uid người tạo, và người còn lại phải là thành viên.
  - Nhóm phải có tên và id dạng push key. Nhờ vậy không ai chiếm trước được id
    chat 1-1 của người khác.

## 5. Chứng minh thao tác bị từ chối
Thao tác thử: người dùng **C** (không thuộc cuộc trò chuyện A–B) ghi tin vào
`/messages/{A_B}/test1` với `senderId = C`.

> *(Dán ảnh chụp Rules Playground: "Simulated write denied", dòng luật
> `messages/$conv/$msg/.write` được tô đỏ — hoặc ảnh lỗi `PERMISSION_DENIED`
> trong ứng dụng.)*

**Giải thích:** luật `.write` tại `messages/$conv/$msg` trả về `false`, vì
`root.child('conversations').child('A_B').child('members').child('C')` không
tồn tại.

Thao tác thứ hai: **A** đặt `recalled = true` cho một tin của **B**. Lệnh này
cũng bị từ chối vì `senderId` của tin là B, không phải `auth.uid`.

### Kết quả chạy thật trên Firebase (`node scripts/rules-check.mjs`)

Script đăng nhập 3 tài khoản demo và thử từng thao tác trên database thật
(kết quả đầy đủ: `docs/rules-check-ketqua.txt`):

| Thao tác | Kết quả |
| --- | --- |
| Linh ghi tin vào chat Minh Anh – Hoàng Nam | PERMISSION_DENIED |
| Linh gửi tin với `senderId` của người khác | PERMISSION_DENIED |
| Linh đọc `userChats` của Minh Anh | PERMISSION_DENIED |
| Linh thu hồi tin của Minh Anh | PERMISSION_DENIED |
| Minh Anh thu hồi tin của chính mình | Được phép |
| Linh bật "đang soạn tin" của chính mình | Được phép |
| Linh bật "đang soạn tin" thay Minh Anh | PERMISSION_DENIED |
| Linh thả cảm xúc thay Minh Anh | PERMISSION_DENIED |
