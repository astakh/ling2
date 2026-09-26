import { User, UserLanguageProfile, UserStats, UserWord, Lesson, LessonExercise } from './types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEYS = {
  USER: 'lingo_user',
  PROFILE: 'lingo_profile',
  STATS: 'lingo_stats',
  USER_WORDS: 'lingo_user_words',
  LESSONS: 'lingo_lessons',
  EXERCISES: 'lingo_exercises',
  CURRENT_SESSION: 'lingo_current_session',
  LESSONS_TODAY: 'lingo_lessons_today',
};

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// User
export function getUser(): User | null {
  return getItem<User | null>(STORAGE_KEYS.USER, null);
}

export function saveUser(user: User): void {
  setItem(STORAGE_KEYS.USER, user);
}

// Profile
export function getProfile(): UserLanguageProfile | null {
  return getItem<UserLanguageProfile | null>(STORAGE_KEYS.PROFILE, null);
}

export function saveProfile(profile: UserLanguageProfile): void {
  setItem(STORAGE_KEYS.PROFILE, profile);
}

// Stats
export function getStats(): UserStats | null {
  return getItem<UserStats | null>(STORAGE_KEYS.STATS, null);
}

export function saveStats(stats: UserStats): void {
  setItem(STORAGE_KEYS.STATS, stats);
}

// User Words
export function getUserWords(): UserWord[] {
  return getItem<UserWord[]>(STORAGE_KEYS.USER_WORDS, []);
}

export function saveUserWords(words: UserWord[]): void {
  setItem(STORAGE_KEYS.USER_WORDS, words);
}

export function addUserWord(word: UserWord): void {
  const words = getUserWords();
  words.push(word);
  saveUserWords(words);
}

export function updateUserWord(wordId: string, updates: Partial<UserWord>): void {
  const words = getUserWords();
  const index = words.findIndex(w => w.id === wordId);
  if (index !== -1) {
    words[index] = { ...words[index], ...updates };
    saveUserWords(words);
  }
}

// Lessons
export function getLessons(): Lesson[] {
  return getItem<Lesson[]>(STORAGE_KEYS.LESSONS, []);
}

export function saveLesson(lesson: Lesson): void {
  const lessons = getLessons();
  const index = lessons.findIndex(l => l.id === lesson.id);
  if (index !== -1) {
    lessons[index] = lesson;
  } else {
    lessons.push(lesson);
  }
  setItem(STORAGE_KEYS.LESSONS, lessons);
}

export function getInProgressLesson(): Lesson | null {
  const lessons = getLessons();
  return lessons.find(l => l.status === 'in_progress') || null;
}

// Exercises
export function getExercises(lessonId: string): LessonExercise[] {
  const all = getItem<LessonExercise[]>(STORAGE_KEYS.EXERCISES, []);
  return all.filter(e => e.lessonId === lessonId).sort((a, b) => a.orderIndex - b.orderIndex);
}

export function saveExercise(exercise: LessonExercise): void {
  const all = getItem<LessonExercise[]>(STORAGE_KEYS.EXERCISES, []);
  const index = all.findIndex(e => e.id === exercise.id);
  if (index !== -1) {
    all[index] = exercise;
  } else {
    all.push(exercise);
  }
  setItem(STORAGE_KEYS.EXERCISES, all);
}

export function saveExercises(exercises: LessonExercise[]): void {
  const all = getItem<LessonExercise[]>(STORAGE_KEYS.EXERCISES, []);
  const otherExercises = all.filter(e => !exercises.some(ex => ex.id === e.id));
  setItem(STORAGE_KEYS.EXERCISES, [...otherExercises, ...exercises]);
}

// Lessons today counter
export function getLessonsToday(): { date: string; count: number } {
  return getItem(STORAGE_KEYS.LESSONS_TODAY, { date: '', count: 0 });
}

export function incrementLessonsToday(): void {
  const today = new Date().toISOString().split('T')[0];
  const data = getLessonsToday();
  if (data.date === today) {
    data.count += 1;
  } else {
    data.date = today;
    data.count = 1;
  }
  setItem(STORAGE_KEYS.LESSONS_TODAY, data);
}

// Reset all data
export function resetAll(): void {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}

// Create new user
export function createUser(name: string, email: string, nativeLang: string, timezone: string): User {
  return {
    id: uuidv4(),
    email,
    name,
    nativeLang: nativeLang as any,
    timezone,
    createdAt: new Date().toISOString(),
  };
}

export function createProfile(userId: string, targetLang: string, cefrLevel: string): UserLanguageProfile {
  return {
    id: uuidv4(),
    userId,
    targetLang: targetLang as any,
    cefrLevel: cefrLevel as any,
    currentLessonNumber: 0,
    wordsPerLessonLimit: 5,
    dailyLessonLimit: 3,
    createdAt: new Date().toISOString(),
  };
}

export function createStats(userId: string): UserStats {
  return {
    userId,
    currentStreak: 0,
    longestStreak: 0,
    lastLessonDate: null,
    totalWordsLearned: 0,
    totalLessonsCompleted: 0,
  };
}
