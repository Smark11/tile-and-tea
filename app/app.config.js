// Expo reads app.json, then hands it to this file to adjust. The only change
// is the web base path: when the site is served from a sub-folder (GitHub
// Pages puts it at /<repo>/), EXPO_PUBLIC_BASE_PATH tells Expo Router and the
// bundler to prefix every URL. Unset (local dev, EAS Hosting) nothing changes.
// It also carries into the bundle, where +html.tsx uses it for asset links.
const basePath = (process.env.EXPO_PUBLIC_BASE_PATH ?? '').trim().replace(/\/+$/, '');

module.exports = ({ config }) => {
  if (!basePath) return config;
  if (!basePath.startsWith('/')) throw new Error(`EXPO_PUBLIC_BASE_PATH must start with "/", got "${basePath}"`);
  return { ...config, experiments: { ...config.experiments, baseUrl: basePath } };
};
