// Safe-area insets have no native provider under Jest; use the library's mock.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// In-memory AsyncStorage, so persisted stores work under Jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Worklets has no native runtime under Jest; hopping back to the JS thread
// is just a direct call.
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn, ...args) => fn(...args),
}));

// Reanimated 4's bundled mock still boots the native Worklets runtime, which
// doesn't exist under jest-expo. This minimal stand-in covers the API we use:
// shared values hold plain numbers and animations jump to their target.
// Add to it as components adopt more of Reanimated.
jest.mock('react-native-reanimated', () => {
  const { View, Text, ScrollView, Image } = require('react-native');
  // Live animated reactions. Any shared-value write re-runs them, as on the UI thread.
  const reactions = new Set();
  const sharedValue = (initial) => {
    const sv = { value: initial };
    sv.get = () => sv.value;
    sv.set = (next) => {
      sv.value = typeof next === 'function' ? next(sv.value) : next;
      reactions.forEach((run) => run());
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
    // The returned function stands in for the worklet handler, so a test's
    // fireEvent.scroll feeds onScroll like a native scroll would.
    useAnimatedScrollHandler: (handlers) => (event) => handlers.onScroll?.(event.nativeEvent),
    interpolate: (x, input, output) => {
      if (x <= input[0]) return output[0];
      for (let i = 1; i < input.length; i++) {
        if (x <= input[i]) {
          const t = (x - input[i - 1]) / (input[i] - input[i - 1]);
          return output[i - 1] + t * (output[i] - output[i - 1]);
        }
      }
      return output[output.length - 1];
    },
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    // Gesture Handler asks this to tell shared-value config apart from plain values.
    isSharedValue: (value) =>
      value !== null && typeof value === 'object' && typeof value.get === 'function' && 'value' in value,
    // Like Reanimated: the first run (and the first after `deps` change) gets
    // `previous = null`; later runs fire only when the prepared value changes.
    useAnimatedReaction: (prepare, react, deps) => {
      const React = require('react');
      const latest = React.useRef({ prepare, react });
      latest.current = { prepare, react };
      React.useEffect(() => {
        let previous = null;
        const run = () => {
          const next = latest.current.prepare();
          if (previous !== null && Object.is(next, previous)) return;
          const last = previous;
          previous = next;
          latest.current.react(next, last);
        };
        run();
        reactions.add(run);
        return () => reactions.delete(run);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps);
    },
    // jest.fn so tests can flip Reduce Motion and spy on which animations run.
    useReducedMotion: jest.fn(() => false),
    withSpring: jest.fn((toValue) => toValue),
    withTiming: (toValue) => toValue,
    withSequence: (...steps) => steps[steps.length - 1],
    withDelay: (_delayMs, animation) => animation,
    withRepeat: jest.fn((animation) => animation),
    cancelAnimation: jest.fn(),
    Easing: { inOut: (fn) => fn, out: (fn) => fn, sin: (t) => t, cubic: (t) => t },
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  };
});
