// Playwright configuration for backend API e2e tests
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  timeout: 60_000,
  use: {
    baseURL: process.env.API_BASE_URL || 'http://localhost:3001',
  },
  reporter: [['list']],
});

