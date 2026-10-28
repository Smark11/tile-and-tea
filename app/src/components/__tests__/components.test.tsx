import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';

import { Button } from '../Button';
import { Card } from '../Card';
import { Styleguide } from '../dev/Styleguide';
import { Screen } from '../Screen';
import { Text } from '../Text';
import { colors, typography } from '@/theme';

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
});
