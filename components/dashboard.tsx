"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  ChevronRight,
  Fingerprint,
  Home,
  Landmark,
  LayoutGrid,
  Plus,
  Search,
  Target,
  WalletCards,
  LogOut,
  X,
  Trash2,
  CreditCard,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import { createPlannedItem, createTransaction, deletePlannedItem, deleteTransaction, saveBudget } from "@/app/actions";
import type {
  NewTransaction,
  Transaction,
  TransactionCategory,
} from "@/lib/transactions";

import type { BudgetSettings } from "@/lib/budget";
import { authClient } from "@/lib/auth-client";
import type { PlannedItem, PlannedItemKind } from "@/lib/planned-items";
import type { RecurringItem } from "@/lib/recurring-items";
import MonthlyExpenses from "@/components/monthly-expenses";
import BankAccounts from "@/components/bank-accounts";
import type { BankAccount } from "@/lib/bank";

function cn(...classes: Array<string | false | null | undefined>) {
  return twMerge(clsx(classes));
}

function isTransactionCategory(value: FormDataEntryValue | null): value is TransactionCategory {
  return (
    value === "Kućni troškovi" ||
    value === "Lični troškovi" ||
    value === "Redovni troškovi" ||
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
  initialBudget: BudgetSettings;
  initialPlannedItems: PlannedItem[];
  initialRecurringItems: RecurringItem[];
  initialBankAccounts: BankAccount[];
  userName: string;
}

export default function Dashboard({ initialTransactions, initialBudget, initialPlannedItems, initialRecurringItems, initialBankAccounts, userName }: DashboardProps) {
  const router = useRouter();
  const currentPeriod = new Intl.DateTimeFormat("sr-Latn-ME", { month: "long", year: "numeric" }).format(new Date());
  const userInitials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((name) => name[0]).join("").toUpperCase() || "JA";
  const [budget, setBudget] = useState(initialBudget);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetMessage, setBudgetMessage] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [isAddingPasskey, setIsAddingPasskey] = useState(false);

  async function addPasskey() {
    setIsAddingPasskey(true);
    setSecurityMessage("");

    if (!("PublicKeyCredential" in window)) {
      setSecurityMessage("Ovaj preglednik ne podržava Face ID/passkey.");
      setIsAddingPasskey(false);
      return;
    }

    const result = await authClient.passkey.addPasskey({
      name: /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "iPhone Face ID" : "Passkey ovog uređaja",
      authenticatorAttachment: "platform",
    });

    setSecurityMessage(result.error ? (result.error.message ?? "Zaštita uređaja nije dodata.") : "Ovaj uređaj je uspješno dodat za sigurnu prijavu.");
    setIsAddingPasskey(false);
  }

  async function submitBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = {
      household: Number(form.get("household")),
      personal: Number(form.get("personal")),
      other: 0,
      cash: Number(form.get("cash")),
      otp: Number(form.get("otp")),
      nlb: Number(form.get("nlb")),
      additions: Number(form.get("additions")),
      expectedExpenses: Number(form.get("expectedExpenses")),
    };
    setBudgetSaving(true); setBudgetMessage("");
    try {
      const result = await saveBudget(next);
      if (result.success) { setBudget(next); setEditingBudget(false); setBudgetMessage("Stanje i plan su sačuvani."); }
      else setBudgetMessage(result.message);
    } catch { setBudgetMessage("Podaci nijesu sačuvani. Pokušajte ponovo."); }
    finally { setBudgetSaving(false); }
  }
  const [transactions, setTransactions] = useState(initialTransactions);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newTransactionType, setNewTransactionType] = useState<"income" | "expense">("expense");
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [plannedItems, setPlannedItems] = useState(initialPlannedItems);
  const [recurringItems, setRecurringItems] = useState(initialRecurringItems);
  const [plannedItemForm, setPlannedItemForm] = useState<PlannedItemKind | null>(null);
  const [plannedItemSaving, setPlannedItemSaving] = useState(false);
  const [plannedItemMessage, setPlannedItemMessage] = useState("");
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

  const nlbAvailable = budget.nlb - 1300;
  const additionsTotal = plannedItems.filter((item) => item.kind === "addition").reduce((sum, item) => sum + item.amount, 0);
  const expectedExpensesTotal = plannedItems.filter((item) => item.kind === "expectedExpense").reduce((sum, item) => sum + item.amount, 0);
  const allFixedExpensesTotal = recurringItems.filter((item) => item.kind === "fixed").reduce((sum, item) => sum + item.amount, 0);
  const allSubscriptionsTotal = recurringItems.filter((item) => item.kind === "subscription").reduce((sum, item) => sum + item.amount, 0);
  const fixedExpensesTotal = recurringItems.filter((item) => item.kind === "fixed" && !item.paid).reduce((sum, item) => sum + item.amount, 0);
  const subscriptionsTotal = recurringItems.filter((item) => item.kind === "subscription" && !item.paid).reduce((sum, item) => sum + item.amount, 0);
  const allRegularExpensesTotal = allFixedExpensesTotal + allSubscriptionsTotal;
  const paidRegularExpensesTotal = allRegularExpensesTotal - fixedExpensesTotal - subscriptionsTotal;
  const monthlyExpensesTotal = fixedExpensesTotal + subscriptionsTotal;
  const transactionBalance = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalBalance = budget.otp + nlbAvailable + budget.cash + additionsTotal - expectedExpensesTotal + transactionBalance;
  const availableAfterPlans = totalBalance - monthlyExpensesTotal - budget.household - budget.personal;

  async function addPlannedItem(event: React.FormEvent<HTMLFormElement>, kind: PlannedItemKind) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPlannedItemSaving(true);
    setPlannedItemMessage("");
    const result = await createPlannedItem({
      description: String(form.get("description") ?? ""),
      amount: Number(form.get("amount")),
      kind,
    });
    if (result.success) {
      setPlannedItems((current) => [...current, result.item]);
      setPlannedItemForm(null);
      formElement.reset();
    } else {
      setPlannedItemMessage(result.message);
    }
    setPlannedItemSaving(false);
  }

  async function removePlannedItem(item: PlannedItem) {
    const result = await deletePlannedItem(item.id);
    if (result.success) setPlannedItems((current) => current.filter((entry) => entry.id !== item.id));
    else setPlannedItemMessage(result.message);
  }

  async function removeTransaction(transaction: Transaction) {
    if (!window.confirm(`Ukloniti transakciju „${transaction.title}“?`)) return;

    setDeletingId(transaction.id);
    setFormError("");
    try {
      const result = await deleteTransaction(transaction.id);
      if (result.success) {
        setTransactions((current) => current.filter((item) => item.id !== transaction.id));
      } else {
        setFormError(result.message);
      }
    } catch {
      setFormError("Transakcija nije uklonjena. Pokušajte ponovo.");
    } finally {
      setDeletingId(null);
    }
  }

  async function addTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const typeValue = form.get("type");
    const title = String(form.get("title") ?? "").trim();
    const categoryValue = newTransactionType === "income" ? "Plata" : form.get("category");
    const amount = Number(form.get("amount"));
    if (
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
    <div className="min-h-screen bg-[#f6f7f8] text-[#18181b]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-zinc-200/80 bg-white lg:flex">
        <div className="flex h-[76px] items-center px-7">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-900 text-white shadow-lg shadow-zinc-900/15">
              <WalletCards size={18} strokeWidth={2.2} />
            </div>
            <span className="text-[19px] font-bold tracking-tight text-zinc-900">Stanje</span>
          </div>
        </div>

        <nav className="mt-3 flex-1 space-y-1 px-4">
          {[
            { label: "Pregled", icon: LayoutGrid },
            { label: "Mjesečni troškovi", icon: Target },
            { label: "Pretplate", icon: CreditCard },
            { label: "Banka", icon: Landmark },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveNav(item.label)}
              className={cn(
                "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[14px] font-semibold transition active:scale-[0.98]",
                activeNav === item.label ? "bg-emerald-50 text-emerald-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900",
              )}
            >
              <item.icon size={18} strokeWidth={1.8} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-4 pb-5">
          <div className="mt-4 flex items-center gap-3 border-t border-zinc-100 px-2 pt-5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-900">{userInitials}</div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{userName}</p>
              <button onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { router.replace("/sign-in"); router.refresh(); } } })} className="mt-0.5 flex items-center gap-1 text-[11px] text-[#9b9da1] hover:text-[#555]">
                <LogOut size={11} /> Odjavi se
              </button>
            </div>
            <ChevronRight size={16} className="ml-auto text-[#aaa]" />
          </div>
        </div>
      </aside>

      <main className="pb-[calc(88px+env(safe-area-inset-bottom))] lg:ml-[240px] lg:pb-0">
        <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between border-b border-zinc-200/80 bg-white/85 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-xl md:h-[76px] md:px-8 md:py-0 lg:static lg:px-10">
          <div>
            <p className="capitalize text-[11px] font-semibold text-zinc-400 md:text-[12px]">{currentPeriod}</p>
            <h1 className="text-[19px] font-bold tracking-tight text-zinc-900 md:text-[21px]">{activeNav}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={addPasskey} disabled={isAddingPasskey} aria-label="Dodaj ovaj uređaj za sigurnu prijavu" title="Zaštiti ovaj uređaj" className="grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition active:scale-95 disabled:opacity-50">
              <Fingerprint size={18} />
            </button>
            <button aria-label="Obavještenja" className="hidden h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition active:scale-95 min-[380px]:grid">
              <Bell size={17} />
            </button>
            <button onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { router.replace("/sign-in"); router.refresh(); } } })} aria-label="Odjavi se" title={`Odjavi se (${userName})`} className="grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition active:scale-95 lg:hidden">
              <span className="text-[11px] font-bold">{userInitials}</span>
            </button>
            <button
              onClick={() => { setNewTransactionType("expense"); setFormError(""); setIsModalOpen(true); }}
              className="ml-1 flex h-11 w-11 items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-[13px] font-bold text-white shadow-lg shadow-zinc-900/15 transition hover:bg-zinc-800 active:scale-95 sm:w-auto sm:px-4"
            >
              <Plus size={18} /> <span className="hidden sm:inline">Nova transakcija</span>
            </button>
          </div>
        </header>

        {securityMessage && (
          <div role="status" className="fixed right-4 top-20 z-40 max-w-xs rounded-xl bg-[#202124] px-4 py-3 text-sm font-medium text-white shadow-lg md:right-8">
            {securityMessage}
          </div>
        )}

        {activeNav === "Pregled" ? (
          <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-5 md:px-8 md:py-7 lg:px-10">
          <section id="overview" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
            <SummaryCard featured title="Ukupno stanje" value={`${totalBalance < 0 ? "−" : ""}${formatMoney(totalBalance)} €`} icon={<WalletCards size={18} />} tone="dark" trend="Nakon očekivanih troškova" />
            <SummaryCard title="OTP račun" value={`${formatMoney(budget.otp)} €`} icon={<Landmark size={18} />} trend="Stanje na računu" />
            <SummaryCard title="NLB umanjeno" value={`${nlbAvailable < 0 ? "−" : ""}${formatMoney(nlbAvailable)} €`} icon={<Landmark size={18} />} trend="NLB − 1.300 €" />
            <SummaryCard title="Keš" value={`${formatMoney(budget.cash)} €`} icon={<WalletCards size={18} />} trend="Gotovina" />
            <SummaryCard title="Mjesečni troškovi" value={`${formatMoney(monthlyExpensesTotal)} €`} icon={<Target size={18} />} trend={`${formatMoney(fixedExpensesTotal)} € fiksni + ${formatMoney(subscriptionsTotal)} € pretplate`} />
            <SummaryCard title="Dodaci" value={`${formatMoney(additionsTotal)} €`} icon={<ArrowDownLeft size={18} />} trend="Sigurni budući prilivi" />
            <SummaryCard title="Očekivani troškovi" value={`${formatMoney(expectedExpensesTotal)} €`} icon={<ArrowUpRight size={18} />} trend="Oduzeti od ukupnog stanja" />
            <SummaryCard featured title="Slobodno nakon planova" value={`${availableAfterPlans < 0 ? "−" : ""}${formatMoney(availableAfterPlans)} €`} icon={<Target size={18} />} tone={availableAfterPlans < 0 ? "danger" : availableAfterPlans === 0 ? "success" : "info"} trend="Stanje − mjesečni troškovi − kućni i lični limit" />
          </section>

          <section className="mt-3 md:mt-4">
            <div id="plans" className="scroll-mt-20 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_2px_12px_rgba(24,24,27,0.035)] md:p-6">
              <div className="flex flex-col gap-3 min-[390px]:flex-row min-[390px]:items-center min-[390px]:justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-[#777b82]">Mjesečni limiti troškova</p>
                  <p className="mt-1 text-[11px] text-[#a2a4a8]">Za svaku kategoriju vidiš potrošeno, limit i preostali iznos.</p>
                </div>
                <button
                  type={editingBudget ? "submit" : "button"}
                  form={editingBudget ? "budget-settings-form" : undefined}
                  onClick={editingBudget ? undefined : (event) => { event.preventDefault(); setEditingBudget(true); setBudgetMessage(""); }}
                  disabled={budgetSaving}
                  className={cn("min-h-12 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:opacity-60", editingBudget ? "bg-[#31724a] text-white hover:bg-[#285f3e]" : "bg-[#202124] text-white hover:bg-[#34363a]")}
                >
                  {editingBudget ? (budgetSaving ? "Čuvanje..." : "✓ Sačuvaj i završi") : "+ Unos stanja i plana"}
                </button>
              </div>
              <div className="mt-4 space-y-4 md:mt-5 md:space-y-5">
                {([
                  ["Kućni troškovi", budget.household, "#7e927f"],
                  ["Lični troškovi", budget.personal, "#b9a578"],
                ] as const).map(([label, total, color]) => {
                  const spent = Math.abs(transactions.filter(item => item.type === "expense" && item.category === label).reduce((sum, item) => sum + item.amount, 0));
                  return <BudgetRow key={label} label={label} spent={spent} total={total} percent={total > 0 ? Math.min(100, spent / total * 100) : 0} color={color} />;
                })}
                <BudgetRow
                  label="Redovni troškovi"
                  spent={paidRegularExpensesTotal}
                  total={allRegularExpensesTotal}
                  percent={allRegularExpensesTotal > 0 ? Math.min(100, paidRegularExpensesTotal / allRegularExpensesTotal * 100) : 0}
                  color="#4f7ca8"
                />
                {editingBudget && (
                  <>
                  <form id="budget-settings-form" onSubmit={submitBudget} className="grid gap-3 border-t border-[#e7e8ea] pt-4 sm:grid-cols-2">
                    {([
                      ["otp", "Stanje na OTP računu"],
                      ["nlb", "Ukupno stanje na NLB računu"],
                      ["household", "Mjesečni limit za kućne troškove"],
                      ["personal", "Mjesečni limit za lične troškove"],
                      ["cash", "Trenutni iznos keša"],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="text-sm font-bold text-[#555a60]">
                        {label} (€)
                        <input name={key} type="number" required min="0" max="9999999999.99" step="0.01" defaultValue={Number.isFinite(budget[key]) ? budget[key] : 0} disabled={budgetSaving} className="mt-2 h-14 w-full rounded-xl border-2 border-[#cfd3d6] px-4 text-xl font-extrabold tracking-tight outline-none focus:border-[#6f8173]" />
                      </label>
                    ))}
                    <p className="rounded-lg bg-[#f4f5f7] px-3 py-3 text-xs text-[#686b70] sm:col-span-2">NLB raspoloživo se računa automatski: uneseno stanje minus 1.300 €.</p>
                  </form>
                  <div className="grid gap-3 border-t border-[#e7e8ea] pt-4 md:grid-cols-2">
                    <PlannedItemsCard title="Dodaci" subtitle="Sigurni budući prilivi" kind="addition" items={plannedItems} total={additionsTotal} formOpen={plannedItemForm === "addition"} saving={plannedItemSaving} onToggleForm={() => { setPlannedItemForm(plannedItemForm === "addition" ? null : "addition"); setPlannedItemMessage(""); }} onSubmit={addPlannedItem} onDelete={removePlannedItem} />
                    <PlannedItemsCard title="Očekivani troškovi" subtitle="Oduzimaju se od ukupnog stanja" kind="expectedExpense" items={plannedItems} total={expectedExpensesTotal} formOpen={plannedItemForm === "expectedExpense"} saving={plannedItemSaving} onToggleForm={() => { setPlannedItemForm(plannedItemForm === "expectedExpense" ? null : "expectedExpense"); setPlannedItemMessage(""); }} onSubmit={addPlannedItem} onDelete={removePlannedItem} />
                  </div>
                  {plannedItemMessage && <p role="alert" className="rounded-xl bg-[#f7eeee] px-4 py-3 text-sm text-[#9b3d3d]">{plannedItemMessage}</p>}
                  </>
                )}
                {budgetMessage && <p role="status" className="text-sm">{budgetMessage}</p>}
              </div>
            </div>
          </section>

          <section id="transactions" className="mt-3 scroll-mt-20 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_2px_12px_rgba(24,24,27,0.035)] md:mt-4">
            <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
              <h2 className="text-[15px] font-bold">Posljednje transakcije</h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex w-full rounded-xl bg-zinc-100 p-1 sm:w-auto">
                  {["Sve", "Prilivi", "Odlivovi"].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={cn(
                        "h-8 flex-1 rounded-lg px-3 text-[11px] font-bold transition active:scale-[0.98] sm:flex-none",
                        filter === activeFilter
                          ? "bg-white text-zinc-900 shadow-sm"
                          : "text-zinc-400",
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
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-[16px] outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50 sm:h-9 sm:text-[12px]"
                  />
                </div>
              </div>
            </div>
            <div className="divide-y divide-[#f0f1f2]">
              {filteredTransactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} deleting={deletingId === transaction.id} onDelete={() => removeTransaction(transaction)} />
              ))}
            </div>
            {formError && <p role="alert" className="border-t border-[#eceeef] px-4 py-3 text-sm font-medium text-red-600 md:px-6">{formError}</p>}
          </section>
        </div>
        ) : activeNav === "Mjesečni troškovi" ? (
          <MonthlyExpenses view="fixed" items={recurringItems} onItemsChange={setRecurringItems} onPaid={(transaction) => setTransactions((current) => [transaction, ...current])} />
        ) : activeNav === "Pretplate" ? (
          <MonthlyExpenses view="subscription" items={recurringItems} onItemsChange={setRecurringItems} onPaid={(transaction) => setTransactions((current) => [transaction, ...current])} />
        ) : (
          <BankAccounts initialAccounts={initialBankAccounts} />
        )}
      </main>

      <nav aria-label="Glavna navigacija" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-zinc-200/80 bg-white/85 px-1 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(24,24,27,0.05)] backdrop-blur-xl lg:hidden">
        {[
          { label: "Pregled", icon: Home },
          { label: "Mjesečni troškovi", icon: Target },
          { label: "Pretplate", icon: CreditCard },
          { label: "Banka", icon: Landmark },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => setActiveNav(item.label)}
            className={cn(
              "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[9px] font-bold transition active:scale-95",
              activeNav === item.label ? "text-emerald-800" : "text-zinc-400",
            )}
          >
            {activeNav === item.label && <span className="absolute top-0 h-1 w-8 rounded-full bg-emerald-600" />}
            <item.icon size={20} strokeWidth={activeNav === item.label ? 2.4 : 1.8} />
            {item.label === "Mjesečni troškovi" ? "Troškovi" : item.label}
          </button>
        ))}
      </nav>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-zinc-950/35 px-0 backdrop-blur-[2px] sm:items-center sm:px-4" role="dialog" aria-modal="true">
          <form onSubmit={addTransaction} className="max-h-[calc(100dvh-12px)] w-full overflow-y-auto rounded-t-[28px] border border-white/70 bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-200 sm:hidden" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999da1]">Nova stavka</p>
                <h2 className="text-[20px] font-bold">Dodaj transakciju</h2>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95">
                <X size={16} />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1.5">
              <label className="cursor-pointer">
                <input type="radio" name="type" value="expense" checked={newTransactionType === "expense"} onChange={() => setNewTransactionType("expense")} className="peer sr-only" />
                <span className="flex h-10 items-center justify-center rounded-xl text-[12px] font-bold text-zinc-500 transition peer-checked:bg-white peer-checked:text-zinc-900 peer-checked:shadow-sm">Odliv</span>
              </label>
              <label className="cursor-pointer">
                <input type="radio" name="type" value="income" checked={newTransactionType === "income"} onChange={() => setNewTransactionType("income")} className="peer sr-only" />
                <span className="flex h-10 items-center justify-center rounded-xl text-[12px] font-bold text-zinc-500 transition peer-checked:bg-white peer-checked:text-zinc-900 peer-checked:shadow-sm">Priliv</span>
              </label>
            </div>
            <label className="mt-4 block text-[12px] font-semibold text-[#686b70]">
              Naziv
              <input name="title" placeholder={newTransactionType === "income" ? "Opcionalno, npr. Plata" : "Opcionalno, npr. Kupovina namirnica"} className="mt-2 h-12 w-full rounded-xl border border-zinc-200 px-3 text-[16px] outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50" />
            </label>
            <div className={cn("mt-4 grid gap-3", newTransactionType === "expense" ? "grid-cols-1 min-[390px]:grid-cols-2" : "grid-cols-1")}>
              <label className="text-[12px] font-semibold text-[#686b70]">
                Iznos (€)
                <input name="amount" required type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" className="mt-2 h-12 w-full rounded-xl border border-zinc-200 px-3 text-[18px] font-bold outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50" />
              </label>
              {newTransactionType === "expense" ? (
                <label className="text-[12px] font-semibold text-[#686b70]">
                  Kategorija
                  <select name="category" className="mt-2 h-12 w-full rounded-xl border border-zinc-200 px-3 text-[16px] outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50">
                    <option>Kućni troškovi</option>
                    <option>Lični troškovi</option>
                  </select>
                </label>
              ) : null}
            </div>
            <button type="submit" disabled={isSaving} className="mt-6 h-12 w-full rounded-2xl bg-zinc-900 text-[14px] font-bold text-white shadow-lg shadow-zinc-900/15 transition hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
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
  tone?: "dark" | "danger" | "success" | "info";
  trend: string;
  featured?: boolean;
}

