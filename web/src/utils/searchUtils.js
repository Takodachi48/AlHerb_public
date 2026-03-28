const normalizeSearchInput = (value = '') => String(value).toLowerCase().trim();

export const buildLooseSearchVariants = (query = '') => {
  const raw = normalizeSearchInput(query);
  if (!raw) return [''];

  const compact = raw.replace(/[^a-z0-9]/g, '');
  const normalized = raw.replace(/[^a-z0-9]+/g, ' ').trim();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const variants = new Set([raw]);

  if (normalized && normalized !== raw) variants.add(normalized);

  // Known high-friction inputs used by users.
  const aliasMap = {
    herbspage: ['herbs page', 'herbs', 'herb'],
    herbmanagement: ['herb management', 'management', 'herbs'],
    herblocations: ['herb locations', 'locations', 'location'],
  };
  const mapped = aliasMap[compact];
  if (Array.isArray(mapped)) mapped.forEach((item) => variants.add(item));

  if (compact.endsWith('page') && compact.length > 4) {
    variants.add(compact.slice(0, -4));
  }

  if (tokens.length > 1) {
    tokens.forEach((token) => {
      if (token.length > 2) variants.add(token);
    });
    variants.add(tokens.join(' '));
  }

  return Array.from(variants)
    .map((item) => item.trim())
    .filter((item, index, arr) => item && arr.indexOf(item) === index);
};

