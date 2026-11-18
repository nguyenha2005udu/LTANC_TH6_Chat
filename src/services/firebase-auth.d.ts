// Firebase publishes this React Native runtime export, but its public web .d.ts
// omits it. Keep the RN storage contract typed without importing private paths.
import type { Persistence } from 'firebase/auth';
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
