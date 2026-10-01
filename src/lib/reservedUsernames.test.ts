import { isReservedUsername } from './reservedUsernames';

describe('isReservedUsername', () => {
  it('блокирует зарезервированные имена без учёта регистра и пробелов', () => {
    expect(isReservedUsername('Privacy')).toBe(true);
    expect(isReservedUsername('  ADMIN ')).toBe(true);
    expect(isReservedUsername('share')).toBe(true);
    expect(isReservedUsername('og-share.png')).toBe(true);
  });

  it('пропускает обычный username', () => {
    expect(isReservedUsername('mikhail')).toBe(false);
  });
});
