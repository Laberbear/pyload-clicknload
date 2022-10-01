module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    'jest/globals': true,
  },
  extends: [
    'airbnb-base',
  ],
  plugins: ['jest'],
  parserOptions: {
    ecmaVersion: 13,
  },
  root: true,
  rules: {
    'no-restricted-syntax': ['off'],
    'class-methods-use-this': ['off'],
  },
};
