// Safe-area insets have no native provider under Jest; use the library's mock.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Reanimated 4's bundled mock still boots the native Worklets runtime, which
// doesn't exist under jest-expo. This minimal stand-in covers the API we use:
// shared values hold plain numbers and animations jump to their target.
// Add to it as components adopt more of Reanimated.
jest.mock('react-native-reanimated', () => {
  const { View, Text, ScrollView, Image } = require('react-native');
  const sharedValue = (initial) => {
    const sv = { value: initial };
    sv.get = () => sv.value;
    sv.set = (next) => {
      sv.value = typeof next === 'function' ? next(sv.value) : next;
    };
    return sv;
  };
  const Animated = {
    View,
    Text,
    ScrollView,
    Image,
    createAnimatedComponent: (Component) => Component,
  };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (initial) => require('react').useState(() => sharedValue(initial))[0],
    useAnimatedStyle: (updater) => updater(),
    // jest.fn so tests can flip Reduce Motion and spy on which animations run.
    useReducedMotion: jest.fn(() => false),
    withSpring: jest.fn((toValue) => toValue),
    withTiming: (toValue) => toValue,
    withSequence: (...steps) => steps[steps.length - 1],
    withRepeat: jest.fn((animation) => animation),
    cancelAnimation: jest.fn(),
    Easing: { inOut: (fn) => fn, sin: (t) => t },
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  };
});
