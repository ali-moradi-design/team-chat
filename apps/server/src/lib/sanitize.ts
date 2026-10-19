/** Strip control chars (except tab/newline), normalise newlines, trim and cap length. */
export function sanitizeText(input: string, maxLength: number): string {
  const stripped = input
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/‮|⁦|⁧|⁨|⁩/g, '')
    .replace(/\r\n?/g, '\n')
    .trim();
  return stripped.length <= maxLength ? stripped : stripped.slice(0, maxLength);
}

export const sanitizeName = (input: string, max = 48): string =>
  sanitizeText(input, max).replace(/\s+/g, ' ');
