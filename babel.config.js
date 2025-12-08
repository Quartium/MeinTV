const fs = require('fs');
const path = require('path');

function loadEnv() {
  const candidates = [
    path.resolve(__dirname, '.env'),
    // Fallback to Android env file to avoid duplicating secrets during Metro builds
    path.resolve(__dirname, 'android/.env'),
  ];

  const envPath = candidates.find(fs.existsSync);
  if (!envPath) return;

  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...rest] = trimmed.split('=');
    if (!key) return;
    const value = rest.join('=').trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnv();

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'transform-inline-environment-variables',
      { include: ['TRAKT_CLIENT_ID', 'TRAKT_CLIENT_SECRET'] },
    ],
  ],
};
