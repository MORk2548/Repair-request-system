import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthShell } from './AuthShell';

describe('AuthShell', () => {
  it('shows the brand and its children inside main', () => {
    render(
      <AuthShell>
        <p>เนื้อหา</p>
      </AuthShell>,
    );
    const main = screen.getByRole('main');
    expect(main.textContent).toContain('ระบบแจ้งซ่อม');
    expect(main.textContent).toContain('เนื้อหา');
  });
});
