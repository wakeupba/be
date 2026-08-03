/*
 * pickuptheph.one — the easter egg. Whoever finds it gets sent home, and
 * whoever reads their network tab gets a second one.
 */
export default {
  fetch(): Response {
    return new Response(null, {
      status: 302,
      headers: {
        Location: 'https://wakeupba.be/',
        'x-babe': 'good. now keep it near you.',
      },
    });
  },
};
