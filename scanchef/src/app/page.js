// app/page.js
import SnapChef from '@/components/snapchef';

export const metadata = {
  title: 'SnapChef - Scan Your Ingredients',
  description: 'Turn your fridge contents into delicious recipes',
};

export default function Home() {
  return (
    <main className="min-h-screen">
      <SnapChef />
    </main>
  );
}