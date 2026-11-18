// Kiểm tra Security Rules trên Realtime Database thật bằng tài khoản demo.
// Chạy: node scripts/rules-check.mjs
// Mỗi thao tác "phải bị từ chối" in ra PERMISSION_DENIED nếu rules đúng.
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  get,
  getDatabase,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';

const source = readFileSync(
  new URL('../src/services/firebaseConfig.ts', import.meta.url),
  'utf8',
);
const field = name =>
  source.match(new RegExp(`${name}:\\s*'([^']+)'`, 'm'))?.[1];
const config = {
  apiKey: field('apiKey'),
  authDomain: field('authDomain'),
  databaseURL: field('databaseURL'),
  projectId: field('projectId'),
  appId: field('appId'),
};
const PASSWORD = 'UduDemo@123456';

async function login(email) {
  const app = initializeApp(config, email);
  const user = (await signInWithEmailAndPassword(getAuth(app), email, PASSWORD))
    .user;
  return { uid: user.uid, db: getDatabase(app) };
}

let failures = 0;
async function expect(label, shouldPass, action) {
  try {
    await action();
    const ok = shouldPass;
    if (!ok) failures++;
    console.log(`${ok ? '✅' : '❌'} ${label}\n     → ĐƯỢC PHÉP`);
  } catch (error) {
    const ok = !shouldPass;
    if (!ok) failures++;
    console.log(
      `${ok ? '✅' : '❌'} ${label}\n     → ${error.code || ''} ${error.message}`,
    );
  }
}

const linh = await login('demo.linh@uduchat.example');
const minh = await login('demo.minhanh@uduchat.example');
const nam = await login('demo.hoangnam@uduchat.example');
console.log(`Linh=${linh.uid}\nMinh Anh=${minh.uid}\nHoàng Nam=${nam.uid}\n`);

// Chat demo Linh – Minh Anh (tạo nếu chưa có) + một tin của Minh Anh, để thử
// thu hồi / gõ / cảm xúc trên tin của NGƯỜI KHÁC.
const convId = [linh.uid, minh.uid].sort().join('_');
const other = minh.uid;
const convRef = ref(linh.db, `conversations/${convId}`);
if (!(await get(convRef)).exists()) {
  await set(convRef, {
    type: 'direct',
    members: { [linh.uid]: true, [minh.uid]: true },
    createdBy: linh.uid,
    createdAt: Date.now(),
  });
}
const othersMsg = push(ref(minh.db, `messages/${convId}`)).key;
await set(ref(minh.db, `messages/${convId}/${othersMsg}`), {
  senderId: minh.uid,
  type: 'text',
  text: 'Tin kiểm tra rules (Minh Anh gửi)',
  createdAt: serverTimestamp(),
});
// Cuộc trò chuyện Minh Anh – Hoàng Nam: Linh KHÔNG phải thành viên.
const foreign = [minh.uid, nam.uid].sort().join('_');

console.log('--- 1. Chỉ thành viên mới đọc/ghi tin nhắn ---');
await expect(`Linh ghi tin vào /messages/${foreign}`, false, () =>
  set(ref(linh.db, `messages/${foreign}/hack1`), {
    senderId: linh.uid,
    type: 'text',
    text: 'hack',
    createdAt: Date.now(),
  }),
);
if (convId) {
  await expect(`Linh đọc tin của nhóm/chat mình tham gia (${convId})`, true, () =>
    get(ref(linh.db, `messages/${convId}`)),
  );
  await expect('Linh gửi tin giả danh người khác (senderId ≠ mình)', false, () =>
    set(ref(linh.db, `messages/${convId}/fake1`), {
      senderId: other,
      type: 'text',
      text: 'giả mạo',
      createdAt: Date.now(),
    }),
  );
}
await expect(`Linh đọc hộp thư /userChats/${minh.uid} của Minh Anh`, false, () =>
  get(ref(linh.db, `userChats/${minh.uid}`)),
);

console.log('\n--- 2. Chỉ người gửi mới thu hồi được ---');
if (convId && othersMsg) {
  await expect(
    `Linh thu hồi tin ${othersMsg} của người khác (recalled = true)`,
    false,
    () => set(ref(linh.db, `messages/${convId}/${othersMsg}/recalled`), true),
  );
  await expect('Minh Anh thu hồi tin của CHÍNH MÌNH', true, () =>
    update(ref(minh.db, `messages/${convId}/${othersMsg}`), {
      recalled: true,
      text: null,
    }),
  );
} else {
  console.log('(bỏ qua: không tìm thấy tin của người khác)');
}

console.log('\n--- 3. Chỉ ghi trạng thái gõ / cảm xúc của chính mình ---');
if (convId && other) {
  await expect('Linh bật "đang soạn tin" của chính mình', true, async () => {
    await set(ref(linh.db, `typing/${convId}/${linh.uid}`), true);
    await remove(ref(linh.db, `typing/${convId}/${linh.uid}`));
  });
  await expect('Linh bật "đang soạn tin" thay người khác', false, () =>
    set(ref(linh.db, `typing/${convId}/${other}`), true),
  );
  if (othersMsg) {
    await expect('Linh thả cảm xúc thay người khác', false, () =>
      set(
        ref(linh.db, `messages/${convId}/${othersMsg}/reactions/${other}`),
        '❤️',
      ),
    );
  }
} else {
  console.log('(bỏ qua: Linh chưa có cuộc trò chuyện nào — hãy đăng nhập app một lần)');
}

console.log(
  failures
    ? `\n❌ ${failures} kết quả sai: rules trên Console có thể chưa phải bản mới.`
    : '\n✅ Mọi kết quả đúng như rules mong đợi.',
);
process.exit(failures ? 1 : 0);
