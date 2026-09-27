import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, RotateCcw, BookOpen, Target, TrendingUp, Flame } from 'lucide-react';
import { getUser, getProfile, getStats, resetAll } from '../store';
import { startLesson } from '../services/lessonService';
import { fetchUserWords, fetchStats } from '../services/lessonService';
import { getDictionary } from '../data/dictionaries';
import Toast, { ToastType } from '../components/Toast';

const langNames: Record<string, string> = {
  en: 'English', de: 'Deutsch', es: 'Español', fr: 'Français', ru: 'Русский'
};

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const profile = getProfile();
  const [stats, setStats] = useState<any>(null);
  const [userWords, setUserWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [statsData, wordsData] = await Promise.all([
      fetchStats(),
      fetchUserWords(),
    ]);
    setStats(statsData);
    setUserWords(wordsData);
    setLoading(false);
  };

  const handleStartLesson = async () => {
    setToast(null);
    
    try {
      const session = await startLesson(true);
      
      if (!session) {
        setToast({ message: 'Не удалось начать урок', type: 'error' });
        return;
      }
      
      sessionStorage.setItem('currentLesson', JSON.stringify(session));
      navigate('/lesson');
    } catch (error: any) {
      if (error.message && error.message.includes('429')) {
        const match = error.message.match(/Дневной лимит уроков достигнут:.*$/);
        setToast({ message: match ? match[0] : 'Дневной лимит достигнут', type: 'info' });
      } else {
        setToast({ message: 'Не удалось начать урок', type: 'error' });
      }
    }
  };

  const handleReset = () => {
    if (confirm('Сбросить все данные?')) {
      resetAll();
      navigate('/onboarding');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Загрузка...</div>
      </div>
    );
  }

  const activeWords = userWords.filter((w: any) => w.status === 'active').length;

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-12"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Привет, {user?.name}
            </h1>
            <p className="text-gray-500 mt-1">
              {langNames[profile?.targetLang || 'en']} • {profile?.cefrLevel}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/profile')}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="text-sm text-gray-500">Стрик</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats?.current_streak || 0}</div>
            <div className="text-xs text-gray-400 mt-1">дней подряд</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-500">Уроки</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats?.total_lessons_completed || 0}</div>
            <div className="text-xs text-gray-400 mt-1">всего пройдено</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-500">Слова</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{activeWords}</div>
            <div className="text-xs text-gray-400 mt-1">в изучении</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="card p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-gray-500">Изучено</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats?.total_words_learned || 0}</div>
            <div className="text-xs text-gray-400 mt-1">всего слов</div>
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

        <AnimatePresence>
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
        </AnimatePresence>

        {/* Vocabulary Link */}
        {userWords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-8"
          >
            <button
              onClick={() => navigate('/vocabulary')}
              className="btn-secondary w-full"
            >
              Мой словарь ({userWords.length})
            </button>
          </motion.div>
        )}

        {/* Recent Words */}
        {userWords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Последние слова</h2>
            <div className="flex flex-wrap gap-2">
              {userWords.slice(-10).reverse().map((uw: any) => {
                const dict = getDictionary(profile?.targetLang || 'en').find(d => d.id === uw.dictionary_id);
                return dict ? (
                  <div
                    key={uw.id}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
                  >
                    <span className="font-medium text-gray-900">{dict.lemma}</span>
                    <span className="text-gray-400 ml-2">• ст.{uw.stage}</span>
                  </div>
                ) : null;
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
