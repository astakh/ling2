const API_BASE = 'http://localhost:8000/api';

export interface User {
  id: string;
  email: string;
  name: string;
  native_lang: string;
}

export interface Profile {
  id: string;
  user_id: string;
  target_lang: string;
  cefr_level: string;
  current_lesson_number: number;
  words_per_lesson_limit: number;
  daily_lesson_limit: number;
}

export interface Stats {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_lesson_date: string | null;
  total_words_learned: number;
  total_lessons_completed: number;
}

export interface UserWord {
  id: string;
  user_language_profile_id: string;
  dictionary_id: string;
  stage: number;
  due_lesson_number: number;
  status: string;
  correct_count: number;
  incorrect_count: number;
}

export interface Lesson {
  id: string;
  user_id: string;
  user_language_profile_id: string;
  lesson_number: number;
  started_at: string;
  completed_at: string | null;
  status: string;
  total_words: number;
  correct_words: number;
  new_words_added: number;
}

export interface LessonExercise {
  id: string;
  lesson_id: string;
  order_index: number;
  target_sentence: string;
  target_word_ids: string[];
  user_translation: string | null;
  llm_response_json: any;
  status: string;
}

export interface WordResult {
  word_id: string;
  lemma: string;
  translation?: string;
  is_correct: boolean;
  has_typo: boolean;
}

export interface EvaluationResult {
  word_results: WordResult[];
  suggested_new_words: string[];
  overall_correct: boolean;
  correct_translation?: string;
}

export interface CompleteLessonResponse {
  status: string;
  lesson_id: string;
  correct_words: number;
  total_words: number;
  new_words_added: number;
  streak: number;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  console.log('[API] Request:', url, options);
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  
  console.log('[API] Response status:', response.status);
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[API] Error response:', error);
    throw new Error(`API Error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  console.log('[API] Response data:', data);
  return data;
}

// ==================== AUTH ====================

export async function registerUser(name: string, email: string): Promise<User> {
  return request<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email }),
  });
}

export async function getUser(userId: string): Promise<User> {
  return request<User>(`/user/${userId}`);
}

// ==================== PROFILE ====================

export async function setupProfile(
  userId: string,
  nativeLang: string,
  targetLang: string,
  cefrLevel: string,
  wordsPerLessonLimit: number
): Promise<Profile> {
  return request<Profile>('/profile/setup', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      native_lang: nativeLang,
      target_lang: targetLang,
      cefr_level: cefrLevel,
      words_per_lesson_limit: wordsPerLessonLimit,
    }),
  });
}

export async function getProfile(profileId: string): Promise<Profile> {
  return request<Profile>(`/profile/${profileId}`);
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  return request<Profile | null>(`/user/${userId}/profile`);
}

// ==================== STATS ====================

export async function getStats(userId: string): Promise<Stats> {
  return request<Stats>(`/stats/${userId}`);
}

// ==================== LESSONS ====================

export async function startLesson(profileId: string, forceNew: boolean = false): Promise<{
  lesson: Lesson;
  exercises: LessonExercise[];
  resumed: boolean;
}> {
  return request('/lesson/start', {
    method: 'POST',
    body: JSON.stringify({ 
      profile_id: profileId,
      force_new: forceNew 
    }),
  });
}

export async function submitTranslation(
  exerciseId: string,
  translation: string
): Promise<EvaluationResult> {
  return request<EvaluationResult>('/lesson/submit', {
    method: 'POST',
    body: JSON.stringify({
      exercise_id: exerciseId,
      translation,
    }),
  });
}

export async function completeLesson(lessonId: string): Promise<CompleteLessonResponse> {
  return request<CompleteLessonResponse>('/lesson/complete', {
    method: 'POST',
    body: JSON.stringify({
      lesson_id: lessonId,
    }),
  });
}

// ==================== WORDS ====================

export async function getUserWords(profileId: string): Promise<UserWord[]> {
  return request<UserWord[]>(`/words/${profileId}`);
}

export async function addWord(
  profileId: string,
  dictionaryId: string,
  status: string = 'active'
): Promise<{ id: string; already_exists: boolean }> {
  return request('/words/add', {
    method: 'POST',
    body: JSON.stringify({
      profile_id: profileId,
      dictionary_id: dictionaryId,
      status,
    }),
  });
}

// ==================== HEALTH ====================

export async function healthCheck(): Promise<{ status: string; version: string; mode: string }> {
  return request('/health');
}
