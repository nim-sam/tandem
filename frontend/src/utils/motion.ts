import { AccessibilityInfo, LayoutAnimation, Platform } from 'react-native';

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((value) => {
    reduceMotion = value;
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
  reduceMotion = value;
});

// Call right before a state change that opens, closes or re-lays content:
// the layout change then eases over 200 ms. Instant when the system
// "remove animations" setting is on, and in a browser (no layout animation there).
export const easeLayout = () => {
  if (reduceMotion || Platform.OS === 'web') return;
  LayoutAnimation.configureNext({
    duration: 200,
    create: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeOut },
    delete: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
  });
};
