// Pruebas de interfaz (navegador real). `npm run test:ui`
// En local usa el Chromium que instale Playwright; si ya tienes uno, indícalo con CHROMIUM_PATH.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'test-ui',
  timeout: 200000,                 // las carreras completas tardan: la velocidad "rápida" aun así necesita un par de minutos
  expect: { timeout: 15000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'block',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  },
  webServer: {
    command: 'node tools/servidor.js 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI
  }
});
