import { DictionaryWord, LLMResponse, WordResult } from '../types';
import { getDictionary } from '../data/dictionaries';

// Simulated LLM service that generates sentences and evaluates translations

// Sentence templates for generating natural sentences with target words
const sentenceTemplates: Record<string, string[]> = {
  en: [
    "The {adj} {noun} likes to {verb} every day.",
    "A {adj} {noun} can {verb} very well.",
    "Every {adj} {noun} wants to {verb} in the {noun2}.",
    "The {noun} is {adj} and likes to {verb}.",
    "I see a {adj} {noun} that can {verb}.",
    "The {adj} {noun} will {verb} with the {noun2}.",
  ],
  de: [
    "Der {adj} {noun} möchte jeden Tag {verb}.",
    "Ein {adj} {noun} kann sehr gut {verb}.",
    "Jeder {adj} {noun} will im {noun2} {verb}.",
    "Der {noun} ist {adj} und möchte {verb}.",
    "Ich sehe einen {adj} {noun}, der {verb} kann.",
    "Der {adj} {noun} wird mit dem {noun2} {verb}.",
  ],
  es: [
    "El {adj} {noun} quiere {verb} cada día.",
    "Un {noun} {adj} puede {verb} muy bien.",
    "Cada {noun} {adj} quiere {verb} en el {noun2}.",
    "El {noun} es {adj} y le gusta {verb}.",
    "Veo un {noun} {adj} que puede {verb}.",
    "El {adj} {noun} va a {verb} con el {noun2}.",
  ],
  fr: [
    "Le {noun} {adj} aime {verb} chaque jour.",
    "Un {noun} {adj} peut très bien {verb}.",
    "Chaque {noun} {adj} veut {verb} dans le {noun2}.",
    "Le {noun} est {adj} et aime {verb}.",
    "Je vois un {noun} {adj} qui peut {verb}.",
    "Le {noun} {adj} va {verb} avec le {noun2}.",
  ],
};

function fillTemplate(template: string, words: DictionaryWord[], lang: string): string {
  let result = template;
  const nouns = words.filter(w => w.pos === 'noun');
  const adjs = words.filter(w => w.pos === 'adjective');
  const verbs = words.filter(w => w.pos === 'verb');
  
  // Fill in the template with actual words
  result = result.replace('{adj}', adjs.length > 0 ? adjs[0].lemma : 'nice');
  result = result.replace('{noun}', nouns.length > 0 ? nouns[0].lemma : 'thing');
  result = result.replace('{verb}', verbs.length > 0 ? verbs[0].lemma : 'do');
  result = result.replace('{noun2}', nouns.length > 1 ? nouns[1].lemma : (nouns.length > 0 ? nouns[0].lemma : 'place'));
  
  return result;
}

export function generateSentences(wordGroups: DictionaryWord[][], lang: string): string[] {
  return wordGroups.map(group => {
    const templates = sentenceTemplates[lang] || sentenceTemplates['en'];
    const template = templates[Math.floor(Math.random() * templates.length)];
    return fillTemplate(template, group, lang);
  });
}

// Simulate LLM evaluation of translation
export function evaluateTranslation(
  sentence: string,
  userTranslation: string,
  targetWords: DictionaryWord[],
  nativeLang: string
): LLMResponse {
  const wordResults: WordResult[] = targetWords.map(word => {
    const translations = word.translations[nativeLang] || word.translations['ru'] || [];
    const userLower = userTranslation.toLowerCase().trim();
    
    // Check if any translation appears in user's answer
    const isCorrect = translations.some(t => {
      const tLower = t.toLowerCase();
      return userLower.includes(tLower);
    });
    
    // Check for typos (close match)
    let hasTypo = false;
    if (!isCorrect) {
      hasTypo = translations.some(t => {
        return levenshteinDistance(userLower, t.toLowerCase()) <= 2 && t.length > 3;
      });
    }
    
    return {
      wordId: word.id,
      lemma: word.lemma,
      isCorrect: isCorrect || hasTypo,
      hasTypo,
    };
  });
  
  const overallCorrect = wordResults.every(w => w.isCorrect);
  
  // Suggest words that were wrong
  const suggestedNewWords = wordResults
    .filter(w => !w.isCorrect)
    .map(w => w.lemma);
  
  return {
    wordResults,
    suggestedNewWords,
    overallCorrect,
  };
}

// Levenshtein distance for typo detection
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Get word translations for display
export function getWordTranslations(word: DictionaryWord, nativeLang: string): string[] {
  return word.translations[nativeLang] || word.translations['ru'] || [];
}
