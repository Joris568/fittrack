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
  restSeconds?: number | null;
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
  isWarmup?: boolean;
  createdAt: string;
  /** Only present on the /workouts/exercise/:id/history endpoint. */
  workoutSession?: { date: string };
}

export interface WorkoutSession {
  id: string;
  userId: string;
  programDayId?: string | null;
  programDay?: (ProgramDay & { program: WorkoutProgram }) | null;
  date: string;
  notes?: string | null;
  finishedAt?: string | null;
  layout?: string | null;
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
  waistCm?: number | null;
  chestCm?: number | null;
  armCm?: number | null;
  thighCm?: number | null;
  hipCm?: number | null;
}

export interface ProgressPhoto {
  id: string;
  date: string;
  imageData: string;
  notes?: string | null;
}

export interface FavoriteFood {
  id: string;
  foodItem: FoodItem;
}

export interface RecentFood {
  foodItem: FoodItem;
  lastQuantityGrams: number;
}

export interface PlateauResult {
  programExerciseId: string;
  exerciseName: string;
  sessionsFlat: number;
  weights: number[];
}

export interface ParsedProgramDay {
  name: string;
  exercises: {
    exerciseName: string;
    targetSets: number;
    targetRepsMin: number;
    targetRepsMax: number;
    targetWeight?: number;
  }[];
}

export interface ParsedProgram {
  programName: string;
  days: ParsedProgramDay[];
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

export type ChatImageKind = "screenshot" | "progress";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /** Only the newest messages include their image data; older ones just a count. */
  images?: string[];
  imageCount?: number;
  imageKind?: ChatImageKind | null;
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

export interface NutritionDaySummary {
  date: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  ingredients: RecipeIngredient[];
  foodItemId: string | null;
  createdAt: string;
}

export interface ParsedRecipe {
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface RecipeIngredient {
  name: string;
  quantity: string;
  estimatedCalories: number;
}

export interface GoalProposalContent {
  challenge: string;
  reasoning: string;
  proposedGoal: {
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  };
}

export interface MealPhotoItem {
  name: string;
  estimatedGrams: number;
  source: "openfoodfacts" | "estimate";
  food: FoodSearchResult & { source?: "openfoodfacts" | "estimate" };
}

export interface MealPhotoAnalysis {
  dishName: string;
  notes: string | null;
  items: MealPhotoItem[];
}

export interface DashboardData {
  today: string;
  selected: string;
  profileMissing: boolean;
  strip: { date: string; isToday: boolean; trained: boolean; logged: boolean; proteinHit: boolean }[];
  nutrition: {
    goal: { calories: number; proteinGrams: number; carbsGrams: number; fatGrams: number } | null;
    totals: { calories: number; protein: number; carbs: number; fat: number };
  };
  workouts: { id: string; name: string; sets: number; volumeKg: number; prs: number }[];
  planned: DashboardPlanned[];
  nextWorkout: { dayId: string; dayName: string; programName: string; exerciseCount: number } | null;
  progress: {
    weight: {
      latest: number | null;
      delta: number | null;
      series: { date: string; value: number }[];
      trend: { date: string; value: number }[];
      ratePerWeek: number | null;
      ratePct: number | null;
      rateStatus: "op-schema" | "te-snel" | "te-langzaam" | null;
      goal: "bulk" | "cut" | "maintain" | null;
    };
    muscleVolume: { group: string; sets: number }[];
    missed: { id: string; date: string; title: string }[];
    calories: { average: number | null; series: { date: string; value: number }[] };
    sessionsPerWeek: { date: string; value: number }[];
    photos: { count: number; latest: { id: string; date: string; imageData: string }[] };
  };
  gamification: {
    xp: number;
    level: number;
    title: string;
    levelStartXp: number;
    nextLevelXp: number;
    streakWeeks: number;
    foodStreakDays: number;
    totalPRs: number;
    badges: number;
    quests: { key: string; title: string; target: number; progress: number; done: boolean; xp: number }[];
  };
}

export interface CalendarDay {
  sessions: { id: string; name: string; sets: number; volumeKg: number; prs: number }[];
  planned: {
    id: string;
    title: string;
    programDayId: string | null;
    programName: string | null;
    notes: string | null;
    done: boolean;
  }[];
  foodLogged: boolean;
}

export interface DashboardPlanned {
  id: string;
  title: string;
  programName: string | null;
  startable: boolean;
  done: boolean;
}

export interface UserProfile {
  heightCm: number | null;
  birthYear: number | null;
  sex: "male" | "female" | null;
  activity: "sedentary" | "light" | "moderate" | "active" | "very_active" | null;
  goal: "bulk" | "cut" | "maintain" | null;
  experience: "beginner" | "intermediate" | "advanced" | null;
  trainDays: number | null;
  injuries: string | null;
}

export interface ProfileResponse {
  profile: UserProfile | null;
  notes: string[];
  insights: {
    latestWeightKg: number | null;
    age: number | null;
    formula: number | null;
    measured: { tdee: number; kgPerWeek: number; loggedDays: number; weighIns: number } | null;
    suggestion: { calories: number; proteinGrams: number; carbsGrams: number; fatGrams: number; basedOn: string; goal: string } | null;
  };
}

export interface ExerciseGuide {
  muscles: { primary: string[]; secondary: string[] };
  steps: string[];
  cues: string[];
  mistakes: string[];
  tip?: string;
}

export interface ExerciseGuideResponse {
  exercise: { id: string; name: string; muscleGroup: string; equipment: string | null };
  guide: ExerciseGuide | null;
  source: "kennisbank" | "ai" | "none";
  videoUrl: string;
}

export interface ExerciseProgress {
  sessions: { date: string; e1rm: number; topWeight: number; topReps: number; volumeKg: number; sets: number }[];
  prCount: number;
}

export interface WorkoutSummary {
  session: { id: string; name: string; date: string; finishedAt: string | null; durationMin: number };
  totals: { sets: number; warmupSets: number; volumeKg: number; exercises: number; reps: number };
  exercises: {
    exerciseId: string;
    name: string;
    sets: { weight: number; reps: number; rpe?: number | null; isPR: boolean }[];
    best: { weight: number; reps: number };
    volumeKg: number;
    lastBest: { weight: number; reps: number } | null;
    e1rmDelta: number | null;
  }[];
  prs: { exercise: string; weight: number; reps: number }[];
  previous: { date: string; volumeKg: number | null; deltaPct: number | null } | null;
  xp: {
    gained: number;
    before: number;
    after: number;
    levelBefore: number;
    levelAfter: number;
    leveledUp: boolean;
    title: string;
    levelStartXp: number;
    nextLevelXp: number;
  };
  week: { sessions: number; target: number; streakWeeks: number };
  coachLine: string;
}
