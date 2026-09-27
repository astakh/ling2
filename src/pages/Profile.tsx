import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Target, BookOpen, Calendar, Award } from 'lucide-react';
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
  
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>('A1');
  const [wordsPerLesson, setWordsPerLesson] = useState(5);
  const [dailyLessons, setDailyLessons] = useState(3);
  const [systemMaxLessons, setSystemMaxLessons] = useState(100);
  const [targetLang, setTargetLang] = useState('en');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const profile = getProfile();
    
    if (profile) {
      try {
        const freshProfile = await getProfileFromAPI(profile.id);
        setCefrLevel(freshProfile.cefr_level as CEFRLevel);
        setWordsPerLesson(freshProfile.words_per_lesson_limit);
        setDailyLessons(freshProfile.daily_lesson_limit);
        setTargetLang(freshProfile.target_lang);
      } catch (err) {
        console.error('Failed to load profile:', err);
        setCefrLevel(profile.cefrLevel);
        setWordsPerLesson(profile.wordsPerLessonLimit);
        setDailyLessons(profile.dailyLessonLimit);
        setTargetLang(profile.targetLang);
      }
    }
    
    try {
      const config = await getMaxLessons();
      setSystemMaxLessons(config.max_lessons);
    } catch (err) {
      console.error('Failed to load max lessons config:', err);
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
      });

      saveProfile({
        ...profile,
        cefrLevel: updatedProfile.cefr_level as CEFRLevel,
        wordsPerLessonLimit: updatedProfile.words_per_lesson_limit,
        dailyLessonLimit: updatedProfile.daily_lesson_limit,
      });

      setMessage({ type: 'success', text: 'Настройки сохранены' });
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
        <div className="text-gray-400">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Профиль</h1>
        </motion.div>

        {/* User Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-6 mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user?.name || 'Пользователь'}</h2>
              <p className="text-gray-500">{targetLang.toUpperCase()}</p>
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">Уровень языка</h3>
          </div>
          <div className="space-y-2">
            {levels.map(level => (
              <button
                key={level.code}
                onClick={() => setCefrLevel(level.code)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  cefrLevel === level.code
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-gray-900">{level.name}</div>
                <div className="text-sm text-gray-500">{level.desc}</div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Words per Lesson */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">Слов в уроке</h3>
          </div>
          <div className="space-y-4">
            <input
              type="range"
              min="1"
              max="20"
              value={wordsPerLesson}
              onChange={(e) => setWordsPerLesson(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">1</span>
              <span className="text-2xl font-bold text-gray-900">{wordsPerLesson}</span>
              <span className="text-sm text-gray-500">20</span>
            </div>
          </div>
        </motion.div>

        {/* Daily Lessons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">Уроков в день</h3>
          </div>
          <div className="space-y-4">
            <input
              type="range"
              min="1"
              max={systemMaxLessons}
              value={dailyLessons}
              onChange={(e) => setDailyLessons(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">1</span>
              <span className="text-2xl font-bold text-gray-900">{dailyLessons}</span>
              <span className="text-sm text-gray-500">{systemMaxLessons}</span>
            </div>
          </div>
        </motion.div>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
