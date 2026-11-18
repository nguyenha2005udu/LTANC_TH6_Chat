import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  initializeAuth,
  inMemoryPersistence,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { get, getDatabase, ref, set, update } from 'firebase/database';
import { auth } from './firebase';
import { firebaseConfig } from './firebaseConfig';
import { buildSendUpdates, ensureDirectAs } from './chatService';

export const demoPassword = 'UduDemo@123456';
const people = [
  {
    name: 'Minh Anh',
    email: 'demo.minhanh@uduchat.example',
    texts: ['Chào bạn! Mình là Minh Anh.', 'Bạn đã thử gửi vị trí chưa? 📍'],
  },
  {
    name: 'Hoàng Nam',
    email: 'demo.hoangnam@uduchat.example',
    texts: [
      'Chào bạn, mình là Nam.',
      'Chiều nay cùng làm bài thực hành nhé.',
      'Khi nào rảnh nhắn mình nha!',
    ],
  },
  {
    name: 'Linh Nguyễn',
    email: 'demo.linh@uduchat.example',
    texts: ['Xin chào! Hẹn bạn cuối tuần nhé.'],
  },
];
let generation = 0;
export function stopDemoSessions() {
  generation++;
}

// Uses secondary Auth instances, so creating demo users never changes the real session.
export async function seedDemoContacts() {
  const owner = auth.currentUser;
  if (!owner) {
    throw new Error('Bạn cần đăng nhập trước.');
  }
  stopDemoSessions();
  const ticket = generation;
  for (const person of people) {
    if (ticket !== generation || auth.currentUser?.uid !== owner.uid) {
      return;
    }
    const app = initializeApp(
      firebaseConfig,
      `demo-${Date.now()}-${person.email}`,
    );
    try {
      const demoAuth = initializeAuth(app, {
        persistence: inMemoryPersistence,
      });
      let user;
      try {
        ({ user } = await createUserWithEmailAndPassword(
          demoAuth,
          person.email,
          demoPassword,
        ));
      } catch (e) {
        if ((e as { code?: string }).code !== 'auth/email-already-in-use') {
          throw e;
        }
        ({ user } = await signInWithEmailAndPassword(
          demoAuth,
          person.email,
          demoPassword,
        ));
      }
      const db = getDatabase(app);
      await updateProfile(user, { displayName: person.name });
      await set(ref(db, `users/${user.uid}/name`), person.name);
      if (user.uid !== owner.uid) {
        const id = await ensureDirectAs(user.uid, owner.uid, db);
        // Fixed keys make repeated initialization safe: existing messages,
        // unread counters and read status are never touched again.
        const existing = (await get(ref(db, `messages/${id}`))).val() || {};
        const members = [owner.uid, user.uid];
        for (const [index, text] of person.texts.entries()) {
          const key = `!demo-0${index + 1}`;
          if (!existing[key]) {
            await update(
              ref(db),
              buildSendUpdates(id, members, key, user.uid, {
                type: 'text',
                text,
              }),
            );
          }
        }
      }
      if (ticket !== generation || auth.currentUser?.uid !== owner.uid) {
        return;
      }
    } finally {
      await deleteApp(app);
    }
  }
}
