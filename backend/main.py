from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
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
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()
    
    # Проверка конфигурации GigaChat
    if not settings.USE_MOCK_LLM:
        logger.info("=" * 70)
        logger.info("GigaChat API Configuration:")
        logger.info(f"  Model: {settings.GIGACHAT_MODEL}")
        logger.info(f"  OAuth URL: {settings.GIGACHAT_OAUTH_URL}")
        logger.info(f"  API URL: {settings.GIGACHAT_API_URL}")
        logger.info(f"  Scope: {settings.GIGACHAT_SCOPE}")
        logger.info("=" * 70)
        logger.warning("⚠️  Using GigaChat API (real LLM)")
        logger.warning("⚠️  SSL verification disabled (verify=False) for Sber certificates")
    else:
        logger.info("=" * 70)
        logger.info("Using Mock LLM (no API calls)")
        logger.info("To use GigaChat, set GIGACHAT_CREDENTIALS in backend/.env")
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


# ==================== MOCK LLM ====================

class MockLLMService:
    """Моковый LLM для тестирования без OpenAI API"""
    
    @staticmethod
    async def generate_sentences(word_groups: list, target_lang: str) -> list:
        """Генерирует простые предложения для каждой группы слов"""
        sentences = []
        for group in word_groups:
            words = [w.lemma for w in group]
            # Простая логика: объединяем слова в предложение
            if target_lang == "en":
                sentence = f"The {' '.join(words)} is here."
            elif target_lang == "de":
                sentence = f"Der {' '.join(words)} ist hier."
            elif target_lang == "es":
                sentence = f"El {' '.join(words)} está aquí."
            elif target_lang == "fr":
                sentence = f"Le {' '.join(words)} est ici."
            else:
                sentence = f"{' '.join(words)}."
            sentences.append(sentence)
        return sentences
    
    @staticmethod
    async def evaluate_translation(
        sentence: str, 
        user_translation: str, 
        target_words: list,
        native_lang: str,
        db: AsyncSession = None
    ) -> dict:
        """Проверка перевода с получением переводов из БД"""
        from sqlalchemy import select
        from models import Dictionary, DictionaryTranslation
        
        word_results = []
        correct_translations = []
        
        for word in target_words:
            word_id = word["id"]
            lemma = word["lemma"]
            
            # Получить переводы слова из БД
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
            
            # Если не нашли в БД, используем translations из word (если есть)
            if not translations:
                translations = word.get("translations", [])
            
            # Проверяем, есть ли ПЕРЕВОД слова в ответе пользователя
            is_correct = False
            has_typo = False
            
            user_trans_lower = user_translation.lower()
            
            for trans in translations:
                trans_lower = trans.lower()
                if trans_lower in user_trans_lower:
                    is_correct = True
                    break
                # Проверка на опечатку (расстояние Левенштейна <= 2)
                elif len(trans_lower) > 3:
                    # Простая проверка: если слова похожи
                    if any(word_part in user_trans_lower for word_part in [trans_lower[:3], trans_lower[-3:]]):
                        has_typo = True
                        is_correct = True
                        break
            
            word_results.append({
                "word_id": word_id,
                "lemma": lemma,
                "translation": translations[0] if translations else "N/A",
                "is_correct": is_correct,
                "has_typo": has_typo
            })
            
            if translations:
                correct_translations.append(f"{lemma} = {translations[0]}")
        
        overall_correct = all(w["is_correct"] for w in word_results)
        
        # Генерируем правильный перевод предложения
        correct_translation = f"{sentence} → {'; '.join(correct_translations)}"
        
        return {
            "word_results": word_results,
            "suggested_new_words": [],
            "overall_correct": overall_correct,
            "correct_translation": correct_translation
        }


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
        db: AsyncSession = None
    ) -> dict:
        """Оценивает перевод через GigaChat API
        
        POST https://api.giga.chat/v1/chat/completions
        """
        import httpx
        from sqlalchemy import select
        from models import DictionaryTranslation
        
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
            
            words_with_translations.append({
                **word,
                "translations": translations
            })
        
        target_words_str = "\n".join(
            f'- word_id: {w["id"]}, lemma: {w["lemma"]}, часть речи: {w["pos"]}, переводы: {", ".join(w["translations"]) if w["translations"] else "N/A"}' 
            for w in words_with_translations
        )
        
        prompt = f"""Оцени перевод пользователя, фокусируясь ТОЛЬКО на этих целевых словах:

{target_words_str}

Предложение (целевой язык): "{sentence}"
Перевод пользователя ({native_lang}): "{user_translation}"

Инструкции:
1. Проверь, правильно ли переведено каждое целевое слово (сравни с переводами выше)
2. Применяй толерантность к опечаткам: если пользователь сделал очевидную опечатку (1-2 буквы), отметь как правильное с has_typo=true
3. Игнорируй точность перевода нецелевых слов, если общий смысл сохранён
4. В поле word_id используй ТОЧНЫЕ ID из списка выше
5. Предложи правильный перевод всего предложения

Верни ТОЛЬКО JSON без дополнительного текста в формате:
{{
    "word_results": [
        {{"word_id": "точное_id_из_списка", "lemma": "слово", "translation": "перевод", "is_correct": true, "has_typo": false}}
    ],
    "suggested_new_words": [],
    "overall_correct": true,
    "correct_translation": "правильный перевод предложения на русский"
}}"""
        
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
                logger.info(f"[GigaChat] Translation evaluated, overall_correct: {result.get('overall_correct')}")
                return result
            except json.JSONDecodeError:
                pass
            
            # Если не JSON, попробовать извлечь JSON из текста
            import re
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                try:
                    result = json.loads(match.group())
                    logger.info(f"[GigaChat] Extracted JSON from text")
                    return result
                except json.JSONDecodeError:
                    pass
            
            # Fallback: вернуть дефолтный ответ
            logger.warning("[GigaChat] Could not parse JSON, returning default response")
            return {
                "word_results": [
                    {"word_id": w["id"], "lemma": w["lemma"], "is_correct": False, "has_typo": False}
                    for w in target_words
                ],
                "suggested_new_words": [],
                "overall_correct": False,
            }


