import { afterEach, describe, expect, it, vi } from 'vitest';
import { PostHogAnalytics } from '../src/services/analytics';

/*
 * The contract that matters: capture describes the event faithfully, and no
 * failure mode of the analytics vendor may ever surface as ours. A funnel
 * event is worth a log line, never a failed request.
 */
describe('PostHogAnalytics', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the event keyed by distinct id', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    await new PostHogAnalytics('phc_test', 'https://us.i.posthog.com').capture(
      'usr_1',
      'phone saved',
      { country: 'IN' },
    );

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://us.i.posthog.com/i/v0/e/');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      api_key: 'phc_test',
      event: 'phone saved',
      distinct_id: 'usr_1',
      properties: { country: 'IN' },
    });
  });

  it('swallows a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect timeout')));
    await expect(
      new PostHogAnalytics('phc_test', 'https://us.i.posthog.com').capture('usr_1', 'signed up'),
    ).resolves.toBeUndefined();
  });

  it('swallows a vendor error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })));
    await expect(
      new PostHogAnalytics('phc_bad', 'https://us.i.posthog.com').capture('usr_1', 'signed up'),
    ).resolves.toBeUndefined();
  });
});
