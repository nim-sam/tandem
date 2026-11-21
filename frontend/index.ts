import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';

// In the browser, hide scroll bars so the app looks as it does on a phone.
// Everything still scrolls with the wheel, touch and keyboard.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = '* { scrollbar-width: none; } *::-webkit-scrollbar { display: none; }';
  document.head.appendChild(style);
}

registerRootComponent(App);