# Выбрать LLM сервис
LLMService = MockLLMService if settings.USE_MOCK_LLM else GigaChatService


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
                            limit: int, exclude_ids: set) -> list:
        # Get already learned word IDs
        result = await db.execute(
            select(UserWord.dictionary_id).where(
                UserWord.user_language_profile_id == profile_id
            )
        )
        learned_ids = set(result.scalars().all()) | exclude_ids
        
        # Get available words
        query = select(Dictionary).where(Dictionary.target_lang == target_lang)
        if learned_ids:
            query = query.where(~Dictionary.id.in_(learned_ids))
        result = await db.execute(query.limit(limit))
        return list(result.scalars().all())
    
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
            raise HTTPException(status_code=429, detail="Daily lesson limit reached")
        
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
        
        # Fill with new words
        needed = max(0, profile.words_per_lesson_limit - len(due_dict_words))
        new_words = await LessonService.get_new_words(
            db, profile_id, profile.target_lang, needed, due_dict_ids
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
        
        # Update profile
        profile.current_lesson_number = lesson_number
        await db.flush()
        
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

@app.get("/api/stats/{user_id}")
async def get_stats(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserStats).where(UserStats.user_id == user_id))
    stats = result.scalar_one_or_none()
    if not stats:
        raise HTTPException(status_code=404, detail="Stats not found")
    return stats

@app.post("/api/lesson/start")
async def start_lesson(req: StartLessonRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f"[Lesson Start] profile_id={req.profile_id}")
    
    # Get profile to find user_id
    result = await db.execute(
        select(UserLanguageProfile).where(UserLanguageProfile.id == req.profile_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        logger.error(f"[Lesson Start] Profile not found: {req.profile_id}")
        raise HTTPException(status_code=404, detail="Profile not found")
    
    logger.info(f"[Lesson Start] Found profile: user_id={profile.user_id}, target_lang={profile.target_lang}")
    return await LessonService.start_lesson(db, profile.user_id, req.profile_id)

@app.post("/api/lesson/submit")
async def submit_translation(req: SubmitTranslationRequest, db: AsyncSession = Depends(get_db)):
    # Get exercise
    result = await db.execute(
        select(LessonExercise).where(LessonExercise.id == req.exercise_id)
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    # Get target words
    target_word_ids = exercise.target_word_ids
    result = await db.execute(
        select(Dictionary).where(Dictionary.id.in_(target_word_ids))
    )
    target_words = [{"id": w.id, "lemma": w.lemma, "pos": w.pos} for w in result.scalars().all()]
    
    # Get user's native lang
    lesson_result = await db.execute(select(Lesson).where(Lesson.id == exercise.lesson_id))
    lesson = lesson_result.scalar_one()
    user_result = await db.execute(select(User).where(User.id == lesson.user_id))
    user = user_result.scalar_one()
    
    # Evaluate via LLM
    evaluation = await LLMService.evaluate_translation(
        exercise.target_sentence,
        req.translation,
        target_words,
        user.native_lang,
        db=db,  # Передаём сессию БД для получения переводов
    )
    
    # Update exercise
    exercise.user_translation = req.translation
    exercise.llm_response_json = evaluation
    exercise.status = "completed"
    await db.flush()
    
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

@app.get("/api/health")
async def health():
    return {
        "status": "ok", 
        "version": "1.0.0",
        "mode": "mock_llm" if settings.USE_MOCK_LLM else "real_llm"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
