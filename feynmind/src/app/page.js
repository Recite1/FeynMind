// app/page.js
import SnapChef from '@/components/feynmind';

export const metadata = {
  title: 'Feynmind - Your AI Study Companion',
  description: 'Feynmind is an AI-powered study companion that helps you learn and understand complex topics through interactive flashcards and personalized study plans.',
};

export default function Home() {
  return (
    <main className="min-h-screen">
      <SnapChef />
    </main>
  );
}