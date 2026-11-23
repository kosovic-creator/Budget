import { Suspense } from "react";
import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { emptyBudget } from "@/lib/budget";
import Dashboard from "@/components/dashboard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeTransaction } from "@/lib/transactions";
import type { PlannedItem } from "@/lib/planned-items";
import type { RecurringItem } from "@/lib/recurring-items";
import type { BankAccount } from "@/lib/bank";

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DatabaseDashboard />
    </Suspense>
  );
}

async function DatabaseDashboard() {
  await connection();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const { transactions, budget, plannedItems, recurringItems, bankAccounts } = await loadDashboardData();
  return <Dashboard initialTransactions={transactions} initialBudget={budget} initialPlannedItems={plannedItems} initialRecurringItems={recurringItems} initialBankAccounts={bankAccounts} userName={session.user.name} />;
}

async function loadDashboardData() {
  try {
    const [records, saved, savedPlannedItems, savedRecurringItems, savedBankAccounts] = await Promise.all([
      prisma.transaction.findMany({ orderBy: { date: "desc" } }),
      prisma.budgetSettings.findUnique({ where: { id: "default" } }),
      prisma.plannedItem.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.recurringItem.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.bankAccount.findMany({ include: { deductions: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } }),
    ]);
    const numberOrZero = (value: unknown) => {
      const number = Number(value ?? 0);
      return Number.isFinite(number) ? number : 0;
    };
    const budget = saved ? {
      household: numberOrZero(saved.household),
      personal: numberOrZero(saved.personal),
      other: numberOrZero(saved.other),
      cash: numberOrZero(saved.cash),
      otp: numberOrZero(saved.otp),
      nlb: numberOrZero(saved.nlb),
      additions: numberOrZero(saved.additions),
      expectedExpenses: numberOrZero(saved.expectedExpenses),
    } : emptyBudget;
    const plannedItems: PlannedItem[] = savedPlannedItems.map((item) => ({
      id: item.id,
      description: item.description,
      amount: Number(item.amount),
      kind: item.kind === "ADDITION" ? "addition" : "expectedExpense",
    }));
    const recurringItems: RecurringItem[] = savedRecurringItems.map((item) => ({
      id: item.id,
      name: item.name,
      amount: Number(item.amount),
      kind: item.kind === "FIXED" ? "fixed" : "subscription",
    }));
    const bankAccounts: BankAccount[] = savedBankAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      amount: Number(account.amount),
      note: account.note,
      deductions: account.deductions.map((deduction) => ({ id: deduction.id, description: deduction.description, amount: Number(deduction.amount) })),
    }));
    return { transactions: records.map(serializeTransaction), budget, plannedItems, recurringItems, bankAccounts };
  } catch (error) {
    console.error("Neuspješno učitavanje transakcija iz Neon baze.", error);
    throw new Error("Transakcije trenutno nije moguće učitati iz baze.");
  }
}

function DashboardFallback() {
  return (
    <main className="min-h-screen bg-[#f6f7f8] px-4 py-5">
      <div className="mx-auto max-w-[1440px] animate-pulse space-y-4">
        <div className="h-10 w-36 rounded-lg bg-white" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 rounded-2xl bg-white shadow-[0_2px_12px_rgba(24,24,27,0.04)]" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-white shadow-[0_2px_12px_rgba(24,24,27,0.04)]" />
        <div className="h-56 rounded-2xl bg-white shadow-[0_2px_12px_rgba(24,24,27,0.04)]" />
      </div>
    </main>
  );
}
