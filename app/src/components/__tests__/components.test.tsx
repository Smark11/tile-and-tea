import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';

import { Button, variantStyles } from '../Button';
import { Card } from '../Card';
import { Styleguide } from '../dev/Styleguide';
import { Screen } from '../Screen';
import { Text } from '../Text';
import { colors, shadows, typography, type Theme } from '@/theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

afterEach(() => mockScheme.mockReturnValue('light'));

describe('Text', () => {
  it('applies the variant style and default color', async () => {
    await render(<Text>Hello</Text>);
    const style = StyleSheet.flatten(screen.getByText('Hello').props.style);
    expect(style).toMatchObject({ ...typography.body, color: colors.light.text });
  });

  it('announces headings as headers', async () => {
    await render(<Text variant="title1">Learn</Text>);
    expect(screen.getByRole('header', { name: 'Learn' })).toBeOnTheScreen();
  });

  it('does not mark body text as a header', async () => {
    await render(<Text>Body</Text>);
    expect(screen.queryByRole('header')).toBeNull();
  });

  it('caps only the largest headings for Dynamic Type', async () => {
    await render(
      <>
        <Text variant="display">Big</Text>
        <Text>Small</Text>
      </>,
    );
    expect(screen.getByText('Big').props.maxFontSizeMultiplier).toBe(1.5);
    expect(screen.getByText('Small').props.maxFontSizeMultiplier).toBeUndefined();
  });

  it('follows the dark color scheme', async () => {
    mockScheme.mockReturnValue('dark');
    await render(<Text color="textMuted">Muted</Text>);
    expect(StyleSheet.flatten(screen.getByText('Muted').props.style).color).toBe(
      colors.dark.textMuted,
    );
  });
});

describe('Button', () => {
  it('shows a hover state under a pointer and drops it when the pointer leaves', async () => {
    const onHoverIn = jest.fn();
    await render(<Button title="Hover me" variant="secondary" onHoverIn={onHoverIn} />);
    const button = screen.getByRole('button', { name: 'Hover me' });
    // The pill is the nearest ancestor of the label that carries a border.
    const border = () => {
      for (let node = screen.getByText('Hover me').parent; node; node = node.parent) {
        const color = StyleSheet.flatten(node.props.style)?.borderColor;
        if (color) return color;
      }
    };
    expect(border()).toBe(colors.light.border);
    await fireEvent(button, 'hoverIn', {});
    expect(border()).toBe(colors.light.primaryText);
    expect(onHoverIn).toHaveBeenCalledTimes(1);
    await fireEvent(button, 'hoverOut', {});
    expect(border()).toBe(colors.light.border);
  });

  it('gives every variant a hover look that differs from idle and keeps its label color', () => {
    const theme = { colors: colors.light, shadows: shadows.light } as unknown as Theme;
    for (const variant of ['primary', 'secondary', 'quiet', 'ivory', 'quietOnFelt'] as const) {
      const idle = variantStyles(variant, theme, 'idle');
      const hovered = variantStyles(variant, theme, 'hovered');
      expect(hovered.container).not.toEqual(idle.container);
      expect(hovered.label).toBe(idle.label);
    }
  });

  it('is an accessible button that fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Button title="Start lesson" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start lesson' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled and reports the disabled state', async () => {
    const onPress = jest.fn();
    await render(<Button title="Later" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Later' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it('uses on-primary text for the primary variant and jade text otherwise', async () => {
    await render(
      <>
        <Button title="Primary" />
        <Button title="Secondary" variant="secondary" />
      </>,
    );
    const color = (label: string) =>
      StyleSheet.flatten(screen.getByText(label).props.style).color;
    expect(color('Primary')).toBe(colors.light.onPrimary);
    expect(color('Secondary')).toBe(colors.light.primaryText);
  });

  it('forwards press-in and press-out handlers', async () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    await render(<Button title="Go" onPressIn={onPressIn} onPressOut={onPressOut} />);
    const button = screen.getByRole('button', { name: 'Go' });
    await fireEvent(button, 'pressIn');
    await fireEvent(button, 'pressOut');
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });
});

describe('Card', () => {
  it('paints felt cards with the felt color', async () => {
    await render(<Card tone="felt" testID="card" />);
    expect(StyleSheet.flatten(screen.getByTestId('card').props.style).backgroundColor).toBe(
      colors.light.felt,
    );
  });

  it('defaults to the surface color', async () => {
    await render(<Card testID="card" />);
    expect(StyleSheet.flatten(screen.getByTestId('card').props.style).backgroundColor).toBe(
      colors.light.surface,
    );
  });
});

describe('Screen', () => {
  it('renders children in scrolling and fixed layouts', async () => {
    await render(
      <Screen>
        <Text>Scrolling</Text>
      </Screen>,
    );
    expect(screen.getByText('Scrolling')).toBeOnTheScreen();
    await render(
      <Screen scroll={false} tone="felt">
        <Text>Fixed</Text>
      </Screen>,
    );
    expect(screen.getByText('Fixed')).toBeOnTheScreen();
  });
});

describe('Styleguide', () => {
  it('shows every theme color token and type variant', async () => {
    await render(<Styleguide />);
    for (const key of Object.keys(colors.light)) {
      expect(screen.getByText(key)).toBeOnTheScreen();
    }
    for (const variant of Object.keys(typography)) {
      expect(screen.getByText(new RegExp(`^${variant} · `))).toBeOnTheScreen();
    }
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(4);
  });

  it('shows every tile face, including all eight flowers', async () => {
    await render(<Styleguide />);
    expect(screen.getByRole('button', { name: 'Nine of Characters' })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: 'Green Dragon' })).toBeOnTheScreen();
    expect(screen.getAllByRole('image', { name: 'Flower' })).toHaveLength(8);
    expect(screen.getAllByRole('image', { name: 'Joker' }).length).toBeGreaterThanOrEqual(1);
  });
});
