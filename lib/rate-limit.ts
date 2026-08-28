// lib/rate-limit.ts
const requests = new Map();

export function rateLimit(ip: string) {
  const now = Date.now();

  const user = requests.get(ip) || [];

  const valid = user.filter((time: number) => now - time < 60000);

  valid.push(now);

  requests.set(
    ip,

    valid
  );

  return valid.length <= 100;
}
