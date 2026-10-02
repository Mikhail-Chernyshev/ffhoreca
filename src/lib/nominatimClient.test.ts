import { nominatimGet } from './nominatimClient';

describe('nominatimGet', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('не шлёт второй запрос, пока не прошла пауза', async () => {
    jest.useFakeTimers();
    await jest.advanceTimersByTimeAsync(2000);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 }),
    );

    const first = nominatimGet('https://nominatim.openstreetmap.org/search?q=a');
    await jest.runOnlyPendingTimersAsync();
    await first;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = nominatimGet('https://nominatim.openstreetmap.org/search?q=b');
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1100);
    await second;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('при 429 ждёт retry-after и повторяет', async () => {
    jest.useFakeTimers();
    await jest.advanceTimersByTimeAsync(2000);
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response('', { status: 429, headers: { 'Retry-After': '1' } }),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const pending = nominatimGet('https://nominatim.openstreetmap.org/search?q=c');
    await jest.runOnlyPendingTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1000);
    const res = await pending;
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
