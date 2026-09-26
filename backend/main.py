from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
import uuid
import json
import logging
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
        native_lang: str
    ) -> dict:
        """Простая проверка: ищем переводы в тексте пользователя"""
        word_results = []
        
        for word in target_words:
            lemma = word["lemma"]
            # Получаем переводы из БД (в реальном приложении)
            # Здесь просто проверяем, есть ли слово в переводе
            is_correct = lemma.lower() in user_translation.lower()
            has_typo = False
            
            # Простая проверка опечаток
            if not is_correct:
                # Проверяем похожие слова (упрощённо)
                for trans in word.get("translations", []):
                    if trans.lower() in user_translation.lower():
                        is_correct = True
                        break
            
            word_results.append({
                "word_id": word["id"],
                "lemma": lemma,
                "is_correct": is_correct,
                "has_typo": has_typo
            })
        
        overall_correct = all(w["is_correct"] for w in word_results)
        
        return {
            "word_results": word_results,
            "suggested_new_words": [],
            "overall_correct": overall_correct
        }


# ==================== REAL LLM ====================

class RealLLMService:
    """Реальный LLM через OpenAI API"""
    
    @staticmethod
    async def generate_sentences(word_groups: list, target_lang: str) -> list:
        """Генерирует предложения через OpenAI API"""
        import httpx
        
        groups_data = []
        for group in word_groups:
            groups_data.append({
                "words": [{"lemma": w.lemma, "pos": w.pos} for w in group],
            })
        
        prompt = f"""Generate exactly one natural sentence for each word group below.
Each sentence must use ALL words from its group (in grammatically correct forms).
Target language: {target_lang}
CEFR level: A1-A2 (simple sentences)

Word groups:
{chr(10).join(f'Group {i+1}: {", ".join(w["lemma"] for w in g["words"])}' for i, g in enumerate(groups_data))}

Return a JSON array of sentences, one per group:
["sentence1", "sentence2", ...]"""
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json={
                    "model": settings.OPENAI_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7,
                    "response_format": {"type": "json_object"},
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            
            content = data["choices"][0]["message"]["content"]
            sentences = json.loads(content)
            if isinstance(sentences, dict):
                sentences = list(sentences.values())[0] if sentences else []
            return sentences
    
    @staticmethod
    async def evaluate_translation(
        sentence: str, 
        user_translation: str, 
        target_words: list,
        native_lang: str
    ) -> dict:
        """Оценивает перевод через OpenAI API"""
        import httpx
        
        target_words_str = "\n".join(
            f'- {w["lemma"]} (pos: {w["pos"]})' for w in target_words
        )
        
        prompt = f"""Evaluate the user's translation focusing ONLY on these target words:

{target_words_str}

Sentence (target language): "{sentence}"
User's translation ({native_lang}): "{user_translation}"

Instructions:
1. Check if each target word is correctly translated
2. Apply typo-tolerance: if the user made an obvious typo (1-2 letters off), mark as correct with has_typo=true
3. Ignore accuracy of non-target words if overall meaning is preserved

Return JSON:
{{
    "word_results": [
        {{"word_id": "...", "lemma": "...", "is_correct": true/false, "has_typo": true/false}}
    ],
    "suggested_new_words": ["word1", "word2"],
    "overall_correct": true/false
}}"""
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json={
                    "model": settings.OPENAI_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"},
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)


# Выбрать LLM сервис
LLMService = MockLLMService if settings.USE_MOCK_LLM else RealLLMService


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
        
        # Generate sentences via LLM
        sentences = await LLMService.generate_sentences(word_groups, profile.target_lang)
        
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
