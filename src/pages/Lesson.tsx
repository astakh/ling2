import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { getProfile, getUser } from '../store';
import { getDictionary } from '../data/dictionaries';
import { startLesson, submitExerciseTranslation } from '../services/lessonService';
import { DictionaryWord, LessonExercise } from '../types';
import { EvaluationResult } from '../services/api';

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
  const [initialized, setInitialized] = useState(false);

  // Initialize lesson
  useEffect(() => {
    loadLesson();
  }, []);

  const loadLesson = async () => {
    const session = await startLesson();
    if (!session) {
      navigate('/dashboard');
      return;
    }
    
    setLesson(session.lesson);
    setExercises(session.exercises);
    setExerciseIndex(session.currentExerciseIndex);
    setInitialized(true);
  };

  // Update target words when exercise changes
  useEffect(() => {
    if (exercises.length > 0 && exerciseIndex >= 0 && exerciseIndex < exercises.length && profile) {
      const exercise = exercises[exerciseIndex];
      if (exercise) {
        const dictionary = getDictionary(profile.targetLang);
        const words = exercise.targetWordIds
          .map((id: string) => dictionary.find(d => d.id === id))
          .filter((w: DictionaryWord | undefined): w is DictionaryWord => w !== undefined);
        setTargetWords(words);
      }
    }
  }, [exercises, exerciseIndex, profile]);

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

  const handleNext = () => {
    setShowResult(false);
    setTranslation('');
    setCurrentResult(null);
    
    const nextIndex = exerciseIndex + 1;
    if (nextIndex >= exercises.length) {
      // All exercises done
      navigate('/complete');
    } else {
      setExerciseIndex(nextIndex);
    }
  };

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
              const translations = word.translations[user?.nativeLang || 'ru'] || [];
              return (
                <div
                  key={word.id}
                  className="px-3 py-2 bg-white border border-indigo-200 rounded-xl shadow-sm"
                >
                  <div className="font-semibold text-indigo-800">{word.lemma}</div>
                  <div className="text-xs text-indigo-500">{translations.join(', ')}</div>
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
                
                <div className="text-sm text-gray-600 mb-4 bg-white/60 rounded-lg p-3">
                  <span className="text-gray-400">Твой перевод:</span>{' '}
                  <span className="font-medium text-gray-800">{translation}</span>
                </div>

                {/* Word results */}
                <div className="space-y-2">
                  {currentResult?.word_results.map(wr => {
                    const word = targetWords.find(w => w.id === wr.word_id);
                    const translations = word?.translations[user?.nativeLang || 'ru'] || [];
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
                            → {translations.join(', ')}
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
