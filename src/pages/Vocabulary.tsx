import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';
import { getProfile } from '../store';
import { fetchUserWords } from '../services/lessonService';
import { getDictionary } from '../data/dictionaries';

export default function Vocabulary() {
  const navigate = useNavigate();
  const profile = getProfile();
  const [userWords, setUserWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'learning'>('all');

  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    setLoading(true);
    const words = await fetchUserWords();
    setUserWords(words);
    setLoading(false);
  };

  const dictionary = getDictionary(profile?.targetLang || 'en');

  const wordsWithDict = userWords.map((uw: any) => {
    const dict = dictionary.find(d => d.id === uw.dictionary_id);
    return { ...uw, dict };
  }).filter((w: any) => w.dict);

  const filtered = wordsWithDict.filter((w: any) => {
    const matchesSearch = w.dict.lemma.toLowerCase().includes(search.toLowerCase()) ||
      (w.dict.translations['ru'] || []).some((t: string) => t.toLowerCase().includes(search.toLowerCase()));
    
    if (filter === 'active') return matchesSearch && w.status === 'active';
    if (filter === 'learning') return matchesSearch && w.stage < 5;
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-20">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Мои слова</h1>
          <span className="ml-auto bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
            {userWords.length} слов
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск слов..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['all', 'active', 'learning'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : 'Изучаю'}
            </button>
          ))}
        </div>

        {/* Words list */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📝</div>
              <p>Слов пока нет. Начни урок!</p>
            </div>
          ) : (
            filtered.map((w: any, i: number) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-800 text-lg">{w.dict.lemma}</div>
                    <div className="text-sm text-gray-500">
                      {(w.dict.translations['ru'] || []).join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 10 }).map((_: any, idx: number) => (
                        <div
                          key={idx}
                          className={`w-2 h-2 rounded-full ${
                            idx < w.stage ? 'bg-indigo-500' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      ✓{w.correct_count} ✗{w.incorrect_count}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
