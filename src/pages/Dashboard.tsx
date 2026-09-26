import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, BookOpen, Target, TrendingUp, LogOut, RotateCcw } from 'lucide-react';
import { getUser, getProfile, getStats, getUserWords, getLessons, getLessonsToday, resetAll } from '../store';
import { startLesson } from '../services/lessonService';
import { getDictionary } from '../data/dictionaries';

const langNames: Record<string, string> = {
  en: 'English', de: 'Deutsch', es: 'Español', fr: 'Français', ru: 'Русский'
};

const langFlags: Record<string, string> = {
  en: '🇬🇧', de: '🇩🇪', es: '🇪🇸', fr: '🇫🇷', ru: '🇷🇺'
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(getStats());
  const [profile, setProfile] = useState(getProfile());
  const user = getUser();
  const userWords = getUserWords();
  const lessons = getLessons();
  const todayData = getLessonsToday();
  const today = new Date().toISOString().split('T')[0];
  const todayCount = todayData.date === today ? todayData.count : 0;
  const [error, setError] = useState('');

  const handleStartLesson = () => {
    setError('');
    const session = startLesson();
    if (!session) {
      if (todayCount >= (profile?.dailyLessonLimit || 3)) {
        setError('Дневной лимит уроков достигнут! Отдохни и приходи завтра 🌙');
      } else {
        setError('Нет доступных слов для изучения. Попробуй позже.');
      }
      return;
    }
    navigate('/lesson');
  };

  const handleReset = () => {
    if (confirm('Сбросить все данные? Это действие необратимо.')) {
      resetAll();
      navigate('/onboarding');
    }
  };

  const completedLessons = lessons.filter(l => l.status === 'completed').length;
  const activeWords = userWords.filter(w => w.status === 'active').length;

  return (
    <div className="min-h-screen p-4 pb-20">
      {/* Header */}
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8 pt-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Привет, {user?.name} 👋
            </h1>
            <p className="text-gray-500 flex items-center gap-1">
              {langFlags[profile?.targetLang || 'en']} {langNames[profile?.targetLang || 'en']} • {profile?.cefrLevel}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Сбросить данные"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="text-sm text-gray-500">Стрик</span>
            </div>
            <div className="text-3xl font-bold text-gray-800">{stats?.currentStreak || 0}</div>
            <div className="text-xs text-gray-400">дней подряд</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-500">Уроки</span>
            </div>
            <div className="text-3xl font-bold text-gray-800">{completedLessons}</div>
            <div className="text-xs text-gray-400">всего пройдено</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-500">Слова</span>
            </div>
            <div className="text-3xl font-bold text-gray-800">{activeWords}</div>
            <div className="text-xs text-gray-400">в изучении</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-gray-500">Сегодня</span>
            </div>
            <div className="text-3xl font-bold text-gray-800">{todayCount}/{profile?.dailyLessonLimit || 3}</div>
            <div className="text-xs text-gray-400">уроков</div>
          </motion.div>
        </div>

        {/* Start Lesson Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <button
            onClick={handleStartLesson}
            className="w-full py-5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-bold text-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            🎯 Начать урок
          </button>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-center"
          >
            {error}
          </motion.div>
        )}

        {/* Vocabulary link */}
        {userWords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mt-6"
          >
            <button
              onClick={() => navigate('/vocabulary')}
              className="w-full py-3 bg-white border-2 border-indigo-200 text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
            >
              📖 Мой словарь ({userWords.length} слов)
            </button>
          </motion.div>
        )}

        {/* Recent Words */}
        {userWords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Последние слова</h3>
            <div className="flex flex-wrap gap-2">
              {userWords.slice(-10).reverse().map(uw => {
                const dict = getDictionary(profile?.targetLang || 'en').find(d => d.id === uw.dictionaryId);
                return dict ? (
                  <div
                    key={uw.id}
                    className="px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-sm"
                  >
                    <span className="font-medium text-gray-800">{dict.lemma}</span>
                    <span className="text-gray-400 ml-1">• ст.{uw.stage}</span>
                  </div>
                ) : null;
              })}
            </div>
          </motion.div>
        )}

        {/* Lesson History */}
        {completedLessons > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-8"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-3">История уроков</h3>
            <div className="space-y-2">
              {lessons.filter(l => l.status === 'completed').slice(-5).reverse().map(lesson => (
                <div key={lesson.id} className="bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-800">Урок #{lesson.lessonNumber}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(lesson.startedAt).toLocaleDateString('ru')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-green-600">
                      {lesson.correctWords}/{lesson.totalWords} ✓
                    </div>
                    <div className="text-xs text-gray-400">+{lesson.newWordsAdded} слов</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
