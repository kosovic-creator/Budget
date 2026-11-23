import { Suspense } from "react";
import { connection } from "next/server";
import { emptyBudget } from "@/lib/budget";
import Dashboard from "@/components/dashboard";
import { prisma } from "@/lib/prisma";
import { serializeTransaction } from "@/lib/transactions";

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DatabaseDashboard />
    </Suspense>
  );
}

async function DatabaseDashboard() {
  await connection();

  try {
    const records = await prisma.transaction.findMany({
      orderBy: { date: "desc" },
    });

    const saved = await prisma.budgetSettings.findUnique({ where: { id: "default" } });
    const budget = saved ? { household: Number(saved.household), personal: Number(saved.personal), other: Number(saved.other), cash: Number(saved.cash) } : emptyBudget;
    return <Dashboard initialTransactions={records.map(serializeTransaction)} initialBudget={budget} />;
  } catch (error) {
    console.error("Neuspješno učitavanje transakcija iz Neon baze.", error);
    throw new Error("Transakcije trenutno nije moguće učitati iz baze.");
  }
}

function DashboardFallback() {
  return (
    <main className="min-h-screen bg-[#f4f5f7] px-4 py-5">
      <div className="mx-auto max-w-[1440px] animate-pulse space-y-4">
        <div className="h-10 w-36 rounded-lg bg-white" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 rounded-xl bg-white" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-white" />
        <div className="h-56 rounded-xl bg-white" />
      </div>
    </main>
  );
}
