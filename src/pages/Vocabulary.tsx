import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { getProfile } from '../store';
import { fetchUserWords } from '../services/lessonService';
import { getDictionary } from '../data/dictionaries';
import { markWordLearned } from '../services/api';

export default function Vocabulary() {
  const navigate = useNavigate();
  const profile = getProfile();
  const [userWords, setUserWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'learning' | 'learned'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    setLoading(true);
    const words = await fetchUserWords();
    setUserWords(words);
    setLoading(false);
  };

  const handleMarkAsLearned = async (dictionaryId: string) => {
    if (!profile) return;
    
    try {
      await markWordLearned(profile.id, dictionaryId);
      // Обновляем локальное состояние
      setUserWords(prev => prev.map(w => 
        w.dictionary_id === dictionaryId ? { ...w, status: 'learned', stage: 10 } : w
      ));
    } catch (error) {
      console.error('Failed to mark word as learned:', error);
    }
  };

  const dictionary = getDictionary(profile?.targetLang || 'en');

  const wordsWithDict = userWords.map((uw: any) => {
    const dict = dictionary.find(d => d.id === uw.dictionary_id);
    return { ...uw, dict };
  }).filter((w: any) => w.dict);

  const filtered = wordsWithDict.filter((w: any) => {
    const matchesSearch = w.dict.lemma.toLowerCase().includes(search.toLowerCase()) ||
      (w.dict.translations['ru'] || []).some((t: string) => t.toLowerCase().includes(search.toLowerCase()));
    
    if (filter === 'learning') return matchesSearch && w.status === 'active';
    if (filter === 'learned') return matchesSearch && w.status === 'learned';
    return matchesSearch;
  });

  // Пагинация
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedWords = filtered.slice(startIndex, endIndex);

  // Сброс страницы при изменении фильтра или поиска
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter]);

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
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Мои слова</h1>
          <span className="ml-auto bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
            {userWords.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-11"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {(['all', 'learning', 'learned'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'Все' : f === 'learning' ? 'Изучаю' : 'Выученные'}
            </button>
          ))}
        </div>

        {/* Words List */}
        <div className="space-y-2">
          {paginatedWords.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📝</div>
              <p>Слов не найдено</p>
            </div>
          ) : (
            paginatedWords.map((w: any, i: number) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={`card p-4 ${w.status === 'learned' ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className={`font-semibold text-gray-900 text-lg ${w.status === 'learned' ? 'line-through' : ''}`}>
                      {w.dict.lemma}
                    </div>
                    <div className="text-sm text-gray-500">
                      {(w.dict.translations['ru'] || []).join(', ')}
                    </div>
                    {w.status === 'learned' && (
                      <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Выучено
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 10 }).map((_: any, idx: number) => (
                          <div
                            key={idx}
                            className={`w-2 h-2 rounded-full ${
                              idx < w.stage ? 'bg-gray-900' : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        ✓{w.correct_count} ✗{w.incorrect_count}
                      </div>
                    </div>
                    {w.status !== 'learned' && (
                      <button
                        onClick={() => handleMarkAsLearned(w.dictionary_id)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Пометить как выученное"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-secondary px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentPage === pageNum
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn-secondary px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Info */}
        {filtered.length > 0 && (
          <div className="text-center text-sm text-gray-500 mt-4">
            Показано {startIndex + 1}-{Math.min(endIndex, filtered.length)} из {filtered.length} слов
          </div>
        )}
      </div>
    </div>
  );
}
