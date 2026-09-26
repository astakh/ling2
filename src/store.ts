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
  const userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
  console.log('[Store] getUserId():', userId);
  return userId;
}

export function setUserId(userId: string): void {
  console.log('[Store] setUserId():', userId);
  localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
}

export function getProfileId(): string | null {
  const profileId = localStorage.getItem(STORAGE_KEYS.PROFILE_ID);
  console.log('[Store] getProfileId():', profileId);
  return profileId;
}

export function setProfileId(profileId: string): void {
  console.log('[Store] setProfileId():', profileId);
  localStorage.setItem(STORAGE_KEYS.PROFILE_ID, profileId);
}

// ==================== USER (cached) ====================

export function getUser(): User | null {
  const user = getItem<User | null>(STORAGE_KEYS.USER, null);
  console.log('[Store] getUser():', user);
  return user;
}

export function saveUser(user: User): void {
  console.log('[Store] saveUser():', user);
  setItem(STORAGE_KEYS.USER, user);
  setUserId(user.id);
  console.log('[Store] User saved to localStorage');
}

// ==================== PROFILE (cached) ====================

export function getProfile(): Profile | null {
  const profile = getItem<Profile | null>(STORAGE_KEYS.PROFILE, null);
  console.log('[Store] getProfile():', profile);
  return profile;
}

export function saveProfile(profile: Profile): void {
  console.log('[Store] saveProfile():', profile);
  setItem(STORAGE_KEYS.PROFILE, profile);
  setProfileId(profile.id);
  console.log('[Store] Profile saved to localStorage');
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
