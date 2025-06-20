import CourseCard from './CourseCard';
import EmptyState from './EmptyState';

export default function CourseList({ courses }) {
  if (!courses || courses.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {courses.map((course) => (
        <CourseCard key={course._id || course.id} course={course} />
      ))}
    </div>
  );
} 