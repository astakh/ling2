from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, 
    UniqueConstraint, Index, func
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    native_lang = Column(String(10), nullable=False)
    timezone = Column(String(50), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    
    profiles = relationship("UserLanguageProfile", back_populates="user")
    lessons = relationship("Lesson", back_populates="user")
    stats = relationship("UserStats", back_populates="user", uselist=False)


class UserLanguageProfile(Base):
    __tablename__ = "user_language_profiles"
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    target_lang = Column(String(10), nullable=False)
    cefr_level = Column(String(5), nullable=False)
    current_lesson_number = Column(Integer, default=0)
    words_per_lesson_limit = Column(Integer, default=5)
    daily_lesson_limit = Column(Integer, default=3)
    created_at = Column(DateTime, server_default=func.now())
    
    user = relationship("User", back_populates="profiles")
    user_words = relationship("UserWord", back_populates="profile")
    lessons = relationship("Lesson", back_populates="profile")
    
    __table_args__ = (
        UniqueConstraint("user_id", "target_lang", name="uq_user_target_lang"),
    )


class UserStats(Base):
    __tablename__ = "user_stats"
    
    user_id = Column(String(36), ForeignKey("users.id"), primary_key=True)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_lesson_date = Column(DateTime, nullable=True)
    total_words_learned = Column(Integer, default=0)
    total_lessons_completed = Column(Integer, default=0)
    
    user = relationship("User", back_populates="stats")


class Dictionary(Base):
    __tablename__ = "dictionaries"
    
    id = Column(String(36), primary_key=True)
    target_lang = Column(String(10), nullable=False, index=True)
    lemma = Column(String(100), nullable=False)
    pos = Column(String(20), nullable=False)
    cefr_level = Column(String(5), nullable=False)
    
    translations = relationship("DictionaryTranslation", back_populates="dictionary")
    
    __table_args__ = (
        UniqueConstraint("lemma", "pos", "target_lang", name="uq_dict_lemma_pos_lang"),
        Index("ix_dict_lang_level", "target_lang", "cefr_level"),
    )


class DictionaryTranslation(Base):
    __tablename__ = "dictionary_translations"
    
    id = Column(String(36), primary_key=True)
    dictionary_id = Column(String(36), ForeignKey("dictionaries.id"), nullable=False)
    lang = Column(String(10), nullable=False)
    translations = Column(JSONB, nullable=False)  # Array of translations
    
    dictionary = relationship("Dictionary", back_populates="translations")
    
    __table_args__ = (
        UniqueConstraint("dictionary_id", "lang", name="uq_dict_trans_lang"),
    )


class UserWord(Base):
    __tablename__ = "user_words"
    
    id = Column(String(36), primary_key=True)
    user_language_profile_id = Column(String(36), ForeignKey("user_language_profiles.id"), nullable=False)
    dictionary_id = Column(String(36), ForeignKey("dictionaries.id"), nullable=False)
    stage = Column(Integer, default=0)
    due_lesson_number = Column(Integer, default=1)
    status = Column(String(20), default="active")  # active, ignored, learned
    correct_count = Column(Integer, default=0)
    incorrect_count = Column(Integer, default=0)
    context_exercise_id = Column(String(36), nullable=True)
    
    profile = relationship("UserLanguageProfile", back_populates="user_words")
    dictionary = relationship("Dictionary")
    
    __table_args__ = (
        UniqueConstraint("user_language_profile_id", "dictionary_id", name="uq_user_word"),
        Index("ix_user_word_due", "user_language_profile_id", "due_lesson_number"),
    )


class Lesson(Base):
    __tablename__ = "lessons"
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    user_language_profile_id = Column(String(36), ForeignKey("user_language_profiles.id"), nullable=False)
    lesson_number = Column(Integer, nullable=False)
    started_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="in_progress")  # in_progress, completed
    total_words = Column(Integer, default=0)
    correct_words = Column(Integer, default=0)
    new_words_added = Column(Integer, default=0)
    
    user = relationship("User", back_populates="lessons")
    profile = relationship("UserLanguageProfile", back_populates="lessons")
    exercises = relationship("LessonExercise", back_populates="lesson", order_by="LessonExercise.order_index")
    
    __table_args__ = (
        Index("ix_lesson_user_status", "user_id", "status"),
    )


class LessonExercise(Base):
    __tablename__ = "lesson_exercises"
    
    id = Column(String(36), primary_key=True)
    lesson_id = Column(String(36), ForeignKey("lessons.id"), nullable=False)
    order_index = Column(Integer, nullable=False)
    target_sentence = Column(Text, nullable=False)
    target_word_ids = Column(JSONB, nullable=False)  # Array of dictionary IDs
    user_translation = Column(Text, nullable=True)
    llm_response_json = Column(JSONB, nullable=True)
    status = Column(String(20), default="pending")  # pending, completed
    
    lesson = relationship("Lesson", back_populates="exercises")
    
    __table_args__ = (
        UniqueConstraint("lesson_id", "order_index", name="uq_exercise_order"),
    )


class LLMCallLog(Base):
    __tablename__ = "llm_call_logs"
    
    id = Column(String(36), primary_key=True)
    lesson_exercise_id = Column(String(36), ForeignKey("lesson_exercises.id"), nullable=True)
    prompt_type = Column(String(50), nullable=False)  # generate_sentence, evaluate_translation
    prompt_version = Column(String(20), nullable=False)
    model = Column(String(50), nullable=False)
    input_tokens = Column(Integer, nullable=False)
    output_tokens = Column(Integer, nullable=False)
    latency_ms = Column(Integer, nullable=False)
    cost = Column(Integer, default=0)  # in cents
    created_at = Column(DateTime, server_default=func.now())
