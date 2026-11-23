"use client";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f5f7] px-5 text-center text-[#202124]">
      <div className="max-w-sm">
        <h1 className="text-xl font-bold">Podaci trenutno nisu dostupni</h1>
        <p className="mt-2 text-sm text-[#777b82]">
          Provjerite Neon konekciju i pokušajte ponovo.
        </p>
        <button
          onClick={reset}
          className="mt-5 h-10 rounded-lg bg-[#202124] px-4 text-sm font-semibold text-white"
        >
          Pokušaj ponovo
        </button>
      </div>
    </main>
  );
}
