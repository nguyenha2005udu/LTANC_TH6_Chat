// Firebase Console → Project settings → Your apps → Web app configuration.
export const firebaseConfig = {
  apiKey: 'AIzaSyAbfwK9ZYuT9qSwSsMcJEj0wfVk_xS2eAE',
  authDomain: 'uduchat-a17c9.firebaseapp.com',
  databaseURL:
    'https://uduchat-a17c9-default-rtdb.asia-southeast1.firebasedatabase.app/',
  projectId: 'uduchat-a17c9',
  appId: '1:669904395018:web:ae2e1bdbd082494848f8f3',
};
export const firebaseConfigured = !firebaseConfig.apiKey.startsWith('YOUR_');
