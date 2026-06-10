import type {
  Recipe,
  RecipeListResponse,
  MealPlanEntry,
  WorkoutPlan,
  UserProfile,
  InventoryItem,
  ShoppingList,
  GeneratePlanResult,
} from '@/types';

const BASE = 'http://localhost:8000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return undefined as T;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = Array.isArray(err.detail)
      ? err.detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join('; ')
      : (err.detail || 'Request failed');
    throw new Error(detail);
  }

  if (res.status === 204) return null as T;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<{ access_token: string }> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    const detail = Array.isArray(err.detail)
      ? err.detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join('; ')
      : (err.detail || 'Login failed');
    throw new Error(detail);
  }
  const data = await res.json();
  localStorage.setItem('token', data.access_token);
  return data;
}

export async function register(email: string, password: string): Promise<unknown> {
  return request('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getProfile(): Promise<UserProfile | null> {
  return request<UserProfile | null>('/api/v1/profile');
}

export async function saveProfile(data: Partial<UserProfile>): Promise<UserProfile> {
  return request<UserProfile>('/api/v1/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function generateMealPlan(): Promise<GeneratePlanResult> {
  return request<GeneratePlanResult>('/api/v1/profile/generate-plan', { method: 'POST' });
}

export async function getWeeklyWorkouts(startDate: string): Promise<{ workouts: Record<string, WorkoutPlan> }> {
  return request<{ workouts: Record<string, WorkoutPlan> }>(`/api/v1/workouts?start_date=${startDate}`);
}

export function logout(): void {
  localStorage.removeItem('token');
  window.location.href = '/login';
}

export function isLoggedIn(): boolean {
  return Boolean(getToken());
}

// ── Recipes ───────────────────────────────────────────────────────────────────

export async function getRecipes({ page = 1, page_size = 20, category, cuisine }: {
  page?: number; page_size?: number; category?: string; cuisine?: string;
} = {}): Promise<RecipeListResponse> {
  const params = new URLSearchParams({ page: String(page), page_size: String(page_size) });
  if (category) params.set('category', category);
  if (cuisine) params.set('cuisine', cuisine);
  return request<RecipeListResponse>(`/api/v1/recipes?${params}`);
}

export async function searchRecipes(q: string): Promise<Recipe[]> {
  return request<Recipe[]>(`/api/v1/recipes/search?q=${encodeURIComponent(q)}&limit=20`);
}

export async function createRecipe(data: unknown): Promise<Recipe> {
  return request<Recipe>('/api/v1/recipes', { method: 'POST', body: JSON.stringify(data) });
}

export async function extractRecipeFromText(recipe_text: string): Promise<Recipe> {
  return request<Recipe>('/api/v1/recipes/extract-text', {
    method: 'POST',
    body: JSON.stringify({ recipe_text }),
  });
}

export async function extractRecipeFromUrl(instagram_url: string): Promise<Recipe> {
  return request<Recipe>('/api/v1/recipes/extract', {
    method: 'POST',
    body: JSON.stringify({ instagram_url }),
  });
}

export async function deleteRecipe(id: string): Promise<null> {
  return request<null>(`/api/v1/recipes/${id}`, { method: 'DELETE' });
}

// ── Meal Plan ─────────────────────────────────────────────────────────────────

export async function getWeeklyPlan(weekOf?: string): Promise<{ days: Record<string, MealPlanEntry[]> }> {
  const params = weekOf ? `?week_of=${weekOf}` : '';
  return request<{ days: Record<string, MealPlanEntry[]> }>(`/api/v1/meal-plan/week${params}`);
}

export async function addMealPlan(data: { recipe_id: string; planned_date: string; meal_slot: string }): Promise<MealPlanEntry> {
  return request<MealPlanEntry>('/api/v1/meal-plan/', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteMealPlan(id: string): Promise<null> {
  return request<null>(`/api/v1/meal-plan/${id}`, { method: 'DELETE' });
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export async function getInventory({ page = 1, page_size = 100 }: { page?: number; page_size?: number } = {}): Promise<{ items: InventoryItem[]; total: number }> {
  return request(`/api/v1/inventory?page=${page}&page_size=${page_size}`);
}

export async function addInventoryItem(data: { item_name: string; quantity: number; unit: string; category?: string | null; location?: string | null; notes?: string | null }): Promise<InventoryItem> {
  return request<InventoryItem>('/api/v1/inventory', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteInventoryItem(id: string): Promise<null> {
  return request<null>(`/api/v1/inventory/${id}`, { method: 'DELETE' });
}

export async function updateInventoryItem(id: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
  return request<InventoryItem>(`/api/v1/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

// ── Shopping List ─────────────────────────────────────────────────────────────

export async function getWeeklyShoppingList(weekOf?: string): Promise<ShoppingList> {
  const params = weekOf ? `?week_of=${weekOf}` : '';
  return request<ShoppingList>(`/api/v1/shopping-list/week${params}`);
}
