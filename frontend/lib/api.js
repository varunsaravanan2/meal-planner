const BASE = 'http://localhost:8000';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = Array.isArray(err.detail)
      ? err.detail.map(e => e.msg ?? JSON.stringify(e)).join('; ')
      : (err.detail || 'Request failed');
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(email, password) {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    const detail = Array.isArray(err.detail)
      ? err.detail.map(e => e.msg ?? JSON.stringify(e)).join('; ')
      : (err.detail || 'Login failed');
    throw new Error(detail);
  }
  const data = await res.json();
  localStorage.setItem('token', data.access_token);
  return data;
}

export async function register(email, password) {
  return request('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getProfile() {
  return request('/api/v1/profile');
}

export async function saveProfile(data) {
  return request('/api/v1/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function generateMealPlan() {
  return request('/api/v1/profile/generate-plan', { method: 'POST' });
}

export async function getWeeklyWorkouts(startDate) {
  return request(`/api/v1/workouts?start_date=${startDate}`);
}

export function logout() {
  localStorage.removeItem('token');
  window.location.href = '/login';
}

export function isLoggedIn() {
  return Boolean(getToken());
}

// ── Recipes ───────────────────────────────────────────────────────────────────

export async function getRecipes({ page = 1, page_size = 20, category, cuisine } = {}) {
  const params = new URLSearchParams({ page, page_size });
  if (category) params.set('category', category);
  if (cuisine) params.set('cuisine', cuisine);
  return request(`/api/v1/recipes?${params}`);
}

export async function searchRecipes(q) {
  return request(`/api/v1/recipes/search?q=${encodeURIComponent(q)}&limit=20`);
}

export async function createRecipe(data) {
  return request('/api/v1/recipes', { method: 'POST', body: JSON.stringify(data) });
}

export async function extractRecipeFromText(recipe_text) {
  return request('/api/v1/recipes/extract-text', {
    method: 'POST',
    body: JSON.stringify({ recipe_text }),
  });
}

export async function extractRecipeFromUrl(instagram_url) {
  return request('/api/v1/recipes/extract', {
    method: 'POST',
    body: JSON.stringify({ instagram_url }),
  });
}

export async function deleteRecipe(id) {
  return request(`/api/v1/recipes/${id}`, { method: 'DELETE' });
}

// ── Meal Plan ─────────────────────────────────────────────────────────────────

export async function getWeeklyPlan(weekOf) {
  const params = weekOf ? `?week_of=${weekOf}` : '';
  return request(`/api/v1/meal-plan/week${params}`);
}

export async function addMealPlan(data) {
  return request('/api/v1/meal-plan/', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteMealPlan(id) {
  return request(`/api/v1/meal-plan/${id}`, { method: 'DELETE' });
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export async function getInventory({ page = 1, page_size = 100 } = {}) {
  return request(`/api/v1/inventory?page=${page}&page_size=${page_size}`);
}

export async function addInventoryItem(data) {
  return request('/api/v1/inventory', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteInventoryItem(id) {
  return request(`/api/v1/inventory/${id}`, { method: 'DELETE' });
}

export async function updateInventoryItem(id, data) {
  return request(`/api/v1/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

// ── Shopping List ─────────────────────────────────────────────────────────────

export async function getWeeklyShoppingList(weekOf) {
  const params = weekOf ? `?week_of=${weekOf}` : '';
  return request(`/api/v1/shopping-list/week${params}`);
}
