import { fireEvent, render, screen } from '@testing-library/react-native';

import CardRoute from '@/app/card';
import { PracticeCardLink } from '@/components/card/PracticeCardLink';
import { CURRENT_CARD } from '@/game/card';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

describe('practice card screen', () => {
  it('prints every category as a heading, in card order', async () => {
    await render(<CardRoute />);
    expect(screen.getByRole('header', { name: '2027 Practice Card' })).toBeOnTheScreen();
    for (const section of CURRENT_CARD.sections) {
      expect(screen.getByTestId(`card-section-${section.id}`)).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: section.title })).toBeOnTheScreen();
    }
  });

  it('reads each of the 40 hands aloud with its place in the section', async () => {
    await render(<CardRoute />);
    for (const hand of CURRENT_CARD.hands) {
      expect(screen.getByTestId(`card-hand-${hand.id}`)).toBeOnTheScreen();
    }
    const quints = CURRENT_CARD.sections.find((s) => s.id === 'quints');
    expect(screen.getByLabelText(`Quints, hand 2 of 4. ${quints?.hands[1].line.spoken}`)).toBeOnTheScreen();
  });

  it('prints each line with its group text, term and value (hidden from screen readers, which hear the label)', async () => {
    await render(<CardRoute />);
    const hidden = { includeHiddenElements: true };
    // Only the section heading is visible to screen readers; the 5 printed "2027" groups aren't.
    expect(screen.getAllByText('2027')).toHaveLength(1);
    expect(screen.getAllByText('2027', hidden)).toHaveLength(6);
    expect(screen.queryAllByText('3 + 4 = 7')).toHaveLength(0);
    expect(screen.getAllByText('C', hidden).length).toBe(CURRENT_CARD.hands.filter((h) => h.concealed).length);
    expect(screen.getAllByText('3 + 4 = 7', hidden)).toHaveLength(1);
  });

  it('goes back, or home when opened directly', async () => {
    const { router } = jest.requireMock('expo-router');
    await render(<CardRoute />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.back).toHaveBeenCalled();
    router.canGoBack.mockReturnValueOnce(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});

describe('practice card link', () => {
  it('opens the card', async () => {
    const { router } = jest.requireMock('expo-router');
    await render(<PracticeCardLink />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open the 2027 Practice Card. 40 hands to learn on.' }));
    expect(router.push).toHaveBeenCalledWith('/card');
  });
});
