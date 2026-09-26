import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function LessonReview() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect to lesson page (review is integrated into Lesson.tsx now)
    navigate('/lesson');
  }, []);
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Перенаправление...</p>
    </div>
  );
}
