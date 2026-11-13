import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Aurora } from './Aurora';

describe('Aurora', () => {
  it('hides the decorative light from assistive technology', () => {
    const { container } = render(<Aurora />);
    expect(container.querySelector('.aurora')?.getAttribute('aria-hidden')).toBe('true');
  });
});
