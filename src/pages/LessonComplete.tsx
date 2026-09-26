import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy, ArrowRight, Flame, BookOpen, Target } from 'lucide-react';
import { getStats, getLessons, getUserWords } from '../store';

export default function LessonComplete() {
  const navigate = useNavigate();
  const stats = getStats();
  const lessons = getLessons();
  const userWords = getUserWords();
  const [lastLesson, setLastLesson] = useState<any>(null);

  useEffect(() => {
    const completed = lessons.filter(l => l.status === 'completed');
    if (completed.length > 0) {
      setLastLesson(completed[completed.length - 1]);
    }
    
    // Fire confetti
    const duration = 2000;
    const end = Date.now() + duration;
    
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#6366f1', '#8b5cf6', '#a855f7'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#6366f1', '#8b5cf6', '#a855f7'],
      });
      
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-sm w-full text-center space-y-8"
      >
        {/* Trophy */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="text-8xl"
        >
          🎉
        </motion.div>

        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Урок завершён!</h1>
          <p className="text-gray-500">Отличная работа! Так держать!</p>
        </div>

        {/* Stats */}
        {lastLesson && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-green-500" />
                <span className="text-gray-600">Слова</span>
              </div>
              <span className="font-bold text-gray-800">
                {lastLesson.correctWords}/{lastLesson.totalWords}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                <span className="text-gray-600">Урок #</span>
              </div>
              <span className="font-bold text-gray-800">{lastLesson.lessonNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="text-gray-600">Стрик</span>
              </div>
              <span className="font-bold text-gray-800">{stats?.currentStreak || 1} дн.</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            На главную <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
