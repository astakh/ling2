import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Loader2, X, Plus, CheckCircle, Trash2 } from 'lucide-react';
import { getProfile, getUser } from '../store';
import { startLesson, submitExerciseTranslation, completeLesson } from '../services/lessonService';
import { DictionaryWord, LessonExercise } from '../types';
import { EvaluationResult, markWordLearned, addWord, replaceWord } from '../services/api';
import Toast, { ToastType } from '../components/Toast';

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
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    const lessonData = sessionStorage.getItem('currentLesson');
    if (lessonData) {
      const session = JSON.parse(lessonData);
      setupLesson(session);
    } else {
      navigate('/dashboard');
    }
  }, []);

  const [todayWords, setTodayWords] = useState<DictionaryWord[]>([]);

  const setupLesson = (session: any) => {
    setLesson(session.lesson);
    setExercises(session.exercises);
    setExerciseIndex(session.currentExerciseIndex);
    setTodayWords(session.todayWords);
    
    // Проверяем, исчерпан ли словарь
    if (session.dictionary_exhausted) {
      console.warn('[Lesson] Dictionary exhausted - no new words available');
      // Показываем toast уведомление
      setToast({ 
        message: 'Все слова для вашего уровня уже добавлены в изучение. Урок будет состоять только из повторения.', 
        type: 'info' 
      });
    }
    
    // Show new words if this is a new lesson (not resumed) AND there are new words
    if (session.newWords && session.newWords.length > 0 && !session.resumed) {
      setNewWords(session.newWords);
      setShowNewWords(true);
    } else {
      setInitialized(true);
    }
  };

  useEffect(() => {
    if (exercises.length > 0 && exerciseIndex >= 0 && exerciseIndex < exercises.length) {
      const exercise = exercises[exerciseIndex];
      if (exercise && todayWords.length > 0) {
        const words = exercise.targetWordIds
          .map((id: string) => todayWords.find(d => d.id === id))
          .filter((w: DictionaryWord | undefined): w is DictionaryWord => w !== undefined);
        setTargetWords(words);
      }
    }
  }, [exercises, exerciseIndex, todayWords]);

  const currentExercise = exerciseIndex >= 0 ? exercises[exerciseIndex] : null;

  const handleCheck = async () => {
    if (!translation.trim() || !currentExercise || !profile || !user || !lesson) return;
    
    setLoading(true);
    const result = await submitExerciseTranslation(currentExercise.id, translation);
    
    if (result) {
      setCurrentResult(result);
      setShowResult(true);
      
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
    setIgnoredWords(new Set());
    setAddedWords(new Set());
    
    const nextIndex = exerciseIndex + 1;
    if (nextIndex >= exercises.length) {
      if (lesson) {
        await completeLesson(lesson.id);
      }
      sessionStorage.removeItem('currentLesson');
      navigate('/complete');
    } else {
      setExerciseIndex(nextIndex);
    }
  };

  const handleMarkAsLearned = async (dictionaryId: string) => {
    if (!profile) return;
    
    try {
      await markWordLearned(profile.id, dictionaryId);
      setIgnoredWords(prev => new Set([...prev, dictionaryId]));
    } catch (error) {
      console.error('Failed to mark word as learned:', error);
    }
  };

  const handleAddWord = async (dictionaryId: string) => {
    if (!profile) return;
    
    try {
      await addWord(profile.id, dictionaryId, 'active');
      setAddedWords(prev => new Set([...prev, dictionaryId]));
    } catch (error) {
      console.error('Failed to add word:', error);
    }
  };

  const handleRemoveNewWord = async (dictionaryId: string) => {
    if (!profile) return;
    
    try {
      // Пометить слово как выученное
      await markWordLearned(profile.id, dictionaryId);
      setRemovedNewWords(prev => new Set([...prev, dictionaryId]));
      
      // Запросить замену слова
      const replaceResult = await replaceWord(profile.id, dictionaryId);
      
      if (replaceResult.status === 'success' && replaceResult.new_word) {
        // Добавить новое слово в список
        setNewWords(prev => [...prev, replaceResult.new_word!]);
        console.log('[Lesson] Word replaced successfully:', replaceResult.new_word.lemma);
      } else if (replaceResult.status === 'no_words_available') {
        console.log('[Lesson] No more words available for replacement');
        // Можно показать уведомление пользователю
      }
    } catch (error) {
      console.error('Failed to remove word:', error);
    }
  };

  if (showNewWords) {
    return (
      <div className="min-h-screen">
        <AnimatePresence>
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
        </AnimatePresence>
        <div className="max-w-2xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-gray-900">Новые слова</h1>
              <p className="text-gray-500">Запомни эти слова перед началом урока</p>
              <p className="text-sm text-gray-400">Можешь пометить слово как выученное, если уже знаешь его</p>
            </div>

            <div className="space-y-3">
              {newWords.map((word, index) => {
                const isRemoved = removedNewWords.has(word.id);
                return (
                  <motion.div
                    key={word.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: isRemoved ? 0.5 : 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`card p-5 ${isRemoved ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className={`text-2xl font-bold mb-1 ${isRemoved ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {word.lemma}
                        </div>
                        <div className="text-sm text-gray-500 mb-2">
                          {word.pos}
                        </div>
                        <div className={`text-base ${isRemoved ? 'text-gray-400' : 'text-gray-700'}`}>
                          {word.translations.join(', ')}
                        </div>
                        {isRemoved && (
                          <div className="text-sm text-green-600 mt-2 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Помечено как выученное
                          </div>
                        )}
                      </div>
                      {!isRemoved && (
                        <button
                          onClick={() => handleRemoveNewWord(word.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
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
              className="btn-primary w-full text-lg"
            >
              {removedNewWords.size > 0 
                ? `Начать урок (${newWords.length - removedNewWords.size} слов)`
                : 'Начать урок'
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
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const progress = ((exerciseIndex) / exercises.length) * 100;

  return (
    <div className="min-h-screen">
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => {
              if (confirm('Выйти из урока?')) {
                navigate('/dashboard');
              }
            }}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-sm text-gray-500">
            {exerciseIndex + 1} / {exercises.length}
          </div>
          <div className="w-9" />
        </div>

        {/* Progress */}
        <div className="h-1.5 bg-gray-200 rounded-full mb-12 overflow-hidden">
          <motion.div
            className="h-full bg-gray-900 rounded-full"
            initial={{ width: `${progress}%` }}
            animate={{ width: showResult ? `${((exerciseIndex + 1) / exercises.length) * 100}%` : `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Target Words */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <div className="text-xs text-gray-400 mb-3 uppercase tracking-wider font-medium">
            Слова в упражнении
          </div>
          <div className="flex flex-wrap gap-2">
            {targetWords.map(word => {
              const isIgnored = ignoredWords.has(word.id);
              return (
                <div
                  key={word.id}
                  className={`relative px-4 py-2 rounded-lg border ${
                    isIgnored 
                      ? 'bg-gray-100 border-gray-200 opacity-50' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className={`font-medium ${isIgnored ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {word.lemma}
                  </div>
                  {!isIgnored && (
                    <button
                      onClick={() => handleMarkAsLearned(word.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          {!showResult ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="card p-8">
                <div className="text-xs text-gray-400 mb-4 uppercase tracking-wider font-medium">
                  Предложение
                </div>
                <p className="text-xl text-gray-900 leading-relaxed">
                  {currentExercise.targetSentence}
                </p>
              </div>

              <textarea
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                placeholder="Введи перевод..."
                className="input h-32 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCheck();
                  }
                }}
                autoFocus
              />

              <button
                onClick={handleCheck}
                disabled={!translation.trim() || loading}
                className="btn-primary w-full"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Проверяю...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Check className="w-5 h-5" />
                    Проверить
                  </div>
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className={`card p-6 border-2 ${
                currentResult?.overall_correct 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-orange-50 border-orange-200'
              }`}>
                <div className="text-xl font-bold mb-4">
                  {currentResult?.overall_correct ? 'Отлично!' : 'Есть ошибки'}
                </div>
                
                <div className="space-y-3">
                  <div className="text-sm bg-white/60 rounded-lg p-3">
                    <span className="text-gray-400">Твой перевод:</span>{' '}
                    <span className="font-medium text-gray-900">{translation}</span>
                  </div>
                  
                  {currentResult?.correct_translation && (
                    <div className="text-sm bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <span className="text-blue-600 font-medium">Правильный перевод:</span>{' '}
                      <span className="text-gray-900">{currentResult.correct_translation}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 mt-4">
                  {currentResult?.word_results.map(wr => {
                    const word = targetWords.find(w => w.id === wr.word_id);
                    const translations = word?.translations[user?.nativeLang || 'ru'] || [];
                    const correctTranslation = wr.translation || translations[0] || '';
                    return (
                      <motion.div
                        key={wr.word_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
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
                          <span className="font-semibold text-gray-900">{wr.lemma}</span>
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

                {currentResult?.suggested_new_words && currentResult.suggested_new_words.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg"
                  >
                    <div className="text-sm font-semibold text-purple-900 mb-3">
                      Добавить эти слова в словарь?
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
                              <span className="font-medium text-gray-900">{word.lemma}</span>
                              <span className="text-gray-500 text-sm ml-2">→ {word.translation}</span>
                            </div>
                            <button
                              onClick={() => handleAddWord(word.dictionary_id)}
                              disabled={isAdded}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                                isAdded
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-purple-600 text-white hover:bg-purple-700'
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
                className="btn-primary w-full"
              >
                {exerciseIndex + 1 >= exercises.length ? 'Завершить урок' : 'Далее'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
