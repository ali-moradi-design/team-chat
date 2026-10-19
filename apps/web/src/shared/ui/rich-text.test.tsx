import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichText } from './rich-text';

describe('RichText', () => {
  it('renders text, never HTML', () => {
    const { container } = render(
      <RichText text={'<img src=x onerror=alert(1)> <script>alert(1)</script>'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });

  it('links only http(s) and opens them safely', () => {
    render(<RichText text={'see https://example.com/a and javascript:alert(1)'} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com/a');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.queryAllByRole('link')).toHaveLength(1);
  });

  it('lets each message pick its own direction', () => {
    const { container } = render(<RichText text="سلام" />);
    expect(container.firstElementChild).toHaveAttribute('dir', 'auto');
  });

  it('formats bold, italics, inline code and mentions', () => {
    const { container } = render(
      <RichText
        text={'**b** _i_ `c` @sara'}
        resolveMention={(h) => (h === 'sara' ? { label: 'Sara', self: false } : null)}
      />,
    );
    expect(container.querySelector('strong')?.textContent).toBe('b');
    expect(container.querySelector('em')?.textContent).toBe('i');
    expect(container.querySelector('code')?.textContent).toBe('c');
    expect(container.textContent).toContain('@Sara');
  });
});
