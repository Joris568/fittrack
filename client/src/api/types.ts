export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment?: string | null;
  notes?: string | null;
  isCustom: boolean;
}

export interface ProgramExercise {
  id: string;
  exerciseId: string;
  exercise: Exercise;
  order: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeight?: number | null;
  targetRpe?: number | null;
  notes?: string | null;
}

export interface ProgramDay {
  id: string;
  programId: string;
  name: string;
  order: number;
  exercises: ProgramExercise[];
}

export interface WorkoutProgram {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  days: ProgramDay[];
}

export interface SetLog {
  id: string;
  workoutSessionId: string;
  exerciseId: string;
  exercise: Exercise;
  setNumber: number;
  reps: number;
  weight: number;
  rpe?: number | null;
  notes?: string | null;
  isPR: boolean;
  createdAt: string;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  programDayId?: string | null;
  programDay?: (ProgramDay & { program: WorkoutProgram }) | null;
  date: string;
  notes?: string | null;
  setLogs: SetLog[];
}

export interface FoodItem {
  id: string;
  source: string;
  barcode?: string | null;
  name: string;
  brand?: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number | null;
}

export interface FoodSearchResult {
  barcode: string | null;
  name: string;
  brand: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number | null;
}

export interface FoodLogEntry {
  id: string;
  foodItemId: string;
  foodItem: FoodItem;
  date: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  quantityGrams: number;
}

export interface NutritionGoal {
  id: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  effectiveFrom: string;
}

export interface BodyMetric {
  id: string;
  date: string;
  weightKg: number;
  bodyFatPct?: number | null;
}

export interface AiInsight<T = unknown> {
  id: string;
  type: "workout_suggestion" | "nutrition_advice" | "weekly_report";
  content: T;
  status: "pending" | "accepted" | "dismissed";
  createdAt: string;
}

export interface WorkoutSuggestion {
  programExerciseId: string;
  exerciseName: string;
  action: "increase_weight" | "increase_reps" | "deload" | "swap" | "keep";
  reasoning: string;
  newTargetWeight?: number;
  newTargetRepsMin?: number;
  newTargetRepsMax?: number;
}

export interface WeeklyReportContent {
  summary: string;
  wins: string[];
  concerns: string[];
  recommendations: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface UnlockedAchievement {
  key: string;
  title: string;
  description: string;
}

export interface AchievementStatus extends UnlockedAchievement {
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface GamificationSummary {
  streakWeeks: number;
  totalWorkouts: number;
  totalPRs: number;
  achievements: AchievementStatus[];
}

export interface WithAchievements {
  newAchievements: UnlockedAchievement[];
}
