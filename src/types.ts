export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2';
export type Language = 'en' | 'de' | 'es' | 'fr' | 'ru';
export type ExerciseStatus = 'pending' | 'completed';
export type LessonStatus = 'in_progress' | 'completed';
export type WordStatus = 'active' | 'ignored';

export interface User {
  id: string;
  email: string;
  name: string;
  nativeLang: Language;
  timezone: string;
  createdAt: string;
}

export interface UserLanguageProfile {
  id: string;
  userId: string;
  targetLang: Language;
  cefrLevel: CEFRLevel;
  currentLessonNumber: number;
  wordsPerLessonLimit: number;
  dailyLessonLimit: number;
  dictionaryCategory?: string;
  createdAt: string;
}

export interface UserStats {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastLessonDate: string | null;
  totalWordsLearned: number;
  totalLessonsCompleted: number;
}

// Aliases for API compatibility
export type Profile = UserLanguageProfile;
export type Stats = UserStats;

export interface EvaluationResult {
  word_results: WordResult[];
  suggested_new_words: string[];
  overall_correct: boolean;
  correct_translation?: string;
}

export interface WordResult {
  word_id: string;
  lemma: string;
  translation?: string;
  is_correct: boolean;
  has_typo: boolean;
}

export interface DictionaryWord {
  id: string;
  targetLang: Language;
  lemma: string;
  pos: string;
  cefrLevel: CEFRLevel;
  translations: Record<string, string[]>;
}

export interface UserWord {
  id: string;
  profileId: string;
  dictionaryId: string;
  stage: number;
  dueLessonNumber: number;
  status: WordStatus;
  correctCount: number;
  incorrectCount: number;
}

export interface LessonExercise {
  id: string;
  lessonId: string;
  orderIndex: number;
  targetSentence: string;
  targetWordIds: string[];
  userTranslation: string;
  llmResponse: LLMResponse | null;
  status: ExerciseStatus;
}

export interface Lesson {
  id: string;
  userId: string;
  profileId: string;
  lessonNumber: number;
  startedAt: string;
  completedAt: string | null;
  status: LessonStatus;
  totalWords: number;
  correctWords: number;
  newWordsAdded: number;
}

export interface LLMResponse {
  wordResults: WordResult[];
  suggestedNewWords: string[];
  overallCorrect: boolean;
}

export interface WordResult {
  wordId: string;
  lemma: string;
  isCorrect: boolean;
  hasTypo: boolean;
}

export interface LessonSession {
  lesson: Lesson;
  exercises: LessonExercise[];
  currentExerciseIndex: number;
  todayWords: DictionaryWord[];
  wordGroups: DictionaryWord[][];
}
