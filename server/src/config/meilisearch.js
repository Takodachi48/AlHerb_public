let meiliClient = null;
let MeiliSearchCtor = null;

const isMeiliEnabled = () => {
  const enabled = String(process.env.MEILI_ENABLED || '').trim().toLowerCase();
  if (enabled !== 'true') return false;
  const host = String(process.env.MEILI_HOST || '').trim();
  return Boolean(host);
};

const resolveMeiliCtor = () => {
  if (MeiliSearchCtor) return MeiliSearchCtor;
  // Lazy require so disabled deployments do not need the dependency at runtime.
  ({ MeiliSearch: MeiliSearchCtor } = require('meilisearch'));
  return MeiliSearchCtor;
};

const getMeiliClient = () => {
  if (!isMeiliEnabled()) return null;
  if (meiliClient) return meiliClient;
  const MeiliSearch = resolveMeiliCtor();

  meiliClient = new MeiliSearch({
    host: String(process.env.MEILI_HOST || '').trim(),
    apiKey: String(process.env.MEILI_MASTER_KEY || '').trim() || undefined,
  });

  return meiliClient;
};

module.exports = {
  getMeiliClient,
  isMeiliEnabled,
};
