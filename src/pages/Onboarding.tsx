import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Loader2 } from 'lucide-react';
import { registerUser, setupProfile } from '../services/api';
import { saveUser, saveProfile } from '../store';
import { Language, CEFRLevel } from '../types';

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

const nativeLanguages = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
];

const levels: { code: CEFRLevel; name: string; desc: string }[] = [
  { code: 'A1', name: 'A1 — Beginner', desc: 'Базовые фразы и слова' },
  { code: 'A2', name: 'A2 — Elementary', desc: 'Простые диалоги' },
  { code: 'B1', name: 'B1 — Intermediate', desc: 'Свободное общение' },
  { code: 'B2', name: 'B2 — Upper-Int', desc: 'Сложные тексты' },
];

const intensities = [
  { value: 3, name: 'Лёгкая', desc: '3 слова за урок', emoji: '🌱' },
  { value: 5, name: 'Средняя', desc: '5 слов за урок', emoji: '🌿' },
  { value: 7, name: 'Интенсивная', desc: '7 слов за урок', emoji: '🌳' },
  { value: 10, name: 'Максимальная', desc: '10 слов за урок', emoji: '🔥' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Step 1: Name & Email
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  
  // Step 2: Native Language
  const [nativeLang, setNativeLang] = useState<Language>('ru');
  
  // Step 3: Target Language
  const [targetLang, setTargetLang] = useState<Language>('en');
  
  // Step 4: Level
  const [level, setLevel] = useState<CEFRLevel>('A1');
  
  // Step 5: Intensity
  const [intensity, setIntensity] = useState(5);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim()) {
      setError('Заполните все поля');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      console.log('[Onboarding] Registering user:', { name, email });
      const user = await registerUser(name, email);
      console.log('[Onboarding] User registered:', user);
      setUserId(user.id);
      saveUser({
        id: user.id,
        email: user.email,
        name: user.name,
        nativeLang: 'ru',
        timezone: 'UTC',
        createdAt: new Date().toISOString(),
      });
      console.log('[Onboarding] User saved to store, moving to step 1');
      setStep(1);
    } catch (err) {
      console.error('[Onboarding] Registration error:', err);
      setError('Ошибка регистрации. Попробуйте другой email.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('[Onboarding] Setting up profile:', { userId, nativeLang, targetLang, level, intensity });
      const profile = await setupProfile(
        userId,
        nativeLang,
        targetLang,
        level,
        intensity
      );
      console.log('[Onboarding] Profile created:', profile);
      
      saveProfile({
        id: profile.id,
        userId: profile.user_id,
        targetLang: profile.target_lang as Language,
        cefrLevel: profile.cefr_level as CEFRLevel,
        currentLessonNumber: profile.current_lesson_number,
        wordsPerLessonLimit: profile.words_per_lesson_limit,
        dailyLessonLimit: profile.daily_lesson_limit,
        createdAt: new Date().toISOString(),
      });
      
      console.log('[Onboarding] Profile saved, navigating to dashboard');
      navigate('/dashboard');
    } catch (err) {
      console.error('[Onboarding] Profile setup error:', err);
      setError('Ошибка сохранения профиля. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    // Step 0: Welcome + Name & Email
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 max-w-sm mx-auto"
    >
      <div className="text-center space-y-4 mb-8">
        <div className="text-7xl">📚</div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          LingoFlow
        </h1>
        <p className="text-lg text-gray-600">
          Учи слова в контексте живых предложений
        </p>
      </div>
      
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Ваше имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none transition-colors text-lg"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none transition-colors text-lg"
        />
        
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}
        
        <button
          onClick={handleRegister}
          disabled={!name.trim() || !email.trim() || loading}
          className="w-full px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Регистрация...
            </>
          ) : (
            <>
              Начать <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </motion.div>,

    // Step 1: Native Language
    <motion.div
      key="native"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 max-w-md mx-auto"
    >
      <h2 className="text-2xl font-bold text-center text-gray-800">Ваш родной язык?</h2>
      <div className="grid grid-cols-1 gap-3">
        {nativeLanguages.map(lang => (
          <button
            key={lang.code}
            onClick={() => setNativeLang(lang.code as Language)}
            className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
              nativeLang === lang.code
                ? 'border-indigo-500 bg-indigo-50 shadow-md scale-105'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="text-3xl">{lang.flag}</span>
            <span className="font-semibold text-gray-800 text-lg">{lang.name}</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => setStep(2)}
        className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
      >
        Далее
      </button>
    </motion.div>,

    // Step 2: Target Language
    <motion.div
      key="target"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 max-w-md mx-auto"
    >
      <h2 className="text-2xl font-bold text-center text-gray-800">Какой язык учим?</h2>
      <div className="grid grid-cols-2 gap-3">
        {languages.map(lang => (
          <button
            key={lang.code}
            onClick={() => setTargetLang(lang.code as Language)}
            className={`p-4 rounded-xl border-2 transition-all ${
              targetLang === lang.code
                ? 'border-indigo-500 bg-indigo-50 shadow-md scale-105'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-3xl mb-1">{lang.flag}</div>
            <div className="font-semibold text-gray-800">{lang.name}</div>
          </button>
        ))}
      </div>
      <button
        onClick={() => setStep(3)}
        className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
      >
        Далее
      </button>
    </motion.div>,

    // Step 3: Level
    <motion.div
      key="level"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 max-w-md mx-auto"
    >
      <h2 className="text-2xl font-bold text-center text-gray-800">Ваш уровень?</h2>
      <div className="space-y-3">
        {levels.map(l => (
          <button
            key={l.code}
            onClick={() => setLevel(l.code)}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
              level === l.code
                ? 'border-indigo-500 bg-indigo-50 shadow-md'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-gray-800">{l.name}</div>
            <div className="text-sm text-gray-500">{l.desc}</div>
          </button>
        ))}
      </div>
      <button
        onClick={() => setStep(4)}
        className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
      >
        Далее
      </button>
    </motion.div>,

    // Step 4: Intensity
    <motion.div
      key="intensity"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 max-w-md mx-auto"
    >
      <h2 className="text-2xl font-bold text-center text-gray-800">Интенсивность обучения</h2>
      <p className="text-center text-gray-500">Сколько слов учить за один урок?</p>
      <div className="space-y-3">
        {intensities.map(i => (
          <button
            key={i.value}
            onClick={() => setIntensity(i.value)}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
              intensity === i.value
                ? 'border-indigo-500 bg-indigo-50 shadow-md'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="text-2xl">{i.emoji}</span>
            <div className="flex-1">
              <div className="font-semibold text-gray-800">{i.name}</div>
              <div className="text-sm text-gray-500">{i.desc}</div>
            </div>
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
        className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Сохранение...
          </>
        ) : (
          <>🚀 Начать обучение!</>
        )}
      </button>
    </motion.div>,
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {steps[step]}
        </AnimatePresence>
        
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step ? 'bg-indigo-500 w-6' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
