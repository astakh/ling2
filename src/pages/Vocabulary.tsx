import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Search } from 'lucide-react';
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
        <div className="flex gap-2 mb-8">
          {(['all', 'active', 'learning'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : 'Изучаю'}
            </button>
          ))}
        </div>

        {/* Words List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📝</div>
              <p>Слов пока нет</p>
            </div>
          ) : (
            filtered.map((w: any, i: number) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="card p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900 text-lg">{w.dict.lemma}</div>
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
                            idx < w.stage ? 'bg-gray-900' : 'bg-gray-200'
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
