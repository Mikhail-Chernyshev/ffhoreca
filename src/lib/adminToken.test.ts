import { isEmailAdmin } from './adminToken';

describe('isEmailAdmin', () => {
  it('сравнивает email с VITE_ADMIN_EMAIL без учёта регистра', () => {
    expect(isEmailAdmin('Admin@Example.com')).toBe(true);
    expect(isEmailAdmin('other@example.com')).toBe(false);
    expect(isEmailAdmin(null)).toBe(false);
    expect(isEmailAdmin('')).toBe(false);
  });
});
