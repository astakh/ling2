import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getUser, saveProfile } from '../store';
import { setupProfile, getDictionaryCategories } from '../services/api';
import { Language, CEFRLevel } from '../types';

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

const levels: { code: CEFRLevel; name: string; desc: string }[] = [
  { code: 'A1', name: 'A1 — Beginner', desc: 'Базовые фразы и слова' },
  { code: 'A2', name: 'A2 — Elementary', desc: 'Простые диалоги' },
  { code: 'B1', name: 'B1 — Intermediate', desc: 'Свободное общение' },
  { code: 'B2', name: 'B2 — Upper-Int', desc: 'Сложные тексты' },
];

const intensities = [
  { value: 3, name: 'Лёгкая', desc: '3 слова за урок' },
  { value: 5, name: 'Средняя', desc: '5 слов за урок' },
  { value: 7, name: 'Интенсивная', desc: '7 слов за урок' },
  { value: 10, name: 'Максимальная', desc: '10 слов за урок' },
];

interface DictionaryCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  word_count: number;
}

export default function AddLanguage() {
  const navigate = useNavigate();
  const user = getUser();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [targetLang, setTargetLang] = useState<Language>('en');
  const [level, setLevel] = useState<CEFRLevel>('A1');
  const [intensity, setIntensity] = useState(5);
  const [dictionaryCategory, setDictionaryCategory] = useState('general');
  const [categories, setCategories] = useState<DictionaryCategory[]>([]);

  useEffect(() => {
    loadCategories();
  }, [targetLang]);

  const loadCategories = async () => {
    try {
      const response = await getDictionaryCategories(targetLang);
      setCategories(response.categories || []);
      if (response.categories && response.categories.length > 0) {
        setDictionaryCategory(response.categories[0].id);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const handleComplete = async () => {
    if (!user) {
      setError('Пользователь не найден');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const profile = await setupProfile(
        user.id,
        'ru', // native lang
        targetLang,
        level,
        intensity,
        dictionaryCategory
      );
      
      saveProfile({
        id: profile.id,
        userId: profile.user_id,
        targetLang: profile.target_lang as Language,
        cefrLevel: profile.cefr_level as CEFRLevel,
        currentLessonNumber: profile.current_lesson_number,
        wordsPerLessonLimit: profile.words_per_lesson_limit,
        dailyLessonLimit: profile.daily_lesson_limit,
        dictionaryCategory: profile.dictionary_category,
        createdAt: new Date().toISOString(),
      });
      
      navigate('/dashboard');
    } catch (err) {
      setError('Ошибка сохранения профиля');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    // Step 0: Choose Language
    <motion.div
      key="lang"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 max-w-md mx-auto"
    >
      <h2 className="text-2xl font-bold text-center text-gray-900">Какой язык учим?</h2>
      <div className="grid grid-cols-2 gap-3">
        {languages.map(lang => (
          <button
            key={lang.code}
            onClick={() => setTargetLang(lang.code as Language)}
            className={`p-6 rounded-xl border-2 transition-all ${
              targetLang === lang.code
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-4xl mb-2">{lang.flag}</div>
            <div className="font-semibold text-gray-900">{lang.name}</div>
          </button>
        ))}
      </div>
      <button
        onClick={() => setStep(1)}
        className="btn-primary w-full"
      >
        Далее
      </button>
    </motion.div>,

    // Step 1: Choose Level
    <motion.div
      key="level"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 max-w-md mx-auto"
    >
      <h2 className="text-2xl font-bold text-center text-gray-900">Ваш уровень?</h2>
      <div className="space-y-2">
        {levels.map(l => (
          <button
            key={l.code}
            onClick={() => setLevel(l.code)}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
              level === l.code
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-gray-900">{l.name}</div>
            <div className="text-sm text-gray-500">{l.desc}</div>
          </button>
        ))}
      </div>
      <button
        onClick={() => setStep(2)}
        className="btn-primary w-full"
      >
        Далее
      </button>
    </motion.div>,

    // Step 2: Choose Dictionary
    <motion.div
      key="dict"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 max-w-md mx-auto"
    >
      <h2 className="text-2xl font-bold text-center text-gray-900">Выберите словарь</h2>
      <p className="text-center text-gray-500">Какой тип слов вы хотите изучать?</p>
      
      {categories.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          Загрузка словарей...
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setDictionaryCategory(cat.id)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                dictionaryCategory === cat.id
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">{cat.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{cat.name}</div>
                  <div className="text-sm text-gray-500 mb-1">{cat.description}</div>
                  <div className="text-xs text-gray-400">{cat.word_count} слов</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      <button
        onClick={() => setStep(3)}
        disabled={categories.length === 0}
        className="btn-primary w-full disabled:opacity-50"
      >
        Далее
      </button>
    </motion.div>,

    // Step 3: Intensity
    <motion.div
      key="intensity"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 max-w-md mx-auto"
    >
      <h2 className="text-2xl font-bold text-center text-gray-900">Интенсивность обучения</h2>
      <p className="text-center text-gray-500">Сколько слов учить за один урок?</p>
      <div className="space-y-2">
        {intensities.map(i => (
          <button
            key={i.value}
            onClick={() => setIntensity(i.value)}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
              intensity === i.value
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-gray-900">{i.name}</div>
            <div className="text-sm text-gray-500">{i.desc}</div>
          </button>
        ))}
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}
      
      <button
        onClick={handleComplete}
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Создание...
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            Создать профиль <ChevronRight className="w-5 h-5" />
          </div>
        )}
      </button>
    </motion.div>,
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-lg mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : navigate('/dashboard')}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Добавить язык</h1>
        </div>

        <AnimatePresence mode="wait">
          {steps[step]}
        </AnimatePresence>
        
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step ? 'bg-gray-900 w-6' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
