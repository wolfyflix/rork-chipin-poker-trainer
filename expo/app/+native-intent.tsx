/**
 * Deep-link gate. Invite links (rork-app://invite?ref=…, or the web
 * /invite?ref=… route) must reach the invite screen so recipients can accept;
 * every other system path falls back to home.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const qIdx = path.indexOf("?");
  const query = qIdx >= 0 ? path.slice(qIdx) : "";
  const clean = path.split("?")[0];

  if (/(^|\/)invite(\/|$)|invite$/i.test(clean) || clean.endsWith("/invite")) {
    return `/invite${query}`;
  }
  return "/";
}
