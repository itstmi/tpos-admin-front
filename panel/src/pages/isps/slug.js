// The ISP's name in the address bar instead of its database id. Two ISPs with the same
// name get the start of their id added so each address stays unique.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (s) => UUID.test(s || '');

const base = (name) => String(name || 'isp')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'isp';

export function withSlugs(isps) {
  const seen = new Map();
  for (const i of isps) seen.set(base(i.business_name), (seen.get(base(i.business_name)) || 0) + 1);
  return isps.map((i) => {
    const b = base(i.business_name);
    return { ...i, slug: seen.get(b) > 1 ? `${b}-${i.isp_id.slice(0, 8)}` : b };
  });
}
