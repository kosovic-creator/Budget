"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Home,
  Landmark,
  LayoutGrid,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Target,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import { createTransaction } from "@/app/actions";
import type {
  NewTransaction,
  Transaction,
  TransactionCategory,
} from "@/lib/transactions";

function cn(...classes: Array<string | false | null | undefined>) {
  return twMerge(clsx(classes));
}

function isTransactionCategory(value: FormDataEntryValue | null): value is TransactionCategory {
  return (
    value === "Kućni troškovi" ||
    value === "Lični troškovi" ||
    value === "Plata" ||
    value === "Ostalo"
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("sr-RS", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
}

interface DashboardProps {
  initialTransactions: Transaction[];
}

export default function Dashboard({ initialTransactions }: DashboardProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [activeFilter, setActiveFilter] = useState("Sve");
  const [activeNav, setActiveNav] = useState("Pregled");
  const [search, setSearch] = useState("");

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesFilter =
        activeFilter === "Sve" ||
        (activeFilter === "Prilivi" && transaction.type === "income") ||
        (activeFilter === "Odlivi" && transaction.type === "expense");
      const matchesSearch = transaction.title.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, search, transactions]);

  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const expenses = Math.abs(
    transactions
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0),
  );

  async function addTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const typeValue = form.get("type");
    const title = String(form.get("title") ?? "").trim();
    const categoryValue = form.get("category");
    const amount = Number(form.get("amount"));
    if (
      !title ||
      !amount ||
      (typeValue !== "income" && typeValue !== "expense") ||
      !isTransactionCategory(categoryValue)
    ) {
      setFormError("Provjerite naziv, kategoriju i iznos transakcije.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    const input: NewTransaction = {
      title,
      category: categoryValue,
      amount,
      type: typeValue,
    };
    try {
      const result = await createTransaction(input);
      if (result.success) {
        setTransactions((current) => [result.transaction, ...current]);
        setIsModalOpen(false);
      } else {
        setFormError(result.message);
      }
    } catch (error) {
      console.error("Neuspješan poziv za čuvanje transakcije.", error);
      setFormError("Došlo je do greške pri čuvanju. Pokušajte ponovo.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-[#202124]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-[#e7e8ea] bg-white lg:flex">
        <div className="flex h-[76px] items-center px-7">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#202124] text-white">
              <WalletCards size={18} strokeWidth={2.2} />
            </div>
            <span className="text-[19px] font-bold tracking-tight">Finanse</span>
          </div>
        </div>

        <nav className="mt-3 flex-1 space-y-1 px-4">
          {[
            { label: "Pregled", icon: LayoutGrid, active: true },
            { label: "Transakcije", icon: ReceiptText, active: false },
            { label: "Planovi", icon: Target, active: false },
            { label: "Izvještaji", icon: TrendingUp, active: false },
          ].map((item) => (
            <button
              key={item.label}
              className={cn(
                "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition",
                item.active ? "bg-[#eef0f2] text-[#202124]" : "text-[#777b82] hover:bg-[#f5f6f7]",
              )}
            >
              <item.icon size={18} strokeWidth={1.8} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-4 pb-5">
          <div className="mb-2 space-y-1">
            <button className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-[14px] font-medium text-[#777b82] hover:bg-[#f5f6f7]">
              <CircleHelp size={18} strokeWidth={1.8} /> Pomoć
            </button>
            <button className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-[14px] font-medium text-[#777b82] hover:bg-[#f5f6f7]">
              <Settings size={18} strokeWidth={1.8} /> Podešavanja
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3 border-t border-[#eff0f1] px-2 pt-5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#dfe5df] text-xs font-bold">MA</div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">Marko Anić</p>
              <p className="truncate text-[11px] text-[#9b9da1]">marko@example.com</p>
            </div>
            <ChevronRight size={16} className="ml-auto text-[#aaa]" />
          </div>
        </div>
      </aside>

      <main className="pb-[calc(82px+env(safe-area-inset-bottom))] lg:ml-[232px] lg:pb-0">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#e7e8ea] bg-white/95 px-4 backdrop-blur-md md:h-[76px] md:px-8 lg:static lg:px-10">
          <div>
            <p className="text-[11px] font-medium text-[#9a9da2] md:text-[12px]">Novembar 2026.</p>
            <h1 className="text-[18px] font-bold tracking-tight md:text-[20px]">Pregled</h1>
          </div>
          <div className="flex items-center gap-2">
            <button aria-label="Obavještenja" className="grid h-10 w-10 place-items-center rounded-full border border-[#e6e7e9] text-[#6f7378]">
              <Bell size={17} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="ml-1 flex h-10 w-10 items-center justify-center gap-2 rounded-lg bg-[#202124] text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#34363a] sm:w-auto sm:px-4"
            >
              <Plus size={18} /> <span className="hidden sm:inline">Nova transakcija</span>
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-5 md:px-8 md:py-7 lg:px-10">
          <section id="overview" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
            <SummaryCard title="Ukupno stanje" value={`${formatMoney(income - expenses)} €`} icon={<WalletCards size={18} />} tone="dark" trend="+8.4%" />
            <SummaryCard title="Planirani prilivi" value={`${formatMoney(income)} €`} icon={<ArrowDownLeft size={18} />} trend="+12.1%" />
            <SummaryCard title="Planirani troškovi" value={`${formatMoney(expenses)} €`} icon={<ArrowUpRight size={18} />} trend="-3.2%" />
            <SummaryCard title="Keš" value={`${formatMoney(income - expenses)} €`} icon={<Landmark size={18} />} trend="+5.7%" />
          </section>

          <section className="mt-3 grid scroll-mt-20 gap-3 md:mt-4 md:gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(290px,.75fr)]">
            <div id="reports" className="scroll-mt-20 rounded-xl border border-[#e7e8ea] bg-white p-4 md:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-[#777b82] md:text-[13px]">Novčani tok</p>
                  <div className="mt-1 flex items-end gap-2">
                    <h2 className="text-[21px] font-bold tracking-tight md:text-[26px]">{formatMoney(income - expenses)} €</h2>
                    <span className="mb-1 rounded-full bg-[#edf5ef] px-2 py-1 text-[10px] font-bold text-[#4a8058]">+8.4%</span>
                  </div>
                </div>
                <button className="flex h-8 items-center gap-1 rounded-lg border border-[#e5e6e8] px-2 text-[10px] font-semibold text-[#686b70] md:h-9 md:gap-2 md:px-3 md:text-[12px]">
                  6 mjeseci <ChevronDown size={14} />
                </button>
              </div>

              <div className="mt-4 h-[150px] sm:h-[190px] md:mt-6 md:h-[220px]">
                <svg viewBox="0 0 700 220" className="h-full w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label="Grafikon novčanog toka">
                  {[35, 80, 125, 170].map((y) => (
                    <line key={y} x1="0" y1={y} x2="700" y2={y} stroke="#edf0f2" strokeWidth="1" />
                  ))}
                  <defs>
                    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a9b9ad" stopOpacity=".42" />
                      <stop offset="100%" stopColor="#a9b9ad" stopOpacity=".02" />
                    </linearGradient>
                  </defs>
                  <path d="M0 168 C55 158 73 118 125 128 C175 138 198 92 245 102 C292 112 315 66 365 78 C420 92 448 120 492 92 C535 65 578 82 618 50 C650 24 674 34 700 25 L700 220 L0 220 Z" fill="url(#area)" />
                  <path d="M0 168 C55 158 73 118 125 128 C175 138 198 92 245 102 C292 112 315 66 365 78 C420 92 448 120 492 92 C535 65 578 82 618 50 C650 24 674 34 700 25" fill="none" stroke="#667a6c" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="618" cy="50" r="5" fill="#fff" stroke="#667a6c" strokeWidth="3" />
                </svg>
              </div>
              <div className="-mt-1 flex justify-between text-[10px] font-medium text-[#adb0b4]">
                {["Jun", "Jul", "Avg", "Sep", "Okt", "Nov"].map((month) => <span key={month}>{month}</span>)}
              </div>
            </div>

            <div id="plans" className="scroll-mt-20 rounded-xl border border-[#e7e8ea] bg-white p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-[#777b82]">Planirani troškovi</p>
                  <p className="mt-1 text-[11px] text-[#a2a4a8]">Od ukupnog plana</p>
                </div>
                <button className="grid h-8 w-8 place-items-center rounded-lg border border-[#e5e6e8] text-[#777b82]"><ChevronRight size={14} /></button>
              </div>
              <div className="mt-4 space-y-4 md:mt-5 md:space-y-5">
                <BudgetRow label="Kućni troškovi" spent="1.420 €" total="2.000 €" percent={71} color="#7e927f" />
                <BudgetRow label="Lični troškovi" spent="680 €" total="1.200 €" percent={57} color="#b9a578" />
                <BudgetRow label="Ostalo" spent="340 €" total="800 €" percent={43} color="#8993a3" />
              </div>
            </div>
          </section>

          <section id="transactions" className="mt-3 scroll-mt-20 rounded-xl border border-[#e7e8ea] bg-white md:mt-4">
            <div className="flex flex-col gap-3 border-b border-[#eceeef] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
              <h2 className="text-[15px] font-bold">Posljednje transakcije</h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex w-full rounded-lg bg-[#f4f5f6] p-1 sm:w-auto">
                  {["Sve", "Prilivi", "Odlivovi"].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={cn(
                        "h-8 flex-1 rounded-md px-3 text-[11px] font-semibold sm:flex-none",
                        filter === activeFilter
                          ? "bg-white text-[#34363a] shadow-sm"
                          : "text-[#96999d]",
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-40">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" size={14} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Pretraži"
                    className="h-10 w-full rounded-lg border border-[#e5e6e8] pl-8 pr-3 text-[12px] outline-none focus:border-[#adb5ae] sm:h-9"
                  />
                </div>
              </div>
            </div>
            <div className="divide-y divide-[#f0f1f2]">
              {filteredTransactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </div>
          </section>
        </div>
      </main>

      <nav aria-label="Glavna navigacija" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#e7e8ea] bg-white/95 px-2 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        {[
          { label: "Pregled", href: "#overview", icon: Home },
          { label: "Planovi", href: "#plans", icon: Target },
          { label: "Transakcije", href: "#transactions", icon: ReceiptText },
          { label: "Izvještaji", href: "#reports", icon: TrendingUp },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            onClick={() => setActiveNav(item.label)}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-semibold",
              activeNav === item.label ? "text-[#202124]" : "text-[#92969b]",
            )}
          >
            <item.icon size={19} strokeWidth={activeNav === item.label ? 2.2 : 1.8} />
            {item.label}
          </a>
        ))}
      </nav>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#202124]/25 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
          <form onSubmit={addTransaction} className="max-h-[calc(100dvh-24px)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/70 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999da1]">Nova stavka</p>
                <h2 className="text-[20px] font-bold">Dodaj transakciju</h2>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-[#f2f3f4] text-[#777b82]">
                <X size={16} />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-[#f3f4f5] p-1">
              <label className="cursor-pointer">
                <input type="radio" name="type" value="expense" defaultChecked className="peer sr-only" />
                <span className="flex h-9 items-center justify-center rounded-lg text-[12px] font-bold text-[#83878c] peer-checked:bg-white peer-checked:text-[#34363a] peer-checked:shadow-sm">Odliv</span>
              </label>
              <label className="cursor-pointer">
                <input type="radio" name="type" value="income" className="peer sr-only" />
                <span className="flex h-9 items-center justify-center rounded-lg text-[12px] font-bold text-[#83878c] peer-checked:bg-white peer-checked:text-[#34363a] peer-checked:shadow-sm">Priliv</span>
              </label>
            </div>
            <label className="mt-4 block text-[12px] font-semibold text-[#686b70]">
              Naziv
              <input name="title" required placeholder="npr. Kupovina namirnica" className="mt-2 h-11 w-full rounded-lg border border-[#e2e4e6] px-3 text-[14px] outline-none focus:border-[#9fa9a1]" />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-[12px] font-semibold text-[#686b70]">
                Iznos (€)
                <input name="amount" required type="number" min="0.01" step="0.01" placeholder="0.00" className="mt-2 h-11 w-full rounded-lg border border-[#e2e4e6] px-3 text-[14px] outline-none focus:border-[#9fa9a1]" />
              </label>
              <label className="text-[12px] font-semibold text-[#686b70]">
                Kategorija
                <select name="category" className="mt-2 h-11 w-full rounded-lg border border-[#e2e4e6] px-3 text-[13px] outline-none focus:border-[#9fa9a1]">
                  <option>Kućni troškovi</option>
                  <option>Lični troškovi</option>
                  <option>Plata</option>
                  <option>Ostalo</option>
                </select>
              </label>
            </div>
            <button type="submit" disabled={isSaving} className="mt-6 h-11 w-full rounded-lg bg-[#202124] text-[13px] font-bold text-white hover:bg-[#34363a] disabled:cursor-not-allowed disabled:opacity-60">
              {isSaving ? "Čuvanje..." : "Sačuvaj transakciju"}
            </button>
            {formError && (
              <p role="alert" className="mt-3 text-center text-[12px] font-medium text-red-600">
                {formError}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  tone?: "dark";
  trend: string;
}

function SummaryCard({ title, value, icon, tone, trend }: SummaryCardProps) {
  return (
    <div className={cn("min-h-[112px] min-w-0 rounded-xl border p-3.5 sm:min-h-[132px] sm:p-5", tone === "dark" ? "border-[#202124] bg-[#202124] text-white" : "border-[#e7e8ea] bg-white")}>
      <div className="flex items-center justify-between">
        <p className={cn("text-[10px] font-semibold leading-tight sm:text-[12px]", tone === "dark" ? "text-[#c8cbd0]" : "text-[#85888d]")}>{title}</p>
        <div className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg sm:h-8 sm:w-8", tone === "dark" ? "bg-white/10 text-white" : "bg-[#f2f3f4] text-[#777b82]")}>{icon}</div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-1 sm:mt-5">
        <p className="truncate text-[17px] font-bold tracking-tight sm:text-[23px]">{value}</p>
        <span className={cn("mb-0.5 shrink-0 text-[9px] font-bold sm:mb-1 sm:text-[10px]", tone === "dark" ? "text-[#bfc9c1]" : "text-[#72917a]")}>{trend}</span>
      </div>
    </div>
  );
}

interface BudgetRowProps {
  label: string;
  spent: string;
  total: string;
  percent: number;
  color: string;
}

function BudgetRow({ label, spent, total, percent, color }: BudgetRowProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-semibold">{label}</p>
        <p className="text-[11px] text-[#9a9da1]"><span className="font-bold text-[#4d5054]">{spent}</span> / {total}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#eff1f2]">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

interface TransactionRowProps {
  transaction: Transaction;
}

function TransactionRow({ transaction }: TransactionRowProps) {
  const isIncome = transaction.type === "income";
  return (
    <div className="flex items-center px-4 py-3.5 md:px-6">
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full sm:h-10 sm:w-10", isIncome ? "bg-[#edf4ef] text-[#66816d]" : "bg-[#f1f2f3] text-[#777b82]")}>
        {isIncome ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
      </div>
      <div className="ml-3 min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold sm:text-[13px]">{transaction.title}</p>
        <p className="mt-0.5 truncate text-[9px] text-[#9da0a4] sm:text-[10px]">{transaction.category} · {transaction.date}</p>
      </div>
      <p className={cn("ml-2 shrink-0 text-[11px] font-bold sm:ml-3 sm:text-[13px]", isIncome ? "text-[#66816d]" : "text-[#34363a]")}>
        {isIncome ? "+" : "-"}{formatMoney(transaction.amount)} €
      </p>
    </div>
  );
}
