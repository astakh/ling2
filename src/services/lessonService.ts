import { v4 as uuidv4 } from 'uuid';
import { DictionaryWord, Lesson, LessonExercise, UserWord, LessonSession } from '../types';
import * as store from '../store';
import { getDictionary } from '../data/dictionaries';
import { generateSentences } from './llmService';

// Cluster words into groups of 2-3
function clusterWords(words: DictionaryWord[]): DictionaryWord[][] {
  const groups: DictionaryWord[][] = [];
  const n = words.length;
  
  if (n <= 3) {
    return [words];
  }
  
  // Split into groups of 2-3
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

// Check for due words (words that need review)
function getDueWords(profileId: string, currentLessonNumber: number): UserWord[] {
  const userWords = store.getUserWords();
  return userWords.filter(
    w => w.profileId === profileId && 
         w.status === 'active' && 
         w.dueLessonNumber <= currentLessonNumber
  );
}

// Start a new lesson
export function startLesson(): LessonSession | null {
  const user = store.getUser();
  const profile = store.getProfile();
  if (!user || !profile) return null;
  
  // Check for in-progress lesson
  const inProgress = store.getInProgressLesson();
  if (inProgress) {
    const exercises = store.getExercises(inProgress.id);
    const pendingExercise = exercises.find(e => e.status === 'pending');
    if (pendingExercise) {
      const currentIndex = exercises.findIndex(e => e.id === pendingExercise.id);
      return {
        lesson: inProgress,
        exercises,
        currentExerciseIndex: currentIndex >= 0 ? currentIndex : 0,
        todayWords: [],
        wordGroups: [],
      };
    }
  }
  
  // Check daily limit
  const todayData = store.getLessonsToday();
  const today = new Date().toISOString().split('T')[0];
  const todayCount = todayData.date === today ? todayData.count : 0;
  if (todayCount >= profile.dailyLessonLimit) {
    return null; // Daily limit reached
  }
  
  // Get due words for review
  const dueUserWords = getDueWords(profile.id, profile.currentLessonNumber);
  const dictionary = getDictionary(profile.targetLang);
  
  // Get dictionary words for due words
  const dueDictWords: DictionaryWord[] = dueUserWords
    .map(uw => dictionary.find(d => d.id === uw.dictionaryId))
    .filter((w): w is DictionaryWord => w !== undefined);
  
  // Get new words to fill up to limit
  const learnedIds = new Set(store.getUserWords().map(w => w.dictionaryId));
  const availableNewWords = dictionary.filter(w => !learnedIds.has(w.id));
  
  const neededNew = Math.max(0, profile.wordsPerLessonLimit - dueDictWords.length);
  const newWords = availableNewWords.slice(0, neededNew);
  
  // Combine all today's words
  const todayWords = [...dueDictWords, ...newWords];
  
  if (todayWords.length === 0) {
    // No words available - add all words from dictionary
    const allWords = dictionary.slice(0, profile.wordsPerLessonLimit);
    todayWords.push(...allWords);
  }
  
  // Cluster into groups
  const wordGroups = clusterWords(todayWords);
  
  // Generate sentences for each group
  const sentences = generateSentences(wordGroups, profile.targetLang);
  
  // Create lesson
  const lessonNumber = profile.currentLessonNumber + 1;
  const lesson: Lesson = {
    id: uuidv4(),
    userId: user.id,
    profileId: profile.id,
    lessonNumber,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'in_progress',
    totalWords: todayWords.length,
    correctWords: 0,
    newWordsAdded: 0,
  };
  
  // Create exercises
  const exercises: LessonExercise[] = wordGroups.map((group, index) => ({
    id: uuidv4(),
    lessonId: lesson.id,
    orderIndex: index + 1,
    targetSentence: sentences[index],
    targetWordIds: group.map(w => w.id),
    userTranslation: '',
    llmResponse: null,
    status: 'pending' as const,
  }));
  
  // Save to store
  store.saveLesson(lesson);
  store.saveExercises(exercises);
  
  // Update profile
  profile.currentLessonNumber = lessonNumber;
  store.saveProfile(profile);
  
  return {
    lesson,
    exercises,
    currentExerciseIndex: 0,
    todayWords,
    wordGroups,
  };
}

// Complete an exercise
export function completeExercise(
  lessonId: string,
  exerciseId: string,
  userTranslation: string,
  llmResponse: any
): void {
  const allExercises = store.getExercises(lessonId);
  const exercise = allExercises.find(e => e.id === exerciseId);
  if (exercise) {
    exercise.userTranslation = userTranslation;
    exercise.llmResponse = llmResponse;
    exercise.status = 'completed';
    store.saveExercise(exercise);
  }
}

// Update word stages after exercise
export function updateWordStages(profileId: string, wordResults: any[]): void {
  const userWords = store.getUserWords();
  
  wordResults.forEach(result => {
    const userWord = userWords.find(w => w.dictionaryId === result.wordId);
    if (userWord) {
      if (result.isCorrect) {
        userWord.stage = Math.min(userWord.stage + 1, 10);
        userWord.correctCount += 1;
      } else {
        userWord.stage = Math.max(userWord.stage - 1, 0);
        userWord.incorrectCount += 1;
      }
      // Set next due based on stage (spaced repetition)
      const intervals = [1, 2, 4, 7, 14, 21, 30, 45, 60, 90];
      const interval = intervals[Math.min(userWord.stage, intervals.length - 1)];
      const profile = store.getProfile();
      if (profile) {
        userWord.dueLessonNumber = profile.currentLessonNumber + interval;
      }
    }
  });
  
  store.saveUserWords(userWords);
}

// Add new words from exercise
export function addNewWords(profileId: string, wordIds: string[]): void {
  const dictionary = getDictionary(store.getProfile()?.targetLang || 'en');
  const userWords = store.getUserWords();
  const existingIds = new Set(userWords.map(w => w.dictionaryId));
  const profile = store.getProfile();
  
  wordIds.forEach(dictId => {
    if (!existingIds.has(dictId)) {
      const newWord: UserWord = {
        id: uuidv4(),
        profileId,
        dictionaryId: dictId,
        stage: 0,
        dueLessonNumber: (profile?.currentLessonNumber || 1) + 1,
        status: 'active',
        correctCount: 0,
        incorrectCount: 0,
      };
      userWords.push(newWord);
    }
  });
  
  store.saveUserWords(userWords);
}

// Complete lesson
export function completeLesson(lessonId: string, correctCount: number, newWordsCount: number): void {
  const lessons = store.getLessons();
  const index = lessons.findIndex(l => l.id === lessonId);
  const lesson = index !== -1 ? lessons[index] : null;
  let addedWordsCount = newWordsCount;
  
  if (lesson) {
    // Add all words from this lesson to user_words (if not already there)
    const exercises = store.getExercises(lessonId);
    const profile = store.getProfile();
    const allWordIds = new Set<string>();
    
    exercises.forEach(ex => {
      ex.targetWordIds.forEach((id: string) => allWordIds.add(id));
    });
    
    if (profile) {
      const existingUserWords = store.getUserWords();
      const existingDictIds = new Set(existingUserWords.map(w => w.dictionaryId));
      
      allWordIds.forEach(dictId => {
        if (!existingDictIds.has(dictId)) {
          const newWord: UserWord = {
            id: uuidv4(),
            profileId: profile.id,
            dictionaryId: dictId,
            stage: 0,
            dueLessonNumber: profile.currentLessonNumber + 1,
            status: 'active',
            correctCount: 0,
            incorrectCount: 0,
          };
          store.addUserWord(newWord);
        }
      });
    }
    
    addedWordsCount = allWordIds.size;
    
    // Update lesson
    lessons[index].status = 'completed';
    lessons[index].completedAt = new Date().toISOString();
    lessons[index].correctWords = correctCount;
    lessons[index].newWordsAdded = addedWordsCount;
    store.saveLesson(lessons[index]);
  }
  
  // Update stats
  const stats = store.getStats();
  if (stats) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (stats.lastLessonDate === yesterday) {
      stats.currentStreak += 1;
    } else if (stats.lastLessonDate !== today) {
      stats.currentStreak = 1;
    }
    
    stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
    stats.lastLessonDate = today;
    stats.totalLessonsCompleted += 1;
    stats.totalWordsLearned += addedWordsCount;
    
    store.saveStats(stats);
  }
  
  // Increment daily counter
  store.incrementLessonsToday();
}
