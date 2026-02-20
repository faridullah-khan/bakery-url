// API-level Playwright tests for the backend server
const { test, expect, request } = require('@playwright/test');
const { v4: uuid } = require('uuid');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const CASHIER_TOKEN = process.env.CASHIER_TOKEN || process.env.ADMIN_TOKEN; // fallback if cashier not provided
const baseURL = process.env.API_BASE_URL || 'http://localhost:3001';

const authHeader = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

// Skip mutation tests when tokens are missing so suite can still run health check
const hasAuth = Boolean(ADMIN_TOKEN && CASHIER_TOKEN);

const makeName = (label) => `${label}-${uuid().slice(0, 8)}`;

const sampleIngredientPayload = () => ({
  name: makeName('Flour'),
  price: 120,
  quantity: 50,
});

const sampleRecipe = (ingredientId) => ({
  ingredients: [{ ingredientId, quantity: 0.5 }],
});

test.describe('Backend API', () => {
  let api;

  test.beforeAll(async ({ playwright }) => {
    api = await request.newContext({ baseURL });
    if (!ADMIN_TOKEN || !CASHIER_TOKEN) {
      // eslint-disable-next-line no-console
      console.warn('ADMIN_TOKEN and CASHIER_TOKEN missing; mutation tests will be skipped.');
    }
  });

  test('health check responds with ok', async () => {
    const res = await api.get('/health');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
  });

  test('full inventory + recipe + sale flow', async () => {
    test.skip(!hasAuth, 'Requires ADMIN_TOKEN and CASHIER_TOKEN');

    // Create ingredient
    const ingredientRes = await api.post('/inventory', {
      data: sampleIngredientPayload(),
      headers: { 'Content-Type': 'application/json', ...authHeader(ADMIN_TOKEN) },
    });
    expect(ingredientRes.status()).toBe(201);
    const ingredient = await ingredientRes.json();

    // Read inventory as cashier
    const listRes = await api.get('/inventory', { headers: authHeader(CASHIER_TOKEN) });
    expect(listRes.ok()).toBeTruthy();

    // Create/update recipe for a product
    const productId = makeName('product');
    const recipePayload = sampleRecipe(ingredient.id);
    const recipePut = await api.put(`/recipes/${productId}`, {
      data: recipePayload,
      headers: { 'Content-Type': 'application/json', ...authHeader(ADMIN_TOKEN) },
    });
    expect(recipePut.ok()).toBeTruthy();

    // Fetch recipe
    const recipeGet = await api.get(`/recipes/${productId}`, { headers: authHeader(ADMIN_TOKEN) });
    expect(recipeGet.ok()).toBeTruthy();

    // Calculate recipe cost
    const costRes = await api.get(`/recipes/${productId}/cost`, { headers: authHeader(ADMIN_TOKEN) });
    expect(costRes.ok()).toBeTruthy();
    const costJson = await costRes.json();
    expect(costJson).toHaveProperty('totalCost');

    // Post a sale as cashier
    const saleRes = await api.post('/sale', {
      data: {
        items: [
          {
            productId,
            name: 'Test Item',
            quantity: 1,
            price: 500,
            unitType: 'unit',
          },
        ],
      },
      headers: { 'Content-Type': 'application/json', ...authHeader(CASHIER_TOKEN) },
    });
    expect(saleRes.status()).toBe(201);
    const saleJson = await saleRes.json();
    expect(Array.isArray(saleJson.items)).toBe(true);

    // Cleanup: delete ingredient (recipe deletion endpoint not available)
    const delRes = await api.delete(`/inventory/${ingredient.id}`, { headers: authHeader(ADMIN_TOKEN) });
    expect(delRes.ok()).toBeTruthy();
  });

  test('unknown route returns 404', async () => {
    const res = await api.get('/non-existent-route');
    expect(res.status()).toBe(404);
  });
});