interface PlannedItemsCardProps {
  title: string;
  subtitle: string;
  kind: PlannedItemKind;
  items: PlannedItem[];
  total: number;
  formOpen: boolean;
  saving: boolean;
  onToggleForm: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>, kind: PlannedItemKind) => Promise<void>;
  onDelete: (item: PlannedItem) => Promise<void>;
}

function PlannedItemsCard({ title, subtitle, kind, items, total, formOpen, saving, onToggleForm, onSubmit, onDelete }: PlannedItemsCardProps) {
  const visibleItems = items.filter((item) => item.kind === kind);

  return (
    <div className="rounded-xl border border-[#e7e8ea] bg-white p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="mt-1 text-xs text-[#8d9196]">{subtitle}</p>
        </div>
        <button type="button" onClick={onToggleForm} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#dfe1e3] px-3 text-xs font-bold">
          <Plus size={15} /> {formOpen ? "Otkaži" : "Dodaj"}
        </button>
      </div>

      {formOpen && (
        <form onSubmit={(event) => onSubmit(event, kind)} className="mt-4 grid grid-cols-[1fr_110px] gap-2 rounded-xl bg-[#f5f6f7] p-3">
          <input name="description" required maxLength={120} placeholder="Opis" aria-label={`Opis za ${title.toLowerCase()}`} className="h-10 min-w-0 rounded-lg border border-[#dfe1e3] bg-white px-3 text-sm outline-none focus:border-[#919b93]" />
          <input name="amount" required type="number" min="0.01" max="9999999999.99" step="0.01" placeholder="Iznos €" aria-label={`Iznos za ${title.toLowerCase()}`} className="h-11 min-w-0 rounded-lg border border-[#cfd3d6] bg-white px-3 text-base font-bold outline-none focus:border-[#6f8173]" />
          <button disabled={saving} className="col-span-2 h-10 rounded-lg bg-[#202124] text-xs font-bold text-white disabled:opacity-60">{saving ? "Čuvanje..." : "Sačuvaj stavku"}</button>
        </form>
      )}

      <div className="mt-4 divide-y divide-[#eff0f1]">
        {visibleItems.length === 0 ? (
          <p className="py-4 text-sm text-[#9a9da2]">Još nema unesenih stavki.</p>
        ) : visibleItems.map((item) => (
          <div key={item.id} className="flex min-h-12 items-center gap-3 py-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{item.description}</p>
            <p className="shrink-0 text-base font-bold">{formatMoney(item.amount)} €</p>
            <button type="button" onClick={() => onDelete(item)} aria-label={`Ukloni ${item.description}`} title="Ukloni stavku" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#8b8e93] hover:bg-red-50 hover:text-red-600">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#e7e8ea] pt-3 text-sm">
        <span className="font-semibold text-[#777b82]">Ukupno</span>
        <strong className="text-lg">{formatMoney(total)} €</strong>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon, tone, trend, featured = false }: SummaryCardProps) {
  const colored = Boolean(tone);
  return (
    <div className={cn(
      "min-h-[116px] min-w-0 rounded-2xl border p-3.5 shadow-[0_2px_12px_rgba(24,24,27,0.035)] transition sm:min-h-[132px] sm:p-5",
      featured && "col-span-2 min-h-[142px]",
      !tone && "border-zinc-200/80 bg-white",
      tone === "dark" && "border-zinc-800 bg-zinc-900 text-white shadow-lg shadow-zinc-900/10",
      tone === "danger" && "border-rose-700 bg-rose-700 text-white shadow-lg shadow-rose-900/10",
      tone === "success" && "border-emerald-700 bg-emerald-700 text-white shadow-lg shadow-emerald-900/10",
      tone === "info" && "border-blue-700 bg-blue-700 text-white shadow-lg shadow-blue-900/10",
    )}>
      <div className="flex items-center justify-between">
        <p className={cn("text-[10px] font-semibold leading-tight sm:text-[12px]", colored ? "text-white/80" : "text-zinc-500")}>{title}</p>
        <div className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg sm:h-8 sm:w-8", colored ? "bg-white/10 text-white" : "bg-zinc-100 text-zinc-500")}>{icon}</div>
      </div>
      <div className="mt-3 sm:mt-5">
        <p className={cn("whitespace-nowrap font-bold tracking-tight", featured ? "text-[25px] sm:text-[30px]" : "text-[17px] sm:text-[23px]")}>{value}</p>
        <span className={cn("mt-1 block min-h-4 text-[9px] font-bold leading-tight sm:text-[10px]", colored ? "text-white/80" : "text-emerald-700")}>{trend}</span>
      </div>
    </div>
  );
}

interface BudgetRowProps {
  label: string;
  spent: number;
  total: number;
  percent: number;
  color: string;
}

function BudgetRow({ label, spent, total, percent, color }: BudgetRowProps) {
  const remaining = Math.max(0, total - spent);
  const exceeded = Math.max(0, spent - total);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <p className="text-[12px] font-semibold">{label}</p>
        <div className="text-right text-[13px] sm:text-sm">
          <p><span className="text-[#9a9da1]">Potrošeno:</span> <span className="font-bold text-[#4d5054]">{formatMoney(spent)} €</span> <span className="text-[#9a9da1]">od {formatMoney(total)} €</span></p>
          {exceeded > 0 ? (
            <p className="mt-0.5 font-semibold text-red-600">Limit prekoračen za {formatMoney(exceeded)} €</p>
          ) : (
            <p className="mt-0.5 font-semibold text-[#66816d]">Preostalo: {formatMoney(remaining)} €</p>
          )}
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

interface TransactionRowProps {
  transaction: Transaction;
  deleting: boolean;
  onDelete: () => void;
}

function TransactionRow({ transaction, deleting, onDelete }: TransactionRowProps) {
  const isIncome = transaction.type === "income";
  return (
    <div className="flex items-center px-4 py-3.5 transition hover:bg-zinc-50/70 md:px-6">
      <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-2xl sm:h-11 sm:w-11", isIncome ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600")}>
        {isIncome ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
      </div>
      <div className="ml-3 min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-zinc-800 sm:text-[14px]">{transaction.title}</p>
        <p className="mt-0.5 truncate text-[10px] text-zinc-400 sm:text-[11px]">{transaction.category} · {transaction.date}</p>
      </div>
      <p className={cn("ml-2 shrink-0 text-[12px] font-bold sm:ml-3 sm:text-[14px]", isIncome ? "text-emerald-700" : "text-zinc-800")}>
        {isIncome ? "+" : "-"}{formatMoney(transaction.amount)} €
      </p>
      <button type="button" onClick={onDelete} disabled={deleting} aria-label={`Ukloni transakciju ${transaction.title}`} title="Ukloni transakciju" className="ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95 disabled:opacity-50 sm:ml-3">
        <Trash2 size={16} />
      </button>
    </div>
  );
}
