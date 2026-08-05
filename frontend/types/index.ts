export interface NutritionInfo {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  cholesterol_mg: number | null;
}

export interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  ingredients: Ingredient[];
  steps: string[];
  prep_time: number | null;
  cook_time: number | null;
  total_time: number | null;
  servings: number | null;
  nutrition: NutritionInfo | null;
  category: string | null;
  cuisine: string | null;
  source_url: string | null;
  image_url: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface FoodLogEntry {
  id: string;
  recipe_id: string | null;
  log_date: string;
  meal_slot: string;
  name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  servings: number;
  created_at: string;
}

export interface MealPlanEntry {
  id: string;
  meal_slot: string;
  planned_date: string;
  servings: number;
  recipe?: Recipe;
}

export interface WorkoutExercise {
  name: string;
  sets?: number;
  reps?: number;
  duration?: string;
  notes?: string;
}

export interface WorkoutPlan {
  id: string;
  planned_date: string;
  is_rest_day: boolean;
  workout_type: string | null;
  title: string | null;
  duration_minutes: number | null;
  exercises: WorkoutExercise[] | null;
  notes: string | null;
}

export interface UserProfile {
  id: string;
  user_id: string;
  age: number | null;
  sex: string | null;
  height_ft: number | null;
  height_in: number | null;
  weight_lbs: number | null;
  target_weight_lbs: number | null;
  primary_goal: string | null;
  timeline: string | null;
  activity_level: string | null;
  fitness_level: string | null;
  workouts_per_week: number | null;
  equipment: string[] | null;
  workout_types: string[] | null;
  injuries: string | null;
  diet_type: string | null;
  allergies: string[] | null;
  cuisine_preferences: string[] | null;
  disliked_foods: string | null;
  cooking_skill: string | null;
  max_cook_time: string | null;
  weekly_budget: number | null;
}

export interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  category: string | null;
  location: string | null;
  notes: string | null;
}

export interface ShoppingIngredient {
  ingredient: string;
  to_buy: number;
  unit: string;
  have_in_inventory: number;
  used_in: string[];
}

export interface ShoppingList {
  items_to_buy: ShoppingIngredient[];
  already_have: ShoppingIngredient[];
}

export interface GeneratePlanResult {
  meals_created: number;
  tdee: number;
  week_start: string;
}

export interface RecipeListResponse {
  recipes: Recipe[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ProgressPhoto {
  id: string;
  progress_entry_id: string;
  url: string;
  label: string | null;
  created_at: string;
}

export interface ProgressEntry {
  id: string;
  week_date: string;
  weight_lbs: number | null;
  created_at: string;
}

