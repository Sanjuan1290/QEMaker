export function isAuthorizedEmail(email: string): boolean {
  const lower = email.toLowerCase().trim();

  if (lower.endsWith('@pcu.edu.ph')) return true;

  // Vite uses import.meta.env with VITE_ prefix
  const whitelist = (import.meta.env.VITE_ADMIN_WHITELIST || '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  return whitelist.includes(lower);
}