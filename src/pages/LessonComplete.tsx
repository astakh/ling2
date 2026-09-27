import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ArrowRight, Flame, BookOpen, Target } from 'lucide-react';
import { fetchStats } from '../services/lessonService';

export default function LessonComplete() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadStats();
    
    const duration = 2000;
    const end = Date.now() + duration;
    
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#111827', '#374151', '#6b7280'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#111827', '#374151', '#6b7280'],
      });
      
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  const loadStats = async () => {
    const statsData = await fetchStats();
    setStats(statsData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center space-y-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="text-7xl"
        >
          ✓
        </motion.div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Урок завершён</h1>
          <p className="text-gray-500">Отличная работа!</p>
        </div>

        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-gray-400" />
              <span className="text-gray-600">Уроков пройдено</span>
            </div>
            <span className="font-bold text-gray-900">{stats?.total_lessons_completed || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-gray-400" />
              <span className="text-gray-600">Слов изучено</span>
            </div>
            <span className="font-bold text-gray-900">{stats?.total_words_learned || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Flame className="w-5 h-5 text-gray-400" />
              <span className="text-gray-600">Стрик</span>
            </div>
            <span className="font-bold text-gray-900">{stats?.current_streak || 0} дн.</span>
          </div>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="btn-primary w-full"
        >
          <div className="flex items-center justify-center gap-2">
            На главную <ArrowRight className="w-5 h-5" />
          </div>
        </button>
      </motion.div>
    </div>
  );
}
