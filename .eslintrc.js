module.exports = {
  root: true,
  extends: '@react-native',
  // Node scripts chạy ngoài app (ESM + top-level await).
  ignorePatterns: ['scripts/*.mjs'],
};
