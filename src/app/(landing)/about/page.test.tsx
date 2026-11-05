import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AboutPage from './page';

describe('AboutPage (#711)', () => {
  it('renders the hero heading, core sections, and inclusive cross-disciplinary copy', () => {
    render(<AboutPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /關於\s*X-Talent/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'X-Talent 的起心動念' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'X-Talent 的核心價值' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/站在前輩的肩膀上，運用最少的時間，獲取最多的經驗/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/站在資深PM的肩膀上/)).not.toBeInTheDocument();
  });
});
