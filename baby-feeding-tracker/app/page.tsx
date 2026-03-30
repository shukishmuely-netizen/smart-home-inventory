export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <h1 className="text-4xl font-bold text-[#6B8CAE] mb-4">
        🍼 מעקב האכלות תינוק
      </h1>
      <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-orange-100">
        <p className="text-xl text-gray-600">
          ברוכים הבאים! האפליקציה מחוברת ל-Supabase.
        </p>
        <p className="mt-2 text-gray-400">
          השלב הבא: בניית כפתורי ההפעלה והטיימר.
        </p>
      </div>
    </main>
  );
}