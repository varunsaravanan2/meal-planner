import type {
  Recipe,
  RecipeListResponse,
  MealPlanEntry,
  WorkoutPlan,
  UserProfile,
  InventoryItem,
  ShoppingList,
  GeneratePlanResult,
  ProgressEntry,
  ProgressPhoto,
  FoodLogEntry,
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

const INT_FIELDS    = ['age', 'height_ft', 'height_in', 'workouts_per_week', 'calorie_goal', 'protein_goal_g', 'carbs_goal_g', 'fat_goal_g', 'water_goal'] as const;
const FLOAT_FIELDS  = ['weight_lbs', 'target_weight_lbs', 'weekly_budget'] as const;

export async function saveProfile(data: Partial<UserProfile>): Promise<UserProfile> {
  const payload: Record<string, unknown> = { ...data };
  for (const f of INT_FIELDS) {
    if (payload[f] !== undefined && payload[f] !== null && payload[f] !== '') {
      payload[f] = parseInt(payload[f] as string, 10) || null;
    } else if (payload[f] === '') {
      payload[f] = null;
    }
  }
  for (const f of FLOAT_FIELDS) {
    if (payload[f] !== undefined && payload[f] !== null && payload[f] !== '') {
      payload[f] = parseFloat(payload[f] as string) || null;
    } else if (payload[f] === '') {
      payload[f] = null;
    }
  }
  return request<UserProfile>('/api/v1/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function generateMealPlan(): Promise<GeneratePlanResult> {
  return request<GeneratePlanResult>('/api/v1/profile/generate-plan', { method: 'POST' });
}

export interface NutritionalGoals {
  calorie_goal: number | null;
  protein_goal_g: number | null;
  carbs_goal_g: number | null;
  fat_goal_g: number | null;
}

export async function generateNutritionalGoals(): Promise<NutritionalGoals> {
  return request<NutritionalGoals>('/api/v1/profile/generate-goals', { method: 'POST' });
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

export async function updateRecipe(id: string, data: unknown): Promise<Recipe> {
  return request<Recipe>(`/api/v1/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function toggleFavorite(id: string): Promise<{ is_favorite: boolean }> {
  return request<{ is_favorite: boolean }>(`/api/v1/recipes/${id}/favorite`, { method: 'POST' });
}

export async function swapMeal(id: string): Promise<MealPlanEntry> {
  return request<MealPlanEntry>(`/api/v1/meal-plan/${id}/swap`, { method: 'POST' });
}

// ── Food Log ──────────────────────────────────────────────────────────────────

export async function getFoodLog(date: string): Promise<FoodLogEntry[]> {
  return request<FoodLogEntry[]>(`/api/v1/food-log?log_date=${date}`);
}

export async function addFoodLog(data: {
  recipe_id?: string | null;
  log_date: string;
  meal_slot: string;
  name: string;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  servings?: number;
}): Promise<FoodLogEntry> {
  return request<FoodLogEntry>('/api/v1/food-log', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteFoodLog(id: string): Promise<null> {
  return request<null>(`/api/v1/food-log/${id}`, { method: 'DELETE' });
}

export interface WeeklyFoodSummary {
  week_start: string;
  days_logged: number;
  avg_calories: number;
  avg_protein_g: number;
  avg_carbs_g: number;
  avg_fat_g: number;
  daily: Record<string, { calories: number; protein_g: number; carbs_g: number; fat_g: number; entries: number }>;
}

export async function getWeeklyFoodSummary(weekOf: string): Promise<WeeklyFoodSummary> {
  return request<WeeklyFoodSummary>(`/api/v1/food-log/weekly?week_of=${weekOf}`);
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

// ── Billing ───────────────────────────────────────────────────────────────────

export interface SubscriptionStatus {
  plan_type: string;
  status: string;
  generations_used: number;
  generations_limit: number;
  generations_remaining: number;
  expires_at: string | null;
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  return request<SubscriptionStatus>('/api/v1/billing/status');
}

export async function createCheckoutSession(plan_type: string): Promise<{ url: string }> {
  return request<{ url: string }>('/api/v1/billing/create-checkout', {
    method: 'POST',
    body: JSON.stringify({ plan_type }),
  });
}

// ── Plan Snapshots ────────────────────────────────────────────────────────────

export interface PlanSnapshot {
  id: string;
  week_start: string;
  created_at: string;
}

export async function listPlanSnapshots(week_start: string): Promise<PlanSnapshot[]> {
  return request<PlanSnapshot[]>(`/api/v1/plan-snapshots?week_start=${week_start}`);
}

export async function restorePlanSnapshot(snapshot_id: string): Promise<{ meals_restored: number }> {
  return request<{ meals_restored: number }>(`/api/v1/plan-snapshots/${snapshot_id}/restore`, { method: 'POST' });
}

// ── Workouts (manual entry) ────────────────────────────────────────────────────

export interface ExerciseEntry {
  name: string;
  sets?: number;
  reps?: string | number;
  notes?: string;
}

export interface WorkoutEntry {
  planned_date: string;
  is_rest_day?: boolean;
  workout_type?: string;
  title?: string;
  duration_minutes?: number;
  exercises?: ExerciseEntry[];
  notes?: string;
}

export async function saveWorkout(data: WorkoutEntry): Promise<WorkoutPlan> {
  return request<WorkoutPlan>('/api/v1/workouts', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteWorkoutEntry(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/v1/workouts/${id}`, { method: 'DELETE' });
}

// ── Workout Templates ──────────────────────────────────────────────────────────

export interface WorkoutTemplate {
  id: string;
  title: string;
  workout_type: string | null;
  duration_minutes: number | null;
  exercises: ExerciseEntry[] | null;
  notes: string | null;
  created_at: string;
}

export async function getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  return request<WorkoutTemplate[]>('/api/v1/workout-templates');
}

export async function createWorkoutTemplate(data: {
  title: string;
  workout_type?: string;
  duration_minutes?: number;
  exercises?: ExerciseEntry[];
  notes?: string;
}): Promise<WorkoutTemplate> {
  return request<WorkoutTemplate>('/api/v1/workout-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteWorkoutTemplate(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/v1/workout-templates/${id}`, { method: 'DELETE' });
}

export async function scheduleWorkoutTemplate(id: string, planned_date: string): Promise<{ scheduled: boolean; date: string }> {
  return request<{ scheduled: boolean; date: string }>(`/api/v1/workout-templates/${id}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ planned_date }),
  });
}

// ── Progress ──────────────────────────────────────────────────────────────────

export async function getProgressEntries(): Promise<ProgressEntry[]> {
  return request<ProgressEntry[]>('/api/v1/progress');
}

export async function createProgressEntry(data: { week_date: string; weight_lbs?: number }): Promise<ProgressEntry> {
  return request<ProgressEntry>('/api/v1/progress', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateProgressEntry(id: string, data: { weight_lbs?: number }): Promise<ProgressEntry> {
  return request<ProgressEntry>(`/api/v1/progress/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteProgressEntry(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/v1/progress/${id}`, { method: 'DELETE' });
}

export async function uploadProgressPhoto(entryId: string, file: File, label?: string): Promise<ProgressPhoto> {
  const token = localStorage.getItem('token');
  const form = new FormData();
  form.append('file', file);
  if (label) form.append('label', label);
  const res = await fetch(`http://localhost:8000/api/v1/progress/${entryId}/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function deleteProgressPhoto(photoId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/v1/progress/photos/${photoId}`, { method: 'DELETE' });
}

