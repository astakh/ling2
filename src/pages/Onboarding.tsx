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
  { value: 3, name: 'Лёгкая', desc: '3 слова за урок' },
  { value: 5, name: 'Средняя', desc: '5 слов за урок' },
  { value: 7, name: 'Интенсивная', desc: '7 слов за урок' },
  { value: 10, name: 'Максимальная', desc: '10 слов за урок' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  
  const [nativeLang, setNativeLang] = useState<Language>('ru');
  const [targetLang, setTargetLang] = useState<Language>('en');
  const [level, setLevel] = useState<CEFRLevel>('A1');
  const [intensity, setIntensity] = useState(5);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim()) {
      setError('Заполните все поля');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const user = await registerUser(name, email);
      setUserId(user.id);
      saveUser({
        id: user.id,
        email: user.email,
        name: user.name,
        nativeLang: 'ru',
        timezone: 'UTC',
        createdAt: new Date().toISOString(),
      });
      setStep(1);
    } catch (err) {
      setError('Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');
    
    try {
      const profile = await setupProfile(
        userId,
        nativeLang,
        targetLang,
        level,
        intensity
      );
      
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
      
      navigate('/dashboard');
    } catch (err) {
      setError('Ошибка сохранения профиля');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    // Step 0: Welcome + Name & Email
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 max-w-md mx-auto"
    >
      <div className="text-center space-y-3 mb-8">
        <h1 className="text-4xl font-bold text-gray-900">LingoFlow</h1>
        <p className="text-lg text-gray-500">
          Учи слова в контексте живых предложений
        </p>
      </div>
      
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Ваше имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
        
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}
        
        <button
          onClick={handleRegister}
          disabled={!name.trim() || !email.trim() || loading}
          className="btn-primary w-full"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Регистрация...
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              Начать <ChevronRight className="w-5 h-5" />
            </div>
          )}
        </button>
      </div>
    </motion.div>,

    // Step 1: Native Language
    <motion.div
      key="native"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 max-w-md mx-auto"
    >
      <h2 className="text-2xl font-bold text-center text-gray-900">Ваш родной язык?</h2>
      <div className="space-y-2">
        {nativeLanguages.map(lang => (
          <button
            key={lang.code}
            onClick={() => setNativeLang(lang.code as Language)}
            className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
              nativeLang === lang.code
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="text-2xl">{lang.flag}</span>
            <span className="font-semibold text-gray-900">{lang.name}</span>
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

    // Step 2: Target Language
    <motion.div
      key="target"
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
            className={`p-4 rounded-xl border-2 transition-all ${
              targetLang === lang.code
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-3xl mb-1">{lang.flag}</div>
            <div className="font-semibold text-gray-900">{lang.name}</div>
          </button>
        ))}
      </div>
      <button
        onClick={() => setStep(3)}
        className="btn-primary w-full"
      >
        Далее
      </button>
    </motion.div>,

    // Step 3: Level
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
        onClick={() => setStep(4)}
        className="btn-primary w-full"
      >
        Далее
      </button>
    </motion.div>,

    // Step 4: Intensity
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
        {loading ? 'Сохранение...' : 'Начать обучение'}
      </button>
    </motion.div>,
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {steps[step]}
        </AnimatePresence>
        
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
