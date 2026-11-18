import { get, ref } from 'firebase/database';
import { database } from './firebase';
import type { WireMessage } from '../types';

/** One character, lower-cased, without Vietnamese tone marks ("Đ" → "d"). */
function foldChar(char: string) {
  return char
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}
export function fold(text: string) {
  return Array.from(text).map(foldChar).join('');
}

/**
 * Position of `term` inside `text`, ignoring case and diacritics, as indices
 * of the ORIGINAL text (so the UI can highlight it).
 */
export function findMatch(text: string, term: string): [number, number] | null {
  const needle = fold(term.trim());
  if (!needle) {
    return null;
  }
  const chars = Array.from(text);
  let folded = '';
  const startOf: number[] = []; // folded index → original char index
  chars.forEach((char, index) => {
    const piece = foldChar(char);
    for (let i = 0; i < piece.length; i++) {
      startOf.push(index);
    }
    folded += piece;
  });
  const at = folded.indexOf(needle);
  if (at < 0) {
    return null;
  }
  const first = startOf[at];
  const last = startOf[at + needle.length - 1];
  // Convert char indices back to UTF-16 offsets for String.slice.
  const toOffset = (charIndex: number) =>
    chars.slice(0, charIndex).join('').length;
  return [toOffset(first), toOffset(last + 1)];
}

export type SearchHit = {
  id: string;
  senderId: string;
  createdAt: number;
  text: string;
  match: [number, number];
};

/** Text messages (not recalled) that contain `term`, newest first. */
export function matchMessages(
  messages: Record<string, WireMessage>,
  term: string,
): SearchHit[] {
  return Object.entries(messages)
    .flatMap(([id, message]) => {
      if (message.recalled || message.type !== 'text' || !message.text) {
        return [];
      }
      const match = findMatch(message.text, term);
      return match
        ? [
            {
              id,
              senderId: message.senderId,
              createdAt: message.createdAt,
              text: message.text,
              match,
            },
          ]
        : [];
    })
    .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

/**
 * Realtime Database has no full-text search, so the conversation's messages
 * are read once (members only, per the rules) and filtered on the device.
 */
export async function searchMessages(convId: string, term: string) {
  if (!fold(term.trim())) {
    return [];
  }
  const snap = await get(ref(database, `messages/${convId}`));
  return matchMessages(snap.val() || {}, term);
}
