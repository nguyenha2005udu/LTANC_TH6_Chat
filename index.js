/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundHandler } from './src/services/localNotificationService';

// Taps on local notifications while the app is in the background.
registerBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
