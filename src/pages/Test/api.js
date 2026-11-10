const MERCHANTS = [
  'Acme Ltd',
  'Globex',
  'Initech',
  'Umbrella Corp',
  'Stark Industries',
  'Wayne Enterprises',
  'Hooli',
  'Soylent',
  'Vandelay Imports',
  'Wonka Industries',
];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'];
const STATUSES = ['completed', 'pending', 'failed'];

const DATA = Array.from({ length: 87 }, (_, i) => {
  const currency = CURRENCIES[i % 4];
  return {
    id: `tx_${String(i + 1).padStart(4, '0')}`,
    merchant: MERCHANTS[(i * 3) % MERCHANTS.length],
    // amountMinor — сумма в минорных единицах (центы; для JPY — иены)
    amountMinor:
      currency === 'JPY'
        ? 500 + ((i * 7919) % 200000)
        : 100 + ((i * 104729) % 500000),
    currency,
    status: STATUSES[(i * 5) % 3],
    createdAt: new Date(Date.UTC(2026, 8, 1) + i * 7 * 3600000).toISOString(),
  };
}).reverse();

export const PAGE_SIZE = 10;

export function fetchTransactions(
  { search = '', status = 'all', page = 1 } = {},
  signal,
) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => {
        if (Math.random() < 0.15)
          return reject(new Error('Internal server error'));
        const q = search.trim().toLowerCase();
        const filtered = DATA.filter(
          (t) =>
            (status === 'all' || t.status === status) &&
            (q === '' || t.merchant.toLowerCase().includes(q)),
        );
        const start = (page - 1) * PAGE_SIZE;
        resolve({
          items: filtered.slice(start, start + PAGE_SIZE),
          total: filtered.length,
        });
      },
      300 + Math.random() * 1200,
    );

    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}
export function searchMerchants(query, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => {
        if (Math.random() < 0.1) return reject(new Error('Search failed'));
        const q = query.trim().toLowerCase();
        resolve(
          MERCHANTS.filter((m) => m.toLowerCase().includes(q)).slice(0, 8),
        );
      },
      200 + Math.random() * 600,
    );

    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}
