import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { ref, runTransaction, set } from 'firebase/database';
import { auth, database } from './firebase';
import { stopPresence } from './presenceService';

export async function login(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}
export async function register(name: string, email: string, password: string) {
  const { user } = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  await updateProfile(user, { displayName: name.trim() });
  await set(ref(database, `users/${user.uid}/name`), name.trim());
}
export async function ensureProfile() {
  const user = auth.currentUser;
  if (user) {
    await runTransaction(ref(database, `users/${user.uid}/name`), current =>
      current
        ? undefined
        : user.displayName || user.email?.split('@')[0] || 'Người dùng',
    );
  }
}
export async function logout() {
  // Removing presence may wait for a network reconnect; logout must still work offline.
  stopPresence().catch(() => {});
  await signOut(auth);
}
