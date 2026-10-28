import { render, screen } from '@testing-library/react-native';

import Home from '@/app/index';

describe('Home', () => {
  it('renders the app title as a header', async () => {
    await render(<Home />);
    expect(screen.getByRole('header', { name: 'Mah Jongg Coach' })).toBeOnTheScreen();
  });
});
