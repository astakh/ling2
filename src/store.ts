import { User, Profile, Stats, UserWord, Lesson, LessonExercise } from './types';

const STORAGE_KEYS = {
  USER_ID: 'lingo_user_id',
  PROFILE_ID: 'lingo_profile_id',
  USER: 'lingo_user',
  PROFILE: 'lingo_profile',
  STATS: 'lingo_stats',
};

// ==================== LOCAL STORAGE HELPERS ====================

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

// ==================== USER ID & PROFILE ID ====================

export function getUserId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.USER_ID);
}

export function setUserId(userId: string): void {
  localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
}

export function getProfileId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.PROFILE_ID);
}

export function setProfileId(profileId: string): void {
  localStorage.setItem(STORAGE_KEYS.PROFILE_ID, profileId);
}

// ==================== USER (cached) ====================

export function getUser(): User | null {
  return getItem<User | null>(STORAGE_KEYS.USER, null);
}

export function saveUser(user: User): void {
  setItem(STORAGE_KEYS.USER, user);
  setUserId(user.id);
}

// ==================== PROFILE (cached) ====================

export function getProfile(): Profile | null {
  return getItem<Profile | null>(STORAGE_KEYS.PROFILE, null);
}

export function saveProfile(profile: Profile): void {
  setItem(STORAGE_KEYS.PROFILE, profile);
  setProfileId(profile.id);
}

// ==================== STATS (cached) ====================

export function getStats(): Stats | null {
  return getItem<Stats | null>(STORAGE_KEYS.STATS, null);
}

export function saveStats(stats: Stats): void {
  setItem(STORAGE_KEYS.STATS, stats);
}

// ==================== RESET ====================

export function resetAll(): void {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}
