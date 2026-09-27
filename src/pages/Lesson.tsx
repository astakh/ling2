import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Loader2, X, Plus, CheckCircle, Trash2 } from 'lucide-react';
import { getProfile, getUser } from '../store';
import { startLesson, submitExerciseTranslation, completeLesson } from '../services/lessonService';
import { DictionaryWord, LessonExercise } from '../types';
import { EvaluationResult, markWordLearned, addWord } from '../services/api';

export default function Lesson() {
  const navigate = useNavigate();
  const profile = getProfile();
  const user = getUser();
  const [translation, setTranslation] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<EvaluationResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [exerciseIndex, setExerciseIndex] = useState(-1);
  const [exercises, setExercises] = useState<LessonExercise[]>([]);
  const [lesson, setLesson] = useState<any>(null);
  const [targetWords, setTargetWords] = useState<DictionaryWord[]>([]);
  const [ignoredWords, setIgnoredWords] = useState<Set<string>>(new Set());
  const [addedWords, setAddedWords] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [showNewWords, setShowNewWords] = useState(false);
  const [newWords, setNewWords] = useState<Array<{id: string, lemma: string, pos: string, translations: string[]}>>([]);
  const [removedNewWords, setRemovedNewWords] = useState<Set<string>>(new Set());

  // Initialize lesson
  useEffect(() => {
    console.log('[Lesson] Component mounted');
    console.log('[Lesson] User:', user);
    console.log('[Lesson] Profile:', profile);
    
    // Получаем данные урока из sessionStorage (установлены в Dashboard)
    const lessonData = sessionStorage.getItem('currentLesson');
    if (lessonData) {
      console.log('[Lesson] Loading lesson from sessionStorage');
      const session = JSON.parse(lessonData);
      setupLesson(session);
    } else {
      console.error('[Lesson] No lesson data in sessionStorage, navigating to dashboard');
      navigate('/dashboard');
    }
  }, []);

  const [todayWords, setTodayWords] = useState<DictionaryWord[]>([]);

  const setupLesson = (session: any) => {
    console.log('[Lesson] Setting up lesson state');
    setLesson(session.lesson);
    setExercises(session.exercises);
    setExerciseIndex(session.currentExerciseIndex);
    setTodayWords(session.todayWords); // Save today's words from API
    
    // Show new words if this is a new lesson (not resumed)
    if (session.newWords && session.newWords.length > 0 && !session.resumed) {
      console.log('[Lesson] New words to show:', session.newWords);
      setNewWords(session.newWords);
      setShowNewWords(true);
    } else {
      setInitialized(true);
    }
    
    console.log('[Lesson] Lesson initialized successfully, todayWords:', session.todayWords.length);
  };

  // Update target words when exercise changes
  useEffect(() => {
    if (exercises.length > 0 && exerciseIndex >= 0 && exerciseIndex < exercises.length) {
      const exercise = exercises[exerciseIndex];
      if (exercise && todayWords.length > 0) {
        // Use todayWords from API instead of local dictionary
        const words = exercise.targetWordIds
          .map((id: string) => todayWords.find(d => d.id === id))
          .filter((w: DictionaryWord | undefined): w is DictionaryWord => w !== undefined);
        console.log('[Lesson] Target words for exercise:', words.length, words.map(w => w.lemma));
        setTargetWords(words);
      }
    }
  }, [exercises, exerciseIndex, todayWords]);

  const currentExercise = exerciseIndex >= 0 ? exercises[exerciseIndex] : null;

  const handleCheck = async () => {
    if (!translation.trim() || !currentExercise || !profile || !user || !lesson) return;
    
    setLoading(true);
    
    // Submit translation via API
    const result = await submitExerciseTranslation(currentExercise.id, translation);
    
    if (result) {
      setCurrentResult(result);
      setShowResult(true);
      
      // Update exercise locally
      const updatedExercise: LessonExercise = {
        ...currentExercise,
        userTranslation: translation,
        llmResponse: result as any,
        status: 'completed',
      };
      
      const newExercises = [...exercises];
      newExercises[exerciseIndex] = updatedExercise;
      setExercises(newExercises);
    }
    
    setLoading(false);
  };

  const handleNext = async () => {
    setShowResult(false);
    setTranslation('');
    setCurrentResult(null);
    setIgnoredWords(new Set()); // Reset ignored words for next exercise
    setAddedWords(new Set()); // Reset added words for next exercise
    
    const nextIndex = exerciseIndex + 1;
    if (nextIndex >= exercises.length) {
      // All exercises done - complete the lesson
      console.log('[Lesson] All exercises done, completing lesson...');
      if (lesson) {
        const result = await completeLesson(lesson.id);
        console.log('[Lesson] Lesson completed:', result);
      }
      
      // Очищаем sessionStorage после завершения урока
      console.log('[Lesson] Clearing sessionStorage');
      sessionStorage.removeItem('currentLesson');
      
      navigate('/complete');
    } else {
      setExerciseIndex(nextIndex);
    }
  };

  const handleMarkAsLearned = async (dictionaryId: string) => {
    if (!profile) return;
    
    console.log('[Lesson] Marking word as learned:', dictionaryId);
    
    try {
      await markWordLearned(profile.id, dictionaryId);
      console.log('[Lesson] Word marked as learned successfully');
      
      // Update local state
      setIgnoredWords(prev => new Set([...prev, dictionaryId]));
    } catch (error) {
      console.error('[Lesson] Failed to mark word as learned:', error);
    }
  };

  const handleAddWord = async (dictionaryId: string) => {
    if (!profile) return;
    
    console.log('[Lesson] Adding word to dictionary:', dictionaryId);
    
    try {
      await addWord(profile.id, dictionaryId, 'active');
      console.log('[Lesson] Word added successfully');
      
      // Update local state
      setAddedWords(prev => new Set([...prev, dictionaryId]));
    } catch (error) {
      console.error('[Lesson] Failed to add word:', error);
    }
  };

  const handleRemoveNewWord = async (dictionaryId: string) => {
    if (!profile) return;
    
    console.log('[Lesson] Removing new word and marking as learned:', dictionaryId);
    
    try {
      await markWordLearned(profile.id, dictionaryId);
      console.log('[Lesson] Word marked as learned successfully');
      
      // Update local state
      setRemovedNewWords(prev => new Set([...prev, dictionaryId]));
    } catch (error) {
      console.error('[Lesson] Failed to remove word:', error);
    }
  };

  // Show new words screen before starting the lesson
  if (showNewWords) {
    return (
      <div className="min-h-screen p-4 flex flex-col">
        <div className="max-w-lg mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2 mb-8">
              <div className="text-6xl">📚</div>
              <h1 className="text-2xl font-bold text-gray-800">Новые слова для изучения</h1>
              <p className="text-gray-500">Запомни эти слова перед началом урока</p>
              <p className="text-sm text-gray-400">💡 Можешь пометить слово как выученное, если уже знаешь его</p>
            </div>

            <div className="space-y-3">
              {newWords.map((word, index) => {
                const isRemoved = removedNewWords.has(word.id);
                return (
                  <motion.div
                    key={word.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: isRemoved ? 0.5 : 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`bg-white rounded-2xl p-5 shadow-sm border ${
                      isRemoved ? 'border-gray-300 bg-gray-50' : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className={`text-2xl font-bold mb-2 ${
                          isRemoved ? 'text-gray-400 line-through' : 'text-indigo-800'
                        }`}>
                          {word.lemma}
                        </div>
                        <div className="text-sm text-gray-500 mb-2">
                          {word.pos}
                        </div>
                        <div className={`text-lg ${isRemoved ? 'text-gray-400' : 'text-gray-700'}`}>
                          {word.translations.join(', ')}
                        </div>
                        {isRemoved && (
                          <div className="text-sm text-green-600 mt-2 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Помечено как выученное
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-4xl opacity-20">
                          {index + 1}
                        </div>
                        {!isRemoved && (
                          <button
                            onClick={() => handleRemoveNewWord(word.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Пометить как выученное и удалить из списка"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {removedNewWords.size > 0 && (
              <div className="text-center text-sm text-gray-500">
                Помечено как выученные: {removedNewWords.size} из {newWords.length}
              </div>
            )}
            
            <button
              onClick={() => {
                setShowNewWords(false);
                setInitialized(true);
              }}
              className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
            >
              {removedNewWords.size > 0 
                ? `Начать урок → (${newWords.length - removedNewWords.size} слов для изучения)`
                : 'Начать урок →'
              }
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!initialized || !currentExercise || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
          <p className="text-gray-500">Загрузка урока...</p>
        </div>
      </div>
    );
  }

  const progress = ((exerciseIndex) / exercises.length) * 100;
  const nextProgress = ((exerciseIndex + 1) / exercises.length) * 100;

  return (
    <div className="min-h-screen p-4 flex flex-col">
      {/* Header */}
      <div className="max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              if (confirm('Выйти из урока? Прогресс будет сохранён.')) {
                // Не очищаем sessionStorage, чтобы можно было вернуться к уроку
                navigate('/dashboard');
              }
            }}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="text-sm text-gray-500 font-medium">
            {exerciseIndex + 1} / {exercises.length}
          </div>
          <div className="w-9" />
        </div>

        {/* Progress bar */}
        <div className="h-2.5 bg-gray-200 rounded-full mb-8 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            initial={{ width: `${progress}%` }}
            animate={{ width: showResult ? `${nextProgress}%` : `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>

        {/* Target words hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6"
        >
          <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-medium">
            🎯 Переведи эти слова:
          </div>
          <div className="flex flex-wrap gap-2">
            {targetWords.map(word => {
              const isIgnored = ignoredWords.has(word.id);
              return (
                <div
                  key={word.id}
                  className={`relative px-3 py-2 rounded-xl shadow-sm transition-all ${
                    isIgnored 
                      ? 'bg-gray-100 border border-gray-200 opacity-50' 
                      : 'bg-white border border-indigo-200'
                  }`}
                >
                  <div className={`font-semibold ${isIgnored ? 'text-gray-400 line-through' : 'text-indigo-800'}`}>
                    {word.lemma}
                  </div>
                  {!isIgnored && (
                    <button
                      onClick={() => {
                        handleMarkAsLearned(word.id);
                      }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                      title="Пометить как выученное"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Main content */}
        <AnimatePresence mode="wait">
          {!showResult ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Sentence card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                <div className="text-xs text-gray-400 mb-3 uppercase tracking-wider font-medium">
                  📝 Переведи предложение
                </div>
                <p className="text-xl font-medium text-gray-800 leading-relaxed">
                  {currentExercise.targetSentence}
                </p>
              </div>

              {/* Translation input */}
              <div>
                <textarea
                  value={translation}
                  onChange={(e) => setTranslation(e.target.value)}
                  placeholder="Введи перевод на русский..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none transition-colors text-lg resize-none h-28"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleCheck();
                    }
                  }}
                  autoFocus
                />
              </div>

              <button
                onClick={handleCheck}
                disabled={!translation.trim() || loading}
                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Проверяю...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Проверить
                  </>
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Result card */}
              <div className={`rounded-2xl p-6 border-2 ${
                currentResult?.overall_correct 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-orange-50 border-orange-200'
              }`}>
                <div className="text-xl font-bold mb-4 flex items-center gap-2">
                  {currentResult?.overall_correct ? (
                    <><span className="text-2xl">✅</span> Отлично!</>
                  ) : (
                    <><span className="text-2xl">⚠️</span> Есть что исправить</>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="text-sm bg-white/60 rounded-lg p-3">
                    <span className="text-gray-400">Твой перевод:</span>{' '}
                    <span className="font-medium text-gray-800">{translation}</span>
                  </div>
                  
                  {currentResult?.correct_translation && (
                    <div className="text-sm bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <span className="text-blue-600 font-medium">💡 Правильный перевод:</span>{' '}
                      <span className="text-gray-800">{currentResult.correct_translation}</span>
                    </div>
                  )}
                </div>

                {/* Word results */}
                <div className="space-y-2">
                  {currentResult?.word_results.map(wr => {
                    const word = targetWords.find(w => w.id === wr.word_id);
                    const translations = word?.translations[user?.nativeLang || 'ru'] || [];
                    const correctTranslation = wr.translation || translations[0] || '';
                    return (
                      <motion.div
                        key={wr.word_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                          wr.has_typo 
                            ? 'bg-yellow-100 border border-yellow-300'
                            : wr.is_correct 
                              ? 'bg-green-100 border border-green-300'
                              : 'bg-red-100 border border-red-300'
                        }`}
                      >
                        <span className="text-xl">
                          {wr.has_typo ? '🟡' : wr.is_correct ? '🟢' : '🔴'}
                        </span>
                        <div className="flex-1">
                          <span className="font-semibold text-gray-800">{wr.lemma}</span>
                          <span className="text-gray-500 text-sm ml-2">
                            → {correctTranslation}
                          </span>
                        </div>
                        {wr.has_typo && (
                          <span className="text-xs text-yellow-700 bg-yellow-200 px-2 py-0.5 rounded-full">
                            опечатка
                          </span>
                        )}
                        {!wr.is_correct && !wr.has_typo && (
                          <span className="text-xs text-red-700 bg-red-200 px-2 py-0.5 rounded-full">
                            ошибка
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Suggested new words */}
                {currentResult?.suggested_new_words && currentResult.suggested_new_words.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl"
                  >
                    <div className="text-sm font-semibold text-purple-800 mb-3">
                      💡 Хотите добавить эти слова в словарь?
                    </div>
                    <div className="space-y-2">
                      {currentResult.suggested_new_words.map((word, index) => {
                        const isAdded = addedWords.has(word.dictionary_id);
                        return (
                          <motion.div
                            key={word.dictionary_id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-100"
                          >
                            <div className="flex-1">
                              <span className="font-medium text-gray-800">{word.lemma}</span>
                              <span className="text-gray-500 text-sm ml-2">→ {word.translation}</span>
                            </div>
                            <button
                              onClick={() => handleAddWord(word.dictionary_id)}
                              disabled={isAdded}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                                isAdded
                                  ? 'bg-green-100 text-green-700 cursor-default'
                                  : 'bg-purple-500 text-white hover:bg-purple-600'
                              }`}
                            >
                              {isAdded ? (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  Добавлено
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4" />
                                  Добавить
                                </>
                              )}
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>

              <button
                onClick={handleNext}
                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
              >
                {exerciseIndex + 1 >= exercises.length ? '🎉 Завершить урок' : 'Далее →'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
