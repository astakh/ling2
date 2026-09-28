import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Settings } from 'lucide-react';
import { getLanguageStats } from '../services/api';

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

export default function LanguagePage() {
  const navigate = useNavigate();
  const { profileId } = useParams<{ profileId: string }>();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profileId) {
      loadStats();
    }
  }, [profileId]);

  const loadStats = async () => {
    if (!profileId) return;
    
    setLoading(true);
    try {
      const data = await getLanguageStats(profileId);
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartLesson = () => {
    if (profileId) {
      localStorage.setItem('currentProfileId', profileId);
      navigate('/lesson');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Загрузка...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Профиль не найден</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="text-4xl">
              {langFlags[stats.target_lang] || '🌍'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {langNames[stats.target_lang] || stats.target_lang}
              </h1>
              <p className="text-sm text-gray-500">
                {stats.cefr_level} • {stats.dictionary_icon} {stats.dictionary_name}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="ml-auto p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-6"
          >
            <div className="text-3xl font-bold text-gray-900">{stats.total_words}</div>
            <div className="text-sm text-gray-500 mt-1">Всего слов</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card p-6"
          >
            <div className="text-3xl font-bold text-gray-900">{stats.active_words}</div>
            <div className="text-sm text-gray-500 mt-1">В изучении</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-6"
          >
            <div className="text-3xl font-bold text-gray-900">{stats.learned_words}</div>
            <div className="text-sm text-gray-500 mt-1">Выучено</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="card p-6"
          >
            <div className="text-3xl font-bold text-gray-900">{stats.completed_lessons}</div>
            <div className="text-sm text-gray-500 mt-1">Уроков пройдено</div>
          </motion.div>
        </div>

        {/* Start Lesson Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <button
            onClick={handleStartLesson}
            className="btn-primary w-full text-lg"
          >
            Начать урок
          </button>
        </motion.div>

        {/* Settings */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="card p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Настройки</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Уровень</span>
              <span className="font-medium text-gray-900">{stats.cefr_level}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Слов в уроке</span>
              <span className="font-medium text-gray-900">{stats.words_per_lesson_limit}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Уроков в день</span>
              <span className="font-medium text-gray-900">{stats.daily_lesson_limit}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Словарь</span>
              <span className="font-medium text-gray-900">
                {stats.dictionary_icon} {stats.dictionary_name}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
