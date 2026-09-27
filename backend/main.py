from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from pydantic import BaseModel
from typing import Optional, List
import uuid
import json
import logging
import urllib3
from datetime import datetime, date

from database import get_db, init_db
from models import (
    User, UserLanguageProfile, UserStats, Dictionary, 
    DictionaryTranslation, UserWord, Lesson, LessonExercise, LLMCallLog
)
from config import settings

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Подавить предупреждения о SSL (для самоподписанных сертификатов Сбера)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = FastAPI(title="LingoFlow API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()
    
    # Проверка конфигурации GigaChat
    logger.info("=" * 70)
    logger.info("GigaChat API Configuration:")
    logger.info(f"  Model: {settings.GIGACHAT_MODEL}")
    logger.info(f"  OAuth URL: {settings.GIGACHAT_OAUTH_URL}")
    logger.info(f"  API URL: {settings.GIGACHAT_API_URL}")
    logger.info(f"  Scope: {settings.GIGACHAT_SCOPE}")
    logger.info("=" * 70)
    
    if not settings.GIGACHAT_CREDENTIALS or settings.GIGACHAT_CREDENTIALS == "your-gigachat-credentials-here":
        logger.error("❌ GIGACHAT_CREDENTIALS not set!")
        logger.error("❌ Please set GIGACHAT_CREDENTIALS in backend/.env")
        logger.error("❌ Application will not work without valid credentials")
    else:
        logger.info("✅ Using GigaChat API")
        logger.warning("⚠️  SSL verification disabled (verify=False) for Sber certificates")
    
    logger.info("=" * 70)


# ==================== SCHEMAS ====================

class RegisterRequest(BaseModel):
    name: str
    email: str

class SetupProfileRequest(BaseModel):
    user_id: str
    native_lang: str
    target_lang: str
    cefr_level: str
    words_per_lesson_limit: int = 5

class StartLessonRequest(BaseModel):
    profile_id: str
    force_new: bool = False  # Принудительно создать новый урок

class SubmitTranslationRequest(BaseModel):
    exercise_id: str
    translation: str

class AddWordRequest(BaseModel):
    profile_id: str
    dictionary_id: str
    status: str = "active"

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    native_lang: str

class ProfileResponse(BaseModel):
    id: str
    user_id: str
    target_lang: str
    cefr_level: str
    current_lesson_number: int
    words_per_lesson_limit: int
    daily_lesson_limit: int


# ==================== GIGACHAT LLM ====================

class GigaChatService:
    """LLM через GigaChat API (Сбер)
    
    Документация: https://developers.sber.ru/docs/ru/gigachat/api/reference/rest/post-token
    """
    
    _access_token: Optional[str] = None
    _token_expires_at: float = 0  # В секундах
    
    @classmethod
    async def _get_access_token(cls) -> str:
        """Получить или обновить токен доступа GigaChat
        
        POST https://ngw.devices.sberbank.ru:9443/api/v2/oauth
        Токен действителен 30 минут
        """
        import time
        import httpx
        
        # Если токен ещё действителен (с запасом 60 сек), вернуть его
        current_time = time.time()
        if cls._access_token and current_time < cls._token_expires_at - 60:
            logger.debug(f"[GigaChat] Using cached token, expires in {int(cls._token_expires_at - current_time)}s")
            return cls._access_token
        
        # Получить новый токен
        logger.info("[GigaChat] Requesting new access token...")
        
        # Проверяем формат credentials
        auth_header = settings.GIGACHAT_CREDENTIALS
        if not auth_header.startswith("Basic "):
            auth_header = f"Basic {auth_header}"
        
        logger.debug(f"[GigaChat] Authorization header: {auth_header[:20]}...")
        
        async with httpx.AsyncClient(verify=False) as client:  # verify=False для самоподписанного сертификата Сбера
            response = await client.post(
                settings.GIGACHAT_OAUTH_URL,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                    "RqUID": str(uuid.uuid4()),
                    "Authorization": auth_header,
                },
                data={"scope": settings.GIGACHAT_SCOPE},
                timeout=30.0,
            )
            
            if response.status_code != 200:
                logger.error(f"[GigaChat] Token request failed: {response.status_code} - {response.text}")
                response.raise_for_status()
            
            data = response.json()
            
            cls._access_token = data["access_token"]
            # expires_at приходит в миллисекундах, конвертируем в секунды
            cls._token_expires_at = data["expires_at"] / 1000
            
            logger.info(f"[GigaChat] Access token obtained successfully, expires at {datetime.fromtimestamp(cls._token_expires_at)}")
            return cls._access_token
    
    @staticmethod
    async def generate_sentences(word_groups: list, target_lang: str) -> list:
        """Генерирует предложения через GigaChat API
        
        POST https://api.giga.chat/v1/chat/completions
        """
        import httpx
        
        groups_data = []
        for group in word_groups:
            groups_data.append({
                "words": [{"lemma": w.lemma, "pos": w.pos} for w in group],
            })
        
        # Формируем промпт с информацией о частях речи
        groups_info = []
        for i, g in enumerate(groups_data):
            words_info = [f'{w["lemma"]} ({w["pos"]})' for w in g["words"]]
            groups_info.append(f'Группа {i+1}: {", ".join(words_info)}')
        
        prompt = f"""Сгенерируй ровно по одному естественному предложению для каждой группы слов ниже.

Требования:
1. Каждое предложение должно использовать ВСЕ слова из своей группы
2. Используй слова в грамматически правильных формах (спряжения, склонения)
3. Предложения должны быть естественными и осмысленными
4. Целевой язык: {target_lang}
5. Уровень CEFR: A1-A2 (простые предложения)

Группы слов:
{chr(10).join(groups_info)}

Верни ТОЛЬКО JSON массив предложений, по одному на группу, без дополнительного текста:
["предложение1", "предложение2", ...]"""
        
        token = await GigaChatService._get_access_token()
        
        logger.info(f"[GigaChat] Generating sentences for {len(word_groups)} word groups")
        logger.info(f"[GigaChat] Word groups: {groups_data}")
        logger.debug(f"[GigaChat] Prompt:\n{prompt}")
        
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                f"{settings.GIGACHAT_API_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "LingoFlow/1.0",
                },
                json={
                    "model": settings.GIGACHAT_MODEL,
                    "messages": [
                        {"role": "system", "content": "Ты — лингвистический AI-ассистент. Отвечай строго в формате JSON без дополнительного текста."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 500,
                },
                timeout=30.0,
            )
            
            if response.status_code != 200:
                logger.error(f"[GigaChat] Generate sentences failed: {response.status_code} - {response.text}")
                response.raise_for_status()
            
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            
            logger.info(f"[GigaChat] Raw response received")
            logger.debug(f"[GigaChat] Raw response content: {content}")
            
            # Попробовать распарсить JSON
            try:
                sentences = json.loads(content)
                if isinstance(sentences, dict):
                    # Если вернулся объект, взять первое значение
                    sentences = list(sentences.values())[0] if sentences else []
                if isinstance(sentences, list):
                    logger.info(f"[GigaChat] Generated {len(sentences)} sentences")
                    return sentences
            except json.JSONDecodeError:
                pass
            
            # Если не JSON, попробовать извлечь массив из текста
            import re
            match = re.search(r'\[.*?\]', content, re.DOTALL)
            if match:
                try:
                    sentences = json.loads(match.group())
                    logger.info(f"[GigaChat] Extracted {len(sentences)} sentences from text")
                    return sentences
                except json.JSONDecodeError:
                    pass
            
            # Fallback: разбить по предложениям
            logger.warning("[GigaChat] Could not parse JSON, using fallback")
            return [content.strip()]
    
    @staticmethod
    async def evaluate_translation(
        sentence: str, 
        user_translation: str, 
        target_words: list,
        native_lang: str,
        db: AsyncSession = None,
        profile_id: str = None
    ) -> dict:
        """Оценивает перевод через GigaChat API
        
        POST https://api.giga.chat/v1/chat/completions
        """
        import httpx
        from sqlalchemy import select
        from models import DictionaryTranslation, UserWord
        
        logger.info(f"[GigaChat] === Начало оценки перевода ===")
        logger.info(f"[GigaChat] Предложение: {sentence}")
        logger.info(f"[GigaChat] Перевод пользователя: {user_translation}")
        logger.info(f"[GigaChat] Целевых слов: {len(target_words)}")
        logger.info(f"[GigaChat] Profile ID: {profile_id}")
        
        # Получаем переводы слов из БД
        words_with_translations = []
        for word in target_words:
            word_id = word["id"]
            lemma = word["lemma"]
            translations = []
            
            if db:
                result = await db.execute(
                    select(DictionaryTranslation).where(
                        DictionaryTranslation.dictionary_id == word_id,
                        DictionaryTranslation.lang == native_lang
                    )
                )
                trans_record = result.scalar_one_or_none()
                if trans_record and trans_record.translations:
                    translations = trans_record.translations if isinstance(trans_record.translations, list) else [trans_record.translations]
                    logger.info(f"[GigaChat] Найдены переводы для '{lemma}': {translations}")
                else:
                    logger.warning(f"[GigaChat] Переводы НЕ найдены в БД для '{lemma}'")
            
            words_with_translations.append({
                **word,
                "translations": translations
            })
        
        target_words_str = "\n".join(
            f'- word_id: {w["id"]}, lemma: {w["lemma"]}, часть речи: {w["pos"]}, переводы: {", ".join(w["translations"]) if w["translations"] else "N/A"}' 
            for w in words_with_translations
        )
        
        prompt = f"""Оцени перевод пользователя и предложи НОВЫЕ слова для изучения.

## Целевые слова (уже изучаются, оцени их перевод):
{target_words_str}

## Предложение для анализа:
Предложение (целевой язык): "{sentence}"
Перевод пользователя ({native_lang}): "{user_translation}"

## Задачи:

### Задача 1: Оцени целевые слова
1. Проверь, правильно ли переведено каждое целевое слово (сравни с переводами выше)
2. Применяй толерантность к опечаткам: если пользователь сделал очевидную опечатку (1-2 буквы), отметь как правильное с has_typo=true
3. В поле word_id используй ТОЧНЫЕ ID из списка выше

### Задача 2: Найди НОВЫЕ слова для изучения
Проанализируй ВСЁ предложение и найди слова, которые:
- Пользователь перевёл НЕПРАВИЛЬНО или пропустил в переводе
- НЕ входят в список целевых слов выше (это важно!)
- Являются важными для изучения (существительные, глаголы, прилагательные, наречия)
- Не являются артиклями, предлогами или союзами (если они не несут важного смысла)

Для каждого найденного нового слова укажи его lemma (начальную форму) на целевом языке.

### Задача 3: Предложи правильный перевод
Предложи правильный перевод всего предложения на {native_lang}.

## Формат ответа:
Верни ТОЛЬКО JSON без дополнительного текста:
{{
    "word_results": [
        {{"word_id": "точное_id_из_списка", "lemma": "слово", "translation": "перевод", "is_correct": true, "has_typo": false}}
    ],
    "suggested_new_words": [
        {{"lemma": "walk", "pos": "verb", "translation": "ходить"}},
        {{"lemma": "park", "pos": "noun", "translation": "парк"}}
    ],
    "overall_correct": true,
    "correct_translation": "правильный перевод предложения на русский"
}}

Важно: в suggested_new_words возвращай ТОЛЬКО новые слова (не из целевых), которые пользователь перевёл неправильно."""
        
        token = await GigaChatService._get_access_token()
        
        logger.info(f"[GigaChat] Evaluating translation for {len(target_words)} target words")
        
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                f"{settings.GIGACHAT_API_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "LingoFlow/1.0",
                },
                json={
                    "model": settings.GIGACHAT_MODEL,
                    "messages": [
                        {"role": "system", "content": "Ты — лингвистический AI-ассистент. Отвечай строго в формате JSON без дополнительного текста."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 500,
                },
                timeout=30.0,
            )
            
            if response.status_code != 200:
                logger.error(f"[GigaChat] Evaluate translation failed: {response.status_code} - {response.text}")
                response.raise_for_status()
            
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            
            logger.debug(f"[GigaChat] Raw evaluation response: {content}")
            
            # Попробовать распарсить JSON
            try:
                result = json.loads(content)
                logger.info(f"[GigaChat] === Результат от LLM ===")
                logger.info(f"[GigaChat] Overall correct: {result.get('overall_correct')}")
                logger.info(f"[GigaChat] Suggested new words от LLM: {result.get('suggested_new_words', [])}")
                logger.info(f"[GigaChat] Word results:")
                for wr in result.get('word_results', []):
                    logger.info(f"[GigaChat]   - {wr.get('lemma')}: is_correct={wr.get('is_correct')}, has_typo={wr.get('has_typo')}")
                
                # Фильтруем suggested_new_words - ищем слова в dictionaries по lemma и проверяем, что их нет в user_words
                if db and profile_id and "suggested_new_words" in result:
                    suggested_words = result["suggested_new_words"]
                    logger.info(f"[GigaChat] Начинаю фильтрацию {len(suggested_words)} предложенных новых слов...")
                    filtered_suggestions = []
                    
                    # Получаем ID целевых слов, чтобы исключить их
                    target_word_ids = {w["id"] for w in target_words}
                    
                    for suggested_word in suggested_words:
                        lemma = suggested_word.get("lemma")
                        pos = suggested_word.get("pos", "noun")
                        translation = suggested_word.get("translation", "")
                        
                        logger.info(f"[GigaChat] Проверяю новое слово: '{lemma}' ({pos})")
                        
                        # Ищем слово в dictionaries по lemma и target_lang
                        dict_result = await db.execute(
                            select(Dictionary).where(
                                Dictionary.lemma == lemma,
                                Dictionary.target_lang == target_words[0]["target_lang"] if target_words else "en"
                            )
                        )
                        dict_word = dict_result.scalar_one_or_none()
                        
                        if dict_word:
                            logger.info(f"[GigaChat] ✓ Слово '{lemma}' найдено в dictionaries (ID: {dict_word.id})")
                            
                            # Проверяем, что это НЕ целевое слово
                            if dict_word.id in target_word_ids:
                                logger.info(f"[GigaChat] ✗ Слово '{lemma}' является целевым, не предлагаю")
                                continue
                            
                            # Проверяем, есть ли это слово уже в user_words
                            user_word_result = await db.execute(
                                select(UserWord).where(
                                    UserWord.user_language_profile_id == profile_id,
                                    UserWord.dictionary_id == dict_word.id
                                )
                            )
                            user_word = user_word_result.scalar_one_or_none()
                            
                            # Если слова нет в user_words, предлагаем его добавить
                            if not user_word:
                                filtered_suggestions.append({
                                    "dictionary_id": dict_word.id,
                                    "lemma": lemma,
                                    "translation": translation
                                })
                                logger.info(f"[GigaChat] ✓✓✓ Слова '{lemma}' НЕТ в user_words, предлагаю добавить!")
                            else:
                                logger.info(f"[GigaChat] ✗ Слово '{lemma}' УЖЕ есть в user_words, не предлагаю")
                        else:
                            logger.warning(f"[GigaChat] ✗ Слово '{lemma}' НЕ найдено в dictionaries")
                    
                    logger.info(f"[GigaChat] После фильтрации: {len(filtered_suggestions)} новых слов для предложения")
                    result["suggested_new_words"] = filtered_suggestions
                else:
                    logger.warning(f"[GigaChat] Не могу фильтровать suggested_new_words: db={db is not None}, profile_id={profile_id}")
                
                logger.info(f"[GigaChat] === Конец оценки перевода ===")
                return result
            except json.JSONDecodeError:
                logger.error(f"[GigaChat] Ошибка парсинга JSON: {content}")
                pass
            
            # Если не JSON, попробовать извлечь JSON из текста
            import re
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                try:
                    result = json.loads(match.group())
                    logger.info(f"[GigaChat] Извлечён JSON из текста")
                    logger.info(f"[GigaChat] Suggested new words от LLM: {result.get('suggested_new_words', [])}")
                    
                    # Фильтруем suggested_new_words - ищем слова в dictionaries по lemma
                    if db and profile_id and "suggested_new_words" in result:
                        suggested_words = result["suggested_new_words"]
                        logger.info(f"[GigaChat] Начинаю фильтрацию {len(suggested_words)} предложенных новых слов...")
                        filtered_suggestions = []
                        
                        # Получаем ID целевых слов, чтобы исключить их
                        target_word_ids = {w["id"] for w in target_words}
                        
                        for suggested_word in suggested_words:
                            lemma = suggested_word.get("lemma")
                            pos = suggested_word.get("pos", "noun")
                            translation = suggested_word.get("translation", "")
                            
                            logger.info(f"[GigaChat] Проверяю новое слово: '{lemma}' ({pos})")
                            
                            # Ищем слово в dictionaries по lemma и target_lang
                            dict_result = await db.execute(
                                select(Dictionary).where(
                                    Dictionary.lemma == lemma,
                                    Dictionary.target_lang == target_words[0]["target_lang"] if target_words else "en"
                                )
                            )
                            dict_word = dict_result.scalar_one_or_none()
                            
                            if dict_word:
                                logger.info(f"[GigaChat] ✓ Слово '{lemma}' найдено в dictionaries (ID: {dict_word.id})")
                                
                                # Проверяем, что это НЕ целевое слово
                                if dict_word.id in target_word_ids:
                                    logger.info(f"[GigaChat] ✗ Слово '{lemma}' является целевым, не предлагаю")
                                    continue
                                
                                # Проверяем, есть ли это слово уже в user_words
                                user_word_result = await db.execute(
                                    select(UserWord).where(
                                        UserWord.user_language_profile_id == profile_id,
                                        UserWord.dictionary_id == dict_word.id
                                    )
                                )
                                user_word = user_word_result.scalar_one_or_none()
                                
                                if not user_word:
                                    filtered_suggestions.append({
                                        "dictionary_id": dict_word.id,
                                        "lemma": lemma,
                                        "translation": translation
                                    })
                                    logger.info(f"[GigaChat] ✓✓✓ Слова '{lemma}' НЕТ в user_words, предлагаю добавить!")
                                else:
                                    logger.info(f"[GigaChat] ✗ Слово '{lemma}' УЖЕ есть в user_words, не предлагаю")
                            else:
                                logger.warning(f"[GigaChat] ✗ Слово '{lemma}' НЕ найдено в dictionaries")
                        
                        logger.info(f"[GigaChat] После фильтрации: {len(filtered_suggestions)} новых слов для предложения")
                        result["suggested_new_words"] = filtered_suggestions
                    
                    return result
                except json.JSONDecodeError:
                    logger.error(f"[GigaChat] Ошибка парсинга извлечённого JSON")
                    pass
            
            # Fallback: вернуть дефолтный ответ
            logger.warning("[GigaChat] Не удалось распарсить JSON, возвращаю дефолтный ответ")
            return {
                "word_results": [
                    {"word_id": w["id"], "lemma": w["lemma"], "is_correct": False, "has_typo": False}
                    for w in target_words
                ],
                "suggested_new_words": [],
                "overall_correct": False,
            }


# Всегда используем GigaChat
LLMService = GigaChatService


# ==================== AUTH ====================

class AuthService:
    @staticmethod
    async def register(db: AsyncSession, req: RegisterRequest) -> User:
        # Check if user exists
        result = await db.execute(select(User).where(User.email == req.email))
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            # Return existing user (allow re-login)
            return existing_user
        
        # Create new user (simplified - no password for now)
        user = User(
            id=str(uuid.uuid4()),
            email=req.email,
            password_hash="",  # Simplified auth
            name=req.name,
            native_lang="",  # Will be set during profile setup
            timezone="UTC",
        )
        db.add(user)
        await db.flush()
        
        # Create stats
        stats = UserStats(user_id=user.id)
        db.add(stats)
        await db.flush()
        
        return user


# ==================== LESSON SERVICE ====================

class LessonService:
    @staticmethod
    async def get_due_words(db: AsyncSession, profile_id: str, current_lesson: int) -> list:
        result = await db.execute(
            select(UserWord).where(
                UserWord.user_language_profile_id == profile_id,
                UserWord.status == "active",
                UserWord.due_lesson_number <= current_lesson,
            )
        )
        return list(result.scalars().all())
    
    @staticmethod
    async def get_new_words(db: AsyncSession, profile_id: str, target_lang: str, 
                            limit: int, exclude_ids: set, cefr_level: str = "A1") -> list:
        # Get already learned word IDs
        result = await db.execute(
            select(UserWord.dictionary_id).where(
                UserWord.user_language_profile_id == profile_id
            )
        )
        learned_ids = set(result.scalars().all()) | exclude_ids
        
        # Define CEFR level hierarchy
        level_hierarchy = {
            "A1": ["A1"],
            "A2": ["A1", "A2"],
            "B1": ["A1", "A2", "B1"],
            "B2": ["A1", "A2", "B1", "B2"]
        }
        
        # Get allowed levels for user's CEFR level
        allowed_levels = level_hierarchy.get(cefr_level, ["A1"])
        
        logger.info(f"[LessonService.get_new_words] User level: {cefr_level}, allowed levels: {allowed_levels}")
        
        # Get available words filtered by CEFR level
        query = select(Dictionary).where(
            Dictionary.target_lang == target_lang,
            Dictionary.cefr_level.in_(allowed_levels)
        )
        if learned_ids:
            query = query.where(~Dictionary.id.in_(learned_ids))
        
        # Order by CEFR level (higher levels first for more challenge)
        query = query.order_by(Dictionary.cefr_level.desc())
        
        result = await db.execute(query.limit(limit))
        words = list(result.scalars().all())
        
        logger.info(f"[LessonService.get_new_words] Found {len(words)} words for levels {allowed_levels}")
        
        return words
    
    @staticmethod
    def cluster_words(words: list, target_count: int = 5) -> list:
        """Split words into groups of 2-3"""
        groups = []
        n = len(words)
        i = 0
        while i < n:
            remaining = n - i
            if remaining <= 3:
                groups.append(words[i:])
                break
            elif remaining == 4:
                groups.append(words[i:i+2])
                groups.append(words[i+2:])
                break
            elif remaining == 5:
                groups.append(words[i:i+2])
                groups.append(words[i+2:])
                break
            else:
                groups.append(words[i:i+3])
                i += 3
        return groups
    
    @staticmethod
    async def start_lesson(db: AsyncSession, user_id: str, profile_id: str) -> dict:
        logger.info(f"[LessonService.start_lesson] user_id={user_id}, profile_id={profile_id}")
        
        # Get profile
        result = await db.execute(
            select(UserLanguageProfile).where(UserLanguageProfile.id == profile_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            logger.error(f"[LessonService.start_lesson] Profile not found: {profile_id}")
            raise HTTPException(status_code=404, detail="Profile not found")
        
        logger.info(f"[LessonService.start_lesson] Profile loaded: target_lang={profile.target_lang}, level={profile.cefr_level}")
        
        # Check for in-progress lesson
        result = await db.execute(
            select(Lesson).where(
                Lesson.user_id == user_id,
                Lesson.status == "in_progress"
            )
        )
        in_progress = result.scalar_one_or_none()
        if in_progress:
            # Return existing lesson
            exercises_result = await db.execute(
                select(LessonExercise).where(
                    LessonExercise.lesson_id == in_progress.id
                ).order_by(LessonExercise.order_index)
            )
            exercises = list(exercises_result.scalars().all())
            return {"lesson": in_progress, "exercises": exercises, "resumed": True}
    
    @staticmethod
    async def start_lesson(db: AsyncSession, user_id: str, profile_id: str, force_new: bool = False) -> dict:
        logger.info(f"[LessonService.start_lesson] user_id={user_id}, profile_id={profile_id}, force_new={force_new}")
        
        # Get profile
        result = await db.execute(
            select(UserLanguageProfile).where(UserLanguageProfile.id == profile_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            logger.error(f"[LessonService.start_lesson] Profile not found: {profile_id}")
            raise HTTPException(status_code=404, detail="Profile not found")
        
        logger.info(f"[LessonService.start_lesson] Profile loaded: target_lang={profile.target_lang}, level={profile.cefr_level}")
        
        # Check for in-progress lesson (skip if force_new=True)
        if not force_new:
            result = await db.execute(
                select(Lesson).where(
                    Lesson.user_id == user_id,
                    Lesson.status == "in_progress"
                )
            )
            in_progress = result.scalar_one_or_none()
            if in_progress:
                logger.info(f"[LessonService.start_lesson] Resuming existing lesson: {in_progress.id}")
                # Return existing lesson
                exercises_result = await db.execute(
                    select(LessonExercise).where(
                        LessonExercise.lesson_id == in_progress.id
                    ).order_by(LessonExercise.order_index)
                )
                exercises = list(exercises_result.scalars().all())
                return {"lesson": in_progress, "exercises": exercises, "resumed": True}
        else:
            # Mark old in-progress lessons as abandoned
            result = await db.execute(
                select(Lesson).where(
                    Lesson.user_id == user_id,
                    Lesson.status == "in_progress"
                )
            )
            old_lessons = result.scalars().all()
            for old_lesson in old_lessons:
                logger.info(f"[LessonService.start_lesson] Marking old lesson as abandoned: {old_lesson.id}")
                old_lesson.status = "abandoned"
            await db.flush()
        
        # Check daily limit
        today = date.today()
        result = await db.execute(
            select(func.count(Lesson.id)).where(
                Lesson.user_id == user_id,
                Lesson.status == "completed",
                func.date(Lesson.started_at) == today,
            )
        )
        today_count = result.scalar()
        if today_count >= profile.daily_lesson_limit:
            logger.info(f"[LessonService.start_lesson] Daily limit reached: {today_count}/{profile.daily_lesson_limit}")
            raise HTTPException(
                status_code=429, 
                detail=f"Дневной лимит уроков достигнут: {today_count} из {profile.daily_lesson_limit}. Продолжим завтра!"
            )
        
        # Get words for lesson
        due_words = await LessonService.get_due_words(db, profile_id, profile.current_lesson_number)
        due_dict_ids = {uw.dictionary_id for uw in due_words}
        
        # Get dictionary entries for due words
        if due_dict_ids:
            result = await db.execute(
                select(Dictionary).where(Dictionary.id.in_(due_dict_ids))
            )
            due_dict_words = list(result.scalars().all())
        else:
            due_dict_words = []
        
        # Fill with new words (filtered by user's CEFR level)
        needed = max(0, profile.words_per_lesson_limit - len(due_dict_words))
        new_words = await LessonService.get_new_words(
            db, profile_id, profile.target_lang, needed, due_dict_ids, profile.cefr_level
        )
        
        today_words = due_dict_words + new_words
        if not today_words:
            raise HTTPException(status_code=400, detail="No words available")
        
        # Cluster words
        word_groups = LessonService.cluster_words(today_words)
        
        logger.info(f"[LessonService] Starting sentence generation for {len(word_groups)} word groups")
        
        # Generate sentences via LLM
        sentences = await LLMService.generate_sentences(word_groups, profile.target_lang)
        
        logger.info(f"[LessonService] Generated {len(sentences)} sentences: {sentences}")
        
        # Create lesson
        lesson_number = profile.current_lesson_number + 1
        lesson = Lesson(
            id=str(uuid.uuid4()),
            user_id=user_id,
            user_language_profile_id=profile_id,
            lesson_number=lesson_number,
            status="in_progress",
            total_words=len(today_words),
        )
        db.add(lesson)
        await db.flush()
        
        # Create exercises
        exercises = []
        for i, (group, sentence) in enumerate(zip(word_groups, sentences)):
            exercise = LessonExercise(
                id=str(uuid.uuid4()),
                lesson_id=lesson.id,
                order_index=i + 1,
                target_sentence=sentence,
                target_word_ids=[w.id for w in group],
                status="pending",
            )
            db.add(exercise)
            exercises.append(exercise)
        
        # Add NEW words to user_words (only new words, not due words)
        logger.info(f"[LessonService] Adding {len(new_words)} new words to user_words")
        for word in new_words:
            # Check if word already exists in user_words
            existing_result = await db.execute(
                select(UserWord).where(
                    UserWord.user_language_profile_id == profile_id,
                    UserWord.dictionary_id == word.id,
                )
            )
            existing = existing_result.scalar_one_or_none()
            
            if not existing:
                # Create new user_word
                user_word = UserWord(
                    id=str(uuid.uuid4()),
                    user_language_profile_id=profile_id,
                    dictionary_id=word.id,
                    stage=0,
                    due_lesson_number=lesson_number + 1,  # Due after this lesson
                    status="active",
                    correct_count=0,
                    incorrect_count=0,
                )
                db.add(user_word)
                logger.info(f"[LessonService] Added word '{word.lemma}' to user_words")
        
        # Update profile
        profile.current_lesson_number = lesson_number
        await db.flush()
        
        logger.info(f"[LessonService] Lesson created: {lesson.id}, {len(exercises)} exercises, {len(new_words)} new words added")
        
        return {"lesson": lesson, "exercises": exercises, "resumed": False}


# ==================== ROUTES ====================

@app.post("/api/auth/register", response_model=UserResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f"[Register] name={req.name}, email={req.email}")
    user = await AuthService.register(db, req)
    logger.info(f"[Register] Created user: id={user.id}, email={user.email}")
    return user

@app.get("/api/user/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/api/user/{user_id}/profile")
async def get_user_profile(user_id: str, db: AsyncSession = Depends(get_db)):
    """Get the first (or only) profile for a user"""
    result = await db.execute(
        select(UserLanguageProfile).where(UserLanguageProfile.user_id == user_id)
    )
    profile = result.scalars().first()
    if not profile:
        return None
    return profile

@app.post("/api/profile/setup", response_model=ProfileResponse)
async def setup_profile(req: SetupProfileRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f"[Profile Setup] user_id={req.user_id}, target_lang={req.target_lang}, level={req.cefr_level}, intensity={req.words_per_lesson_limit}")
    
    # Get user
    result = await db.execute(select(User).where(User.id == req.user_id))
    user = result.scalar_one_or_none()
    if not user:
        logger.error(f"[Profile Setup] User not found: {req.user_id}")
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update user's native language
    user.native_lang = req.native_lang
    await db.flush()
    
    # Check if profile already exists
    result = await db.execute(
        select(UserLanguageProfile).where(
            UserLanguageProfile.user_id == req.user_id,
            UserLanguageProfile.target_lang == req.target_lang
        )
    )
    existing_profile = result.scalar_one_or_none()
    if existing_profile:
        # Update existing profile
        existing_profile.cefr_level = req.cefr_level
        existing_profile.words_per_lesson_limit = req.words_per_lesson_limit
        await db.flush()
        logger.info(f"[Profile Setup] Updated existing profile: {existing_profile.id}")
        return existing_profile
    
    # Create new profile
    profile = UserLanguageProfile(
        id=str(uuid.uuid4()),
        user_id=req.user_id,
        target_lang=req.target_lang,
        cefr_level=req.cefr_level,
        words_per_lesson_limit=req.words_per_lesson_limit,
    )
    db.add(profile)
    await db.flush()
    logger.info(f"[Profile Setup] Created new profile: {profile.id}")
    return profile

@app.get("/api/profile/{profile_id}", response_model=ProfileResponse)
async def get_profile(profile_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserLanguageProfile).where(UserLanguageProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

class UpdateProfileRequest(BaseModel):
    cefr_level: Optional[str] = None
    words_per_lesson_limit: Optional[int] = None
    daily_lesson_limit: Optional[int] = None

@app.put("/api/profile/{profile_id}")
async def update_profile(profile_id: str, req: UpdateProfileRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f"[Profile Update] Updating profile: {profile_id}")
    
    result = await db.execute(
        select(UserLanguageProfile).where(UserLanguageProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Update fields if provided
    if req.cefr_level is not None:
        if req.cefr_level not in ["A1", "A2", "B1", "B2"]:
            raise HTTPException(status_code=400, detail="Invalid CEFR level")
        profile.cefr_level = req.cefr_level
        logger.info(f"[Profile Update] Updated cefr_level to {req.cefr_level}")
    
    if req.words_per_lesson_limit is not None:
        if req.words_per_lesson_limit < 1 or req.words_per_lesson_limit > 20:
            raise HTTPException(status_code=400, detail="Words per lesson must be between 1 and 20")
        profile.words_per_lesson_limit = req.words_per_lesson_limit
        logger.info(f"[Profile Update] Updated words_per_lesson_limit to {req.words_per_lesson_limit}")
    
    if req.daily_lesson_limit is not None:
        if req.daily_lesson_limit < 1 or req.daily_lesson_limit > 10:
            raise HTTPException(status_code=400, detail="Daily lesson limit must be between 1 and 10")
        profile.daily_lesson_limit = req.daily_lesson_limit
        logger.info(f"[Profile Update] Updated daily_lesson_limit to {req.daily_lesson_limit}")
    
    await db.flush()
    return profile


class MarkWordLearnedRequest(BaseModel):
    profile_id: str
    dictionary_id: str

@app.post("/api/words/mark-learned")
async def mark_word_learned(req: MarkWordLearnedRequest, db: AsyncSession = Depends(get_db)):
    """Пометить слово как изученное"""
    logger.info(f"[Word Mark] Marking word as learned: dictionary_id={req.dictionary_id}, profile_id={req.profile_id}")
    
    result = await db.execute(
        select(UserWord).where(
            UserWord.user_language_profile_id == req.profile_id,
            UserWord.dictionary_id == req.dictionary_id
        )
    )
    user_word = result.scalar_one_or_none()
    
    if not user_word:
        raise HTTPException(status_code=404, detail="User word not found")
    
    # Пометить как изученное
    user_word.status = "learned"
    user_word.stage = 10  # Максимальный уровень
    user_word.due_lesson_number = 999999  # Больше не будет повторяться
    
    await db.flush()
    
    logger.info(f"[Word Mark] Word {req.dictionary_id} marked as learned")
    return {"status": "success", "dictionary_id": req.dictionary_id}

@app.get("/api/stats/{user_id}")
async def get_stats(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserStats).where(UserStats.user_id == user_id))
    stats = result.scalar_one_or_none()
    if not stats:
        raise HTTPException(status_code=404, detail="Stats not found")
    return stats

@app.post("/api/lesson/start")
async def start_lesson(req: StartLessonRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f"[Lesson Start] profile_id={req.profile_id}, force_new={req.force_new}")
    
    # Get profile to find user_id
    result = await db.execute(
        select(UserLanguageProfile).where(UserLanguageProfile.id == req.profile_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        logger.error(f"[Lesson Start] Profile not found: {req.profile_id}")
        raise HTTPException(status_code=404, detail="Profile not found")
    
    logger.info(f"[Lesson Start] Found profile: user_id={profile.user_id}, target_lang={profile.target_lang}")
    return await LessonService.start_lesson(db, profile.user_id, req.profile_id, req.force_new)

@app.post("/api/lesson/submit")
async def submit_translation(req: SubmitTranslationRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f"[SubmitTranslation] === Начало обработки перевода ===")
    logger.info(f"[SubmitTranslation] Exercise ID: {req.exercise_id}")
    logger.info(f"[SubmitTranslation] Перевод пользователя: {req.translation}")
    
    # Get exercise
    result = await db.execute(
        select(LessonExercise).where(LessonExercise.id == req.exercise_id)
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        logger.error(f"[SubmitTranslation] Exercise не найден: {req.exercise_id}")
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    logger.info(f"[SubmitTranslation] Exercise найден, target_word_ids: {exercise.target_word_ids}")
    
    # Get target words
    target_word_ids = exercise.target_word_ids
    result = await db.execute(
        select(Dictionary).where(Dictionary.id.in_(target_word_ids))
    )
    target_words = [{"id": w.id, "lemma": w.lemma, "pos": w.pos} for w in result.scalars().all()]
    logger.info(f"[SubmitTranslation] Загружено {len(target_words)} целевых слов из dictionaries")
    for tw in target_words:
        logger.info(f"[SubmitTranslation]   - {tw['lemma']} (ID: {tw['id']}, POS: {tw['pos']})")
    
    # Get user's native lang
    lesson_result = await db.execute(select(Lesson).where(Lesson.id == exercise.lesson_id))
    lesson = lesson_result.scalar_one()
    user_result = await db.execute(select(User).where(User.id == lesson.user_id))
    user = user_result.scalar_one()
    
    logger.info(f"[SubmitTranslation] Lesson ID: {lesson.id}")
    logger.info(f"[SubmitTranslation] User ID: {user.id}, Native lang: {user.native_lang}")
    logger.info(f"[SubmitTranslation] Profile ID: {lesson.user_language_profile_id}")
    
    # Evaluate via LLM
    logger.info(f"[SubmitTranslation] Вызываю LLM для оценки перевода...")
    evaluation = await LLMService.evaluate_translation(
        exercise.target_sentence,
        req.translation,
        target_words,
        user.native_lang,
        db=db,  # Передаём сессию БД для получения переводов
        profile_id=lesson.user_language_profile_id  # Передаём profile_id для проверки user_words
    )
    
    logger.info(f"[SubmitTranslation] === Результат от LLM ===")
    logger.info(f"[SubmitTranslation] Overall correct: {evaluation.get('overall_correct')}")
    logger.info(f"[SubmitTranslation] Suggested new words: {evaluation.get('suggested_new_words', [])}")
    logger.info(f"[SubmitTranslation] Word results:")
    for wr in evaluation.get('word_results', []):
        logger.info(f"[SubmitTranslation]   - {wr.get('lemma')}: is_correct={wr.get('is_correct')}, has_typo={wr.get('has_typo')}")
    
    # Update exercise
    exercise.user_translation = req.translation
    exercise.llm_response_json = evaluation
    exercise.status = "completed"
    await db.flush()
    
    logger.info(f"[SubmitTranslation] === Конец обработки перевода ===")
    
    # Update word stages
    for wr in evaluation.get("word_results", []):
        result = await db.execute(
            select(UserWord).where(
                UserWord.dictionary_id == wr["word_id"],
                UserWord.user_language_profile_id == lesson.user_language_profile_id,
            )
        )
        user_word = result.scalar_one_or_none()
        if user_word:
            if wr.get("is_correct"):
                user_word.stage = min(user_word.stage + 1, 10)
                user_word.correct_count += 1
            else:
                user_word.stage = max(user_word.stage - 1, 0)
                user_word.incorrect_count += 1
            
            # Calculate next due
            intervals = [1, 2, 4, 7, 14, 21, 30, 45, 60, 90]
            interval = intervals[min(user_word.stage, len(intervals) - 1)]
            profile_result = await db.execute(
                select(UserLanguageProfile).where(UserLanguageProfile.id == lesson.user_language_profile_id)
            )
            profile = profile_result.scalar_one()
            user_word.due_lesson_number = profile.current_lesson_number + interval
    
    await db.flush()
    return evaluation

@app.post("/api/lesson/complete")
async def complete_lesson(req: dict, db: AsyncSession = Depends(get_db)):
    """Завершить урок и обновить статистику"""
    lesson_id = req.get("lesson_id")
    if not lesson_id:
        raise HTTPException(status_code=400, detail="lesson_id is required")
    
    logger.info(f"[Lesson Complete] Completing lesson: {lesson_id}")
    
    # Get lesson
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Count correct words from exercises
    exercises_result = await db.execute(
        select(LessonExercise).where(LessonExercise.lesson_id == lesson_id)
    )
    exercises = exercises_result.scalars().all()
    
    correct_words = 0
    for exercise in exercises:
        if exercise.llm_response_json:
            word_results = exercise.llm_response_json.get("word_results", [])
            correct_words += sum(1 for wr in word_results if wr.get("is_correct"))
    
    # Update lesson
    lesson.status = "completed"
    lesson.completed_at = datetime.now()
    lesson.correct_words = correct_words
    lesson.new_words_added = len([w for w in exercises[0].target_word_ids]) if exercises else 0
    
    # Update user stats
    stats_result = await db.execute(
        select(UserStats).where(UserStats.user_id == lesson.user_id)
    )
    stats = stats_result.scalar_one_or_none()
    
    if stats:
        # Update streak
        today = date.today()
        if stats.last_lesson_date:
            days_diff = (today - stats.last_lesson_date.date()).days
            if days_diff == 1:
                stats.current_streak += 1
            elif days_diff > 1:
                stats.current_streak = 1
        else:
            stats.current_streak = 1
        
        stats.longest_streak = max(stats.longest_streak, stats.current_streak)
        stats.last_lesson_date = datetime.now()
        stats.total_lessons_completed += 1
        stats.total_words_learned += lesson.new_words_added
        
        logger.info(f"[Lesson Complete] Updated stats: streak={stats.current_streak}, lessons={stats.total_lessons_completed}")
    
    await db.flush()
    
    return {
        "status": "completed",
        "lesson_id": lesson_id,
        "correct_words": correct_words,
        "total_words": lesson.total_words,
        "new_words_added": lesson.new_words_added,
        "streak": stats.current_streak if stats else 0
    }

@app.post("/api/words/add")
async def add_word(req: AddWordRequest, db: AsyncSession = Depends(get_db)):
    # Check if already exists
    result = await db.execute(
        select(UserWord).where(
            UserWord.user_language_profile_id == req.profile_id,
            UserWord.dictionary_id == req.dictionary_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return {"id": existing.id, "already_exists": True}
    
    # Get current lesson number
    profile_result = await db.execute(
        select(UserLanguageProfile).where(UserLanguageProfile.id == req.profile_id)
    )
    profile = profile_result.scalar_one()
    
    word = UserWord(
        id=str(uuid.uuid4()),
        user_language_profile_id=req.profile_id,
        dictionary_id=req.dictionary_id,
        stage=0,
        due_lesson_number=profile.current_lesson_number + 1,
        status=req.status,
    )
    db.add(word)
    await db.flush()
    return {"id": word.id, "already_exists": False}

@app.get("/api/words/{profile_id}")
async def get_user_words(profile_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserWord).where(UserWord.user_language_profile_id == profile_id)
    )
    words = result.scalars().all()
    return words

@app.get("/api/dictionary/{target_lang}")
async def get_dictionary(target_lang: str, db: AsyncSession = Depends(get_db)):
    """Получить словарь для указанного языка с переводами"""
    logger.info(f"[Dictionary] Fetching dictionary for language: {target_lang}")
    
    # Получить все слова для языка
    result = await db.execute(
        select(Dictionary).where(Dictionary.target_lang == target_lang)
    )
    words = result.scalars().all()
    
    # Получить переводы для всех слов
    word_ids = [w.id for w in words]
    if word_ids:
        trans_result = await db.execute(
            select(DictionaryTranslation).where(
                DictionaryTranslation.dictionary_id.in_(word_ids),
                DictionaryTranslation.lang == "ru"
            )
        )
        translations_list = trans_result.scalars().all()
        
        # Создать словарь переводов
        translations_map = {}
        for trans in translations_list:
            translations_map[trans.dictionary_id] = trans.translations
    else:
        translations_map = {}
    
    # Сформировать ответ
    dictionary = []
    for word in words:
        dictionary.append({
            "id": word.id,
            "targetLang": word.target_lang,
            "lemma": word.lemma,
            "pos": word.pos,
            "cefrLevel": word.cefr_level,
            "translations": {
                "ru": translations_map.get(word.id, [])
            }
        })
    
    logger.info(f"[Dictionary] Found {len(dictionary)} words for {target_lang}")
    return {"words": dictionary}

@app.get("/api/health")
async def health():
    return {
        "status": "ok", 
        "version": "1.0.0",
        "mode": "mock_llm" if settings.USE_MOCK_LLM else "real_llm"
    }


# ==================== ADMIN PANEL ====================

class AdminAuthRequest(BaseModel):
    password: str

def verify_admin_password(password: str):
    if password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin password")
    return True

@app.post("/admin/auth")
async def admin_auth(req: AdminAuthRequest):
    """Проверка пароля администратора"""
    verify_admin_password(req.password)
    return {"status": "ok", "message": "Authentication successful"}

@app.get("/admin/tables")
async def get_tables(password: str, db: AsyncSession = Depends(get_db)):
    """Получить список всех таблиц"""
    verify_admin_password(password)
    
    result = await db.execute(text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    """))
    tables = [row[0] for row in result.fetchall()]
    return {"tables": tables}

@app.get("/admin/table/{table_name}")
async def get_table_data(table_name: str, password: str, page: int = 1, limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Получить данные из таблицы с пагинацией"""
    verify_admin_password(password)
    
    # Проверка на SQL injection
    allowed_tables = [
        "users", "user_language_profiles", "user_stats", "dictionaries",
        "dictionary_translations", "user_words", "lessons", "lesson_exercises",
        "llm_call_logs"
    ]
    
    if table_name not in allowed_tables:
        raise HTTPException(status_code=400, detail=f"Table '{table_name}' not allowed")
    
    # Валидация параметров пагинации
    if page < 1:
        page = 1
    if limit < 1 or limit > 100:
        limit = 50
    
    # Получить общее количество записей
    count_result = await db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
    total_count = count_result.scalar()
    
    # Вычислить offset
    offset = (page - 1) * limit
    
    # Получить данные с пагинацией
    result = await db.execute(
        text(f"SELECT * FROM {table_name} LIMIT :limit OFFSET :offset"),
        {"limit": limit, "offset": offset}
    )
    rows = result.fetchall()
    columns = result.keys()
    
    data = []
    for row in rows:
        row_dict = {}
        for i, col in enumerate(columns):
            value = row[i]
            # Преобразуем datetime в строку для JSON
            if isinstance(value, datetime):
                value = value.isoformat()
            row_dict[col] = value
        data.append(row_dict)
    
    # Вычислить общее количество страниц
    total_pages = (total_count + limit - 1) // limit
    
    return {
        "table": table_name,
        "columns": list(columns),
        "data": data,
        "count": len(data),
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@app.get("/admin/stats")
async def get_admin_stats(password: str, db: AsyncSession = Depends(get_db)):
    """Получить статистику по таблицам"""
    verify_admin_password(password)
    
    stats = {}
    tables = ["users", "user_language_profiles", "user_stats", "dictionaries", 
              "dictionary_translations", "user_words", "lessons", "lesson_exercises"]
    
    for table in tables:
        result = await db.execute(text(f"SELECT COUNT(*) FROM {table}"))
        count = result.scalar()
        stats[table] = count
    
    return {"stats": stats}

@app.get("/admin")
async def admin_page():
    """Страница админки"""
    from fastapi.responses import FileResponse
    import os
    admin_path = os.path.join(os.path.dirname(__file__), "admin.html")
    return FileResponse(admin_path)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
