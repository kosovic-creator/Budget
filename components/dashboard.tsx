"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  ChevronRight,
  CircleHelp,
  Fingerprint,
  Home,
  Landmark,
  LayoutGrid,
  Plus,
  Search,
  Settings,
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
  const fixedExpensesTotal = recurringItems.filter((item) => item.kind === "fixed").reduce((sum, item) => sum + item.amount, 0);
  const subscriptionsTotal = recurringItems.filter((item) => item.kind === "subscription").reduce((sum, item) => sum + item.amount, 0);
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
            { label: "Pregled", icon: LayoutGrid },
            { label: "Mjesečni troškovi", icon: Target },
            { label: "Pretplate", icon: CreditCard },
            { label: "Banka", icon: Landmark },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveNav(item.label)}
              className={cn(
                "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition",
                activeNav === item.label ? "bg-[#eef0f2] text-[#202124]" : "text-[#777b82] hover:bg-[#f5f6f7]",
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
              <p className="truncate text-[13px] font-semibold">{userName}</p>
              <button onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { router.replace("/sign-in"); router.refresh(); } } })} className="mt-0.5 flex items-center gap-1 text-[11px] text-[#9b9da1] hover:text-[#555]">
                <LogOut size={11} /> Odjavi se
              </button>
            </div>
            <ChevronRight size={16} className="ml-auto text-[#aaa]" />
          </div>
        </div>
      </aside>

      <main className="pb-[calc(82px+env(safe-area-inset-bottom))] lg:ml-[232px] lg:pb-0">
        <header className="sticky top-0 z-20 flex min-h-[68px] items-center justify-between border-b border-[#e7e8ea] bg-white/95 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md md:h-[76px] md:px-8 md:py-0 lg:static lg:px-10">
          <div>
            <p className="text-[11px] font-medium text-[#9a9da2] md:text-[12px]">Novembar 2026.</p>
            <h1 className="text-[18px] font-bold tracking-tight md:text-[20px]">{activeNav}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={addPasskey} disabled={isAddingPasskey} aria-label="Dodaj ovaj uređaj za sigurnu prijavu" title="Zaštiti ovaj uređaj" className="grid h-10 w-10 place-items-center rounded-full border border-[#e6e7e9] text-[#6f7378] disabled:opacity-50">
              <Fingerprint size={18} />
            </button>
            <button aria-label="Obavještenja" className="hidden h-10 w-10 place-items-center rounded-full border border-[#e6e7e9] text-[#6f7378] min-[380px]:grid">
              <Bell size={17} />
            </button>
            <button
              onClick={() => { setNewTransactionType("expense"); setFormError(""); setIsModalOpen(true); }}
              className="ml-1 flex h-10 w-10 items-center justify-center gap-2 rounded-lg bg-[#202124] text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#34363a] sm:w-auto sm:px-4"
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
          <section id="overview" className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 md:gap-4 xl:grid-cols-3">
            <SummaryCard title="Ukupno stanje" value={`${totalBalance < 0 ? "−" : ""}${formatMoney(totalBalance)} €`} icon={<WalletCards size={18} />} tone="dark" trend="Nakon očekivanih troškova" />
            <SummaryCard title="OTP račun" value={`${formatMoney(budget.otp)} €`} icon={<Landmark size={18} />} trend="Stanje na računu" />
            <SummaryCard title="NLB umanjeno" value={`${nlbAvailable < 0 ? "−" : ""}${formatMoney(nlbAvailable)} €`} icon={<Landmark size={18} />} trend="NLB − 1.300 €" />
            <SummaryCard title="Keš" value={`${formatMoney(budget.cash)} €`} icon={<WalletCards size={18} />} trend="Gotovina" />
            <SummaryCard title="Mjesečni troškovi" value={`${formatMoney(monthlyExpensesTotal)} €`} icon={<Target size={18} />} trend={`${formatMoney(fixedExpensesTotal)} € fiksni + ${formatMoney(subscriptionsTotal)} € pretplate`} />
            <SummaryCard title="Dodaci" value={`${formatMoney(additionsTotal)} €`} icon={<ArrowDownLeft size={18} />} trend="Sigurni budući prilivi" />
            <SummaryCard title="Očekivani troškovi" value={`${formatMoney(expectedExpensesTotal)} €`} icon={<ArrowUpRight size={18} />} trend="Oduzeti od ukupnog stanja" />
            <SummaryCard title="Slobodno nakon planova" value={`${availableAfterPlans < 0 ? "−" : ""}${formatMoney(availableAfterPlans)} €`} icon={<Target size={18} />} tone={availableAfterPlans < 0 ? "danger" : availableAfterPlans === 0 ? "success" : "info"} trend="Stanje − mjesečni troškovi − kućni i lični limit" />
          </section>

          <section className="mt-3 md:mt-4">
            <div id="plans" className="scroll-mt-20 rounded-xl border border-[#e7e8ea] bg-white p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-[#777b82]">Mjesečni limiti troškova</p>
                  <p className="mt-1 text-[11px] text-[#a2a4a8]">Za svaku kategoriju vidiš potrošeno, limit i preostali iznos.</p>
                </div>
                <button onClick={() => { setEditingBudget(!editingBudget); setBudgetMessage(""); }} disabled={budgetSaving} className="rounded-lg border border-[#e5e6e8] px-3 py-2 text-xs font-semibold">{editingBudget ? "Završi unos" : "Unos stanja i plana"}</button>
              </div>
              <div className="mt-4 space-y-4 md:mt-5 md:space-y-5">
                {([
                  ["Kućni troškovi", budget.household, "#7e927f"],
                  ["Lični troškovi", budget.personal, "#b9a578"],
                ] as const).map(([label, total, color]) => {
                  const spent = Math.abs(transactions.filter(item => item.type === "expense" && item.category === label).reduce((sum, item) => sum + item.amount, 0));
                  return <BudgetRow key={label} label={label} spent={spent} total={total} percent={total > 0 ? Math.min(100, spent / total * 100) : 0} color={color} />;
                })}
                {editingBudget && (
                  <>
                  <form onSubmit={submitBudget} className="grid gap-3 border-t border-[#e7e8ea] pt-4 sm:grid-cols-2">
                    {([
                      ["otp", "Stanje na OTP računu"],
                      ["nlb", "Ukupno stanje na NLB računu"],
                      ["household", "Mjesečni limit za kućne troškove"],
                      ["personal", "Mjesečni limit za lične troškove"],
                      ["cash", "Trenutni iznos keša"],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="text-xs font-semibold text-[#686b70]">
                        {label} (€)
                        <input name={key} type="number" required min="0" max="9999999999.99" step="0.01" defaultValue={Number.isFinite(budget[key]) ? budget[key] : 0} disabled={budgetSaving} className="mt-2 h-11 w-full rounded-lg border border-[#e2e4e6] px-3 text-sm" />
                      </label>
                    ))}
                    <p className="rounded-lg bg-[#f4f5f7] px-3 py-3 text-xs text-[#686b70] sm:col-span-2">NLB raspoloživo se računa automatski: uneseno stanje minus 1.300 €.</p>
                    <button disabled={budgetSaving} className="rounded-lg bg-[#202124] px-4 py-3 text-xs font-bold text-white disabled:opacity-60 sm:col-span-2">{budgetSaving ? "Čuvanje..." : "Sačuvaj stanje i plan"}</button>
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

      <nav aria-label="Glavna navigacija" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#e7e8ea] bg-white/95 px-1 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
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
              "flex min-h-12 flex-col items-center justify-center gap-1 px-0.5 text-[9px] font-semibold",
              activeNav === item.label ? "text-[#202124]" : "text-[#92969b]",
            )}
          >
            <item.icon size={19} strokeWidth={activeNav === item.label ? 2.2 : 1.8} />
            {item.label === "Mjesečni troškovi" ? "Troškovi" : item.label}
          </button>
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
                <input type="radio" name="type" value="expense" checked={newTransactionType === "expense"} onChange={() => setNewTransactionType("expense")} className="peer sr-only" />
                <span className="flex h-9 items-center justify-center rounded-lg text-[12px] font-bold text-[#83878c] peer-checked:bg-white peer-checked:text-[#34363a] peer-checked:shadow-sm">Odliv</span>
              </label>
              <label className="cursor-pointer">
                <input type="radio" name="type" value="income" checked={newTransactionType === "income"} onChange={() => setNewTransactionType("income")} className="peer sr-only" />
                <span className="flex h-9 items-center justify-center rounded-lg text-[12px] font-bold text-[#83878c] peer-checked:bg-white peer-checked:text-[#34363a] peer-checked:shadow-sm">Priliv</span>
              </label>
            </div>
            <label className="mt-4 block text-[12px] font-semibold text-[#686b70]">
              Naziv
              <input name="title" placeholder={newTransactionType === "income" ? "Opcionalno, npr. Plata" : "Opcionalno, npr. Kupovina namirnica"} className="mt-2 h-11 w-full rounded-lg border border-[#e2e4e6] px-3 text-[14px] outline-none focus:border-[#9fa9a1]" />
            </label>
            <div className={cn("mt-4 grid gap-3", newTransactionType === "expense" ? "grid-cols-1 min-[390px]:grid-cols-2" : "grid-cols-1")}>
              <label className="text-[12px] font-semibold text-[#686b70]">
                Iznos (€)
                <input name="amount" required type="number" min="0.01" step="0.01" placeholder="0.00" className="mt-2 h-11 w-full rounded-lg border border-[#e2e4e6] px-3 text-[14px] outline-none focus:border-[#9fa9a1]" />
              </label>
              {newTransactionType === "expense" ? (
                <label className="text-[12px] font-semibold text-[#686b70]">
                  Kategorija
                  <select name="category" className="mt-2 h-11 w-full rounded-lg border border-[#e2e4e6] px-3 text-[13px] outline-none focus:border-[#9fa9a1]">
                    <option>Kućni troškovi</option>
                    <option>Lični troškovi</option>
                  </select>
                </label>
              ) : null}
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
  tone?: "dark" | "danger" | "success" | "info";
  trend: string;
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
          <input name="amount" required type="number" min="0.01" max="9999999999.99" step="0.01" placeholder="Iznos €" aria-label={`Iznos za ${title.toLowerCase()}`} className="h-10 min-w-0 rounded-lg border border-[#dfe1e3] bg-white px-3 text-sm outline-none focus:border-[#919b93]" />
          <button disabled={saving} className="col-span-2 h-10 rounded-lg bg-[#202124] text-xs font-bold text-white disabled:opacity-60">{saving ? "Čuvanje..." : "Sačuvaj stavku"}</button>
        </form>
      )}

      <div className="mt-4 divide-y divide-[#eff0f1]">
        {visibleItems.length === 0 ? (
          <p className="py-4 text-sm text-[#9a9da2]">Još nema unesenih stavki.</p>
        ) : visibleItems.map((item) => (
          <div key={item.id} className="flex min-h-12 items-center gap-3 py-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{item.description}</p>
            <p className="shrink-0 text-sm font-bold">{formatMoney(item.amount)} €</p>
            <button type="button" onClick={() => onDelete(item)} aria-label={`Ukloni ${item.description}`} title="Ukloni stavku" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#8b8e93] hover:bg-red-50 hover:text-red-600">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#e7e8ea] pt-3 text-sm">
        <span className="font-semibold text-[#777b82]">Ukupno</span>
        <strong>{formatMoney(total)} €</strong>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon, tone, trend }: SummaryCardProps) {
  const colored = Boolean(tone);
  return (
    <div className={cn(
      "min-h-[112px] min-w-0 rounded-xl border p-3.5 sm:min-h-[132px] sm:p-5",
      !tone && "border-[#e7e8ea] bg-white",
      tone === "dark" && "border-[#202124] bg-[#202124] text-white",
      tone === "danger" && "border-[#b83b3b] bg-[#b83b3b] text-white",
      tone === "success" && "border-[#31724a] bg-[#31724a] text-white",
      tone === "info" && "border-[#2767a7] bg-[#2767a7] text-white",
    )}>
      <div className="flex items-center justify-between">
        <p className={cn("text-[10px] font-semibold leading-tight sm:text-[12px]", colored ? "text-white/80" : "text-[#85888d]")}>{title}</p>
        <div className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg sm:h-8 sm:w-8", colored ? "bg-white/10 text-white" : "bg-[#f2f3f4] text-[#777b82]")}>{icon}</div>
      </div>
      <div className="mt-3 sm:mt-5">
        <p className="whitespace-nowrap text-[17px] font-bold tracking-tight sm:text-[23px]">{value}</p>
        <span className={cn("mt-1 block min-h-4 text-[9px] font-bold leading-tight sm:text-[10px]", colored ? "text-white/80" : "text-[#72917a]")}>{trend}</span>
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
        <div className="text-right text-[11px]">
          <p><span className="text-[#9a9da1]">Potrošeno:</span> <span className="font-bold text-[#4d5054]">{formatMoney(spent)} €</span> <span className="text-[#9a9da1]">od {formatMoney(total)} €</span></p>
          {exceeded > 0 ? (
            <p className="mt-0.5 font-semibold text-red-600">Limit prekoračen za {formatMoney(exceeded)} €</p>
          ) : (
            <p className="mt-0.5 font-semibold text-[#66816d]">Preostalo: {formatMoney(remaining)} €</p>
          )}
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#eff1f2]">
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
      <button type="button" onClick={onDelete} disabled={deleting} className="ml-3 shrink-0 rounded-lg border border-[#e3e4e6] px-2.5 py-1.5 text-[10px] font-semibold text-[#777b82] hover:border-red-200 hover:text-red-600 disabled:opacity-50 sm:text-[11px]">
        {deleting ? "Uklanjanje..." : "Ukloni"}
      </button>
    </div>
  );
}
