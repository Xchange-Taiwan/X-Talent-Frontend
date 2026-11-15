import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import AuthOperationLayout from './layout';

describe('AuthOperationLayout (src/app/auth/(sign)/layout.tsx)', () => {
  it('renders the split-cover shell and children synchronously without RSC getServerSession guards (#895)', () => {
    render(
      <AuthOperationLayout>
        <div>Sign Form Child</div>
      </AuthOperationLayout>
    );

    expect(screen.getByText('Sign Form Child')).toBeInTheDocument();
    expect(
      screen.getByText('現在就加入，更加豐富你的職涯！')
    ).toBeInTheDocument();
  });

  it('does not import getServerSession or next/navigation redirect so Edge middleware exclusively owns auth gating (#895)', () => {
    const layoutSource = fs.readFileSync(
      path.resolve(__dirname, 'layout.tsx'),
      'utf8'
    );

    expect(layoutSource).not.toContain('getServerSession');
    expect(layoutSource).not.toContain('resolveAuthSurfaceRedirect');
  });
});
