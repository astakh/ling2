import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Globe, Clock, ChevronRight } from 'lucide-react';
import { createUser, createProfile, createStats, saveUser, saveProfile, saveStats } from '../store';
import { Language, CEFRLevel } from '../types';

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧', native: 'English' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', native: 'German' },
  { code: 'es', name: 'Español', flag: '🇪🇸', native: 'Spanish' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', native: 'French' },
];

const levels: { code: CEFRLevel; name: string; desc: string }[] = [
  { code: 'A1', name: 'A1 — Beginner', desc: 'Базовые фразы и слова' },
  { code: 'A2', name: 'A2 — Elementary', desc: 'Простые диалоги' },
  { code: 'B1', name: 'B1 — Intermediate', desc: 'Свободное общение на простые темы' },
  { code: 'B2', name: 'B2 — Upper-Int', desc: 'Сложные тексты и дискуссии' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nativeLang, setNativeLang] = useState<Language>('ru');
  const [targetLang, setTargetLang] = useState<Language>('en');
  const [level, setLevel] = useState<CEFRLevel>('A1');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  const handleComplete = () => {
    const user = createUser(name || 'User', email || 'user@example.com', nativeLang, timezone);
    const profile = createProfile(user.id, targetLang, level);
    const stats = createStats(user.id);
    
    saveUser(user);
    saveProfile(profile);
    saveStats(stats);
    
    navigate('/dashboard');
  };

  const steps = [
    // Step 0: Welcome
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center space-y-8"
    >
      <div className="text-7xl mb-4">📚</div>
      <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
        LingoFlow
      </h1>
      <p className="text-xl text-gray-600 max-w-md mx-auto">
        Учи слова в контексте живых предложений. Умные интервалы повторения.
      </p>
      <button
        onClick={() => setStep(1)}
        className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
      >
        Начать <ChevronRight className="inline w-5 h-5" />
      </button>
    </motion.div>,

    // Step 1: Name & Email
    <motion.div
      key="info"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 max-w-sm mx-auto"
    >
      <h2 className="text-2xl font-bold text-center text-gray-800">Как тебя зовут?</h2>
      <input
        type="text"
        placeholder="Имя"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none transition-colors text-lg"
      />
      <input
        type="email"
        placeholder="Email (необязательно)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none transition-colors text-lg"
      />
      <button
        onClick={() => setStep(2)}
        disabled={!name.trim()}
        className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="text-sm text-gray-500">{lang.native}</div>
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
      <h2 className="text-2xl font-bold text-center text-gray-800">Твой уровень?</h2>
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
        onClick={handleComplete}
        className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
      >
        🚀 Начать обучение!
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
