const API =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:8787'
    : (process.env.NEXT_PUBLIC_API_ORIGIN ?? 'https://api.wakeupba.be');

let probe: Promise<boolean> | null = null;

/*
 * One session check per page load, shared by everything that wants it. The
 * header's buttons and the home page's redirect both ask, and without this
 * they would each ring the API separately for the same cookie.
 *
 * Errors resolve to false: a visitor we cannot identify is a visitor, and no
 * caller has a better idea than that.
 */
export function isAuthenticated(): Promise<boolean> {
  probe ??= fetch(`${API}/session`, { credentials: 'include' })
    .then((response) => response.json() as Promise<{ authenticated: boolean }>)
    .then((session) => Boolean(session.authenticated))
    .catch(() => false);
  return probe;
}
