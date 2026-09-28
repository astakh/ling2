import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Settings, RotateCcw } from 'lucide-react';
import { getUser, resetAll } from '../store';
import { getUserProfiles } from '../services/api';
import Toast, { ToastType } from '../components/Toast';

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

interface LanguageProfile {
  id: string;
  target_lang: string;
  cefr_level: string;
  dictionary_category: string;
  dictionary_name: string;
  dictionary_icon: string;
  words_per_lesson_limit: number;
  daily_lesson_limit: number;
  current_lesson_number: number;
  total_words: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [profiles, setProfiles] = useState<LanguageProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await getUserProfiles(user.id);
      setProfiles(response.profiles || []);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      setToast({ message: 'Не удалось загрузить профили', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm('Сбросить все данные? Это действие необратимо.')) {
      resetAll();
      navigate('/onboarding');
    }
  };

  const handleStartLesson = (profileId: string) => {
    // Сохраняем выбранный профиль в localStorage
    localStorage.setItem('currentProfileId', profileId);
    navigate('/lesson');
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
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-12"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Привет, {user?.name} 👋
            </h1>
            <p className="text-gray-500 mt-1">
              {profiles.length > 0 
                ? `${profiles.length} ${profiles.length === 1 ? 'язык' : 'языков'} в изучении`
                : 'Начните изучение нового языка'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/profile')}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Настройки"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Сбросить данные"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
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

        {/* Language Cards */}
        {profiles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {profiles.map((profile, index) => (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="card p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/language/${profile.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">
                      {langFlags[profile.target_lang] || '🌍'}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {langNames[profile.target_lang] || profile.target_lang}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {profile.cefr_level} • {profile.dictionary_icon} {profile.dictionary_name}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {profile.total_words}
                    </div>
                    <div className="text-xs text-gray-500">Слов</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {profile.current_lesson_number}
                    </div>
                    <div className="text-xs text-gray-500">Уроков</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {profile.words_per_lesson_limit}
                    </div>
                    <div className="text-xs text-gray-500">Слов/урок</div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartLesson(profile.id);
                  }}
                  className="btn-primary w-full"
                >
                  Начать урок
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Add Language Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: profiles.length * 0.1 }}
        >
          <button
            onClick={() => navigate('/add-language')}
            className="card p-8 w-full hover:shadow-lg transition-shadow flex items-center justify-center gap-3 text-gray-500 hover:text-gray-900"
          >
            <Plus className="w-6 h-6" />
            <span className="text-lg font-medium">Добавить новый язык</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
