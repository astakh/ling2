import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, User, BookOpen, Target, Calendar, Award } from 'lucide-react';
import { getProfile, saveProfile, getUser } from '../store';
import { getProfile as getProfileFromAPI, updateProfile, getMaxLessons } from '../services/api';
import { CEFRLevel } from '../types';

const levels: { code: CEFRLevel; name: string; desc: string }[] = [
  { code: 'A1', name: 'A1 — Beginner', desc: 'Базовые фразы и слова' },
  { code: 'A2', name: 'A2 — Elementary', desc: 'Простые диалоги' },
  { code: 'B1', name: 'B1 — Intermediate', desc: 'Свободное общение' },
  { code: 'B2', name: 'B2 — Upper-Int', desc: 'Сложные тексты' },
];

export default function Profile() {
  const navigate = useNavigate();
  const user = getUser();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Form state
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>('A1');
  const [wordsPerLesson, setWordsPerLesson] = useState(5);
  const [dailyLessons, setDailyLessons] = useState(3);
  const [maxLessons, setMaxLessons] = useState(100);
  const [systemMaxLessons, setSystemMaxLessons] = useState(100);
  const [targetLang, setTargetLang] = useState('en');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const profile = getProfile();
    
    // Load system max lessons from config
    try {
      const config = await getMaxLessons();
      setSystemMaxLessons(config.max_lessons);
    } catch (err) {
      console.error('Failed to load max lessons config:', err);
    }
    
    if (profile) {
      // Load fresh data from API
      try {
        const freshProfile = await getProfileFromAPI(profile.id);
        setCefrLevel(freshProfile.cefr_level as CEFRLevel);
        setWordsPerLesson(freshProfile.words_per_lesson_limit);
        setDailyLessons(freshProfile.daily_lesson_limit);
        setMaxLessons(freshProfile.max_lessons || 100);
        setTargetLang(freshProfile.target_lang);
      } catch (err) {
        console.error('Failed to load profile:', err);
        // Use cached data as fallback
        setCefrLevel(profile.cefrLevel);
        setWordsPerLesson(profile.wordsPerLessonLimit);
        setDailyLessons(profile.dailyLessonLimit);
        setMaxLessons(100);
        setTargetLang(profile.targetLang);
      }
    }
    
    setLoading(false);
  };

  const handleSave = async () => {
    const profile = getProfile();
    if (!profile) {
      setMessage({ type: 'error', text: 'Профиль не найден' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const updatedProfile = await updateProfile(profile.id, {
        cefr_level: cefrLevel,
        words_per_lesson_limit: wordsPerLesson,
        daily_lesson_limit: dailyLessons,
        max_lessons: maxLessons,
      });

      // Update local storage
      saveProfile({
        ...profile,
        cefrLevel: updatedProfile.cefr_level as CEFRLevel,
        wordsPerLessonLimit: updatedProfile.words_per_lesson_limit,
        dailyLessonLimit: updatedProfile.daily_lesson_limit,
        maxLessons: updatedProfile.max_lessons,
      });

      setMessage({ type: 'success', text: 'Настройки сохранены!' });
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
      setMessage({ type: 'error', text: 'Ошибка сохранения' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  const langNames: Record<string, string> = {
    en: 'English',
    de: 'Deutsch',
    es: 'Español',
    fr: 'Français',
  };

  const langFlags: Record<string, string> = {
    en: '🇬🇧',
    de: '🇩🇪',
    es: '🇪🇸',
    fr: '🇫🇷',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8 pt-4"
        >
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Профиль</h1>
        </motion.div>

        {/* User Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{user?.name || 'Пользователь'}</h2>
              <p className="text-gray-500 flex items-center gap-2">
                <span>{langFlags[targetLang]}</span>
                <span>{langNames[targetLang]}</span>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Message */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-xl ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {message.text}
          </motion.div>
        )}

        {/* CEFR Level */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-semibold text-gray-800">Уровень языка</h3>
          </div>
          <div className="space-y-3">
            {levels.map(level => (
              <button
                key={level.code}
                onClick={() => setCefrLevel(level.code)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  cefrLevel === level.code
                    ? 'border-indigo-500 bg-indigo-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-gray-800">{level.name}</div>
                <div className="text-sm text-gray-500">{level.desc}</div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Words per Lesson */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-semibold text-gray-800">Слов в уроке</h3>
          </div>
          <div className="space-y-4">
            <input
              type="range"
              min="1"
              max="20"
              value={wordsPerLesson}
              onChange={(e) => setWordsPerLesson(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">1 слово</span>
              <span className="text-2xl font-bold text-indigo-600">{wordsPerLesson}</span>
              <span className="text-sm text-gray-500">20 слов</span>
            </div>
            <p className="text-sm text-gray-500 text-center">
              Рекомендуется: 5-7 слов для оптимального запоминания
            </p>
          </div>
        </motion.div>

        {/* Daily Lessons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-semibold text-gray-800">Уроков в день</h3>
          </div>
          <div className="space-y-4">
            <input
              type="range"
              min="1"
              max="10"
              value={dailyLessons}
              onChange={(e) => setDailyLessons(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">1 урок</span>
              <span className="text-2xl font-bold text-indigo-600">{dailyLessons}</span>
              <span className="text-sm text-gray-500">10 уроков</span>
            </div>
            <p className="text-sm text-gray-500 text-center">
              Рекомендуется: 2-3 урока в день для устойчивого прогресса
            </p>
          </div>
        </motion.div>

        {/* Max Lessons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-semibold text-gray-800">Максимум уроков</h3>
          </div>
          <div className="space-y-4">
            <input
              type="range"
              min="10"
              max={systemMaxLessons}
              step="10"
              value={maxLessons}
              onChange={(e) => setMaxLessons(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">10 уроков</span>
              <span className="text-2xl font-bold text-indigo-600">{maxLessons}</span>
              <span className="text-sm text-gray-500">{systemMaxLessons} уроков</span>
            </div>
            <p className="text-sm text-gray-500 text-center">
              Максимальное количество уроков для достижения полного mastery
            </p>
          </div>
        </motion.div>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Сохранение...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Сохранить настройки
              </>
            )}
          </button>
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700"
        >
          <p className="font-semibold mb-1">💡 Подсказка</p>
          <p>
            Изменения вступят в силу со следующего урока. Текущий урок будет завершён с текущими настройками.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
