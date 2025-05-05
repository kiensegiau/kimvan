import YoutubeScheduler from '../../../components/YoutubeScheduler';

export default function CourseSchedulePage({ params }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Lên lịch tải video khóa học lên YouTube</h1>
      <YoutubeScheduler courseId={params.id} />
    </div>
  );
} 