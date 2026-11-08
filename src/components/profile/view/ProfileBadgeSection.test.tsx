import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProfileBadgeSection } from './ProfileBadgeSection';

describe('ProfileBadgeSection', () => {
  it('renders nothing when items is empty', () => {
    const { container } = render(
      <ProfileBadgeSection title="領域技術" items={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title and tags correctly with default Badge variant', () => {
    const items = [
      { subject_group: 'group-1', subject: 'React' },
      { subject_group: 'group-2', subject: 'TypeScript' },
    ];

    render(<ProfileBadgeSection title="領域技術" items={items} />);

    expect(screen.getByText('領域技術')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });
});
