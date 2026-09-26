import { startLesson as apiStartLesson, submitTranslation, getUserWords, getStats, EvaluationResult } from './api';
import { getProfileId } from '../store';
import { DictionaryWord, Lesson, LessonExercise } from '../types';
import { getDictionary } from '../data/dictionaries';

// Cluster words into groups of 2-3
function clusterWords(words: DictionaryWord[]): DictionaryWord[][] {
  const groups: DictionaryWord[][] = [];
  const n = words.length;
  
  if (n <= 3) {
    return [words];
  }
  
  let i = 0;
  while (i < n) {
    const remaining = n - i;
    if (remaining <= 3) {
      groups.push(words.slice(i));
      break;
    } else if (remaining === 4) {
      groups.push(words.slice(i, i + 2));
      groups.push(words.slice(i + 2));
      break;
    } else if (remaining === 5) {
      groups.push(words.slice(i, i + 2));
      groups.push(words.slice(i + 2));
      break;
    } else {
      groups.push(words.slice(i, i + 3));
      i += 3;
    }
  }
  
  return groups;
}

export interface LessonSession {
  lesson: Lesson;
  exercises: LessonExercise[];
  currentExerciseIndex: number;
  todayWords: DictionaryWord[];
  wordGroups: DictionaryWord[][];
}

// Start a new lesson via API
export async function startLesson(forceNew: boolean = false): Promise<LessonSession | null> {
  console.log('[LessonService] startLesson() called, forceNew:', forceNew);
  const profileId = getProfileId();
  console.log('[LessonService] Profile ID:', profileId);
  if (!profileId) {
    console.error('[LessonService] No profile ID found');
    return null;
  }
  
  try {
    console.log('[LessonService] Calling API startLesson with forceNew:', forceNew);
    const response = await apiStartLesson(profileId, forceNew);
    console.log('[LessonService] API response:', response);
    
    // Get dictionary words for target_word_ids
    const profile = JSON.parse(localStorage.getItem('lingo_profile') || '{}');
    const dictionary = getDictionary(profile.targetLang || 'en');
    
    // Collect all unique word IDs
    const allWordIds = new Set<string>();
    response.exercises.forEach(ex => {
      ex.target_word_ids.forEach((id: string) => allWordIds.add(id));
    });
    
    // Get dictionary words
    const todayWords: DictionaryWord[] = [];
    allWordIds.forEach(id => {
      const word = dictionary.find(d => d.id === id);
      if (word) todayWords.push(word);
    });
    
    // Cluster words (for display purposes)
    const wordGroups = clusterWords(todayWords);
    
    // Convert API response to frontend format
    const lesson: any = {
      id: response.lesson.id,
      userId: response.lesson.user_id,
      profileId: response.lesson.user_language_profile_id,
      lessonNumber: response.lesson.lesson_number,
      startedAt: response.lesson.started_at,
      completedAt: response.lesson.completed_at,
      status: response.lesson.status,
      totalWords: response.lesson.total_words,
      correctWords: response.lesson.correct_words,
      newWordsAdded: response.lesson.new_words_added,
    };
    
    const exercises: LessonExercise[] = response.exercises.map(ex => ({
      id: ex.id,
      lessonId: ex.lesson_id,
      orderIndex: ex.order_index,
      targetSentence: ex.target_sentence,
      targetWordIds: ex.target_word_ids,
      userTranslation: ex.user_translation || '',
      llmResponse: ex.llm_response_json,
      status: ex.status as any,
    }));
    
    // Find first pending exercise
    const pendingIndex = exercises.findIndex(e => e.status === 'pending');
    
    return {
      lesson,
      exercises,
      currentExerciseIndex: pendingIndex >= 0 ? pendingIndex : 0,
      todayWords,
      wordGroups,
    };
  } catch (err) {
    console.error('Failed to start lesson:', err);
    return null;
  }
}

// Submit translation via API
export async function submitExerciseTranslation(
  exerciseId: string,
  translation: string
): Promise<EvaluationResult | null> {
  try {
    return await submitTranslation(exerciseId, translation);
  } catch (err) {
    console.error('Failed to submit translation:', err);
    return null;
  }
}

// Get user words from API
export async function fetchUserWords(): Promise<any[]> {
  const profileId = getProfileId();
  if (!profileId) return [];
  
  try {
    return await getUserWords(profileId);
  } catch (err) {
    console.error('Failed to fetch user words:', err);
    return [];
  }
}

// Get stats from API
export async function fetchStats(): Promise<any | null> {
  const userId = localStorage.getItem('lingo_user_id');
  if (!userId) return null;
  
  try {
    return await getStats(userId);
  } catch (err) {
    console.error('Failed to fetch stats:', err);
    return null;
  }
}
