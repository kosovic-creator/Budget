"use client";

import { CircleCheckBig, CreditCard, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useConfirmation } from "@/components/confirmation-dialog";
import { deleteRecurringItem, payRecurringItem, resetRecurringPayment, saveRecurringItem } from "@/app/actions";
import type { RecurringItem, RecurringItemKind } from "@/lib/recurring-items";
import type { Transaction } from "@/lib/transactions";

interface MonthlyExpensesProps {
  view: RecurringItemKind;
  items: RecurringItem[];
  onItemsChange: (items: RecurringItem[]) => void;
  onPaid: (transaction: Transaction) => void;
  onPaymentReset: (transactionId: string) => void;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export default function MonthlyExpenses({ view, items, onItemsChange, onPaid, onPaymentReset }: MonthlyExpensesProps) {
  const [adding, setAdding] = useState(false);
  const { confirmRemoval, confirmation } = useConfirmation();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const visibleItems = items.filter((item) => item.kind === view);
  const fixedTotal = items.filter((item) => item.kind === "fixed" && !item.paid).reduce((sum, item) => sum + item.amount, 0);
  const subscriptionsTotal = items.filter((item) => item.kind === "subscription" && !item.paid).reduce((sum, item) => sum + item.amount, 0);

  async function save(event: React.FormEvent<HTMLFormElement>, kind: RecurringItemKind, id?: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSavingId(id ?? "new");
    setMessage("");
    const result = await saveRecurringItem({ id, name: String(form.get("name") ?? ""), amount: Number(form.get("amount")), kind });
    if (result.success) {
      onItemsChange(id ? items.map((item) => item.id === id ? result.item : item) : [...items, result.item]);
      if (!id) setAdding(false);
      setMessage("Sačuvano.");
    } else setMessage(result.message);
    setSavingId(null);
  }

  async function remove(item: RecurringItem) {
    if (!(await confirmRemoval(`Ukloniti stavku „${item.name}“?`))) return;
    setSavingId(item.id);
    const result = await deleteRecurringItem(item.id);
    if (result.success) onItemsChange(items.filter((entry) => entry.id !== item.id));
    else setMessage(result.message);
    setSavingId(null);
  }

  async function pay(item: RecurringItem) {
    setSavingId(item.id);
    setMessage("");
    const result = await payRecurringItem(item.id);
    if (result.success) {
      onPaid(result.transaction);
      onItemsChange(items.map((entry) => entry.id === result.itemId ? { ...entry, paid: true } : entry));
      setMessage(`Trošak „${item.name}“ je evidentiran kao odliv.`);
    } else setMessage(result.message);
    setSavingId(null);
  }

  async function resetPayment(item: RecurringItem) {
    setSavingId(item.id);
    setMessage("");
    try {
      const result = await resetRecurringPayment(item.id);
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      onItemsChange(items.map((entry) => entry.id === item.id ? { ...entry, paid: false } : entry));
      onPaymentReset(result.transactionId);
      setMessage(result.removedTransaction
        ? "Plaćanje je poništeno."
        : "Stavka je vraćena na „Plati“. Raniji zapis provjerite u Posljednjim transakcijama.");
    } catch {
      setMessage("Plaćanje nije poništeno. Pokušajte ponovo.");
    } finally {
      setSavingId(null);
    }
  }

  const title = view === "fixed" ? "Redovni" : "Pretplate";

  return (
    <section className="mx-auto max-w-[1440px] px-4 py-4 sm:px-5 md:px-8 md:py-7 lg:px-10">
      {confirmation}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_2px_12px_rgba(24,24,27,0.035)] md:p-6">
        <div className="flex flex-col gap-3 min-[390px]:flex-row min-[390px]:items-center min-[390px]:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">{view === "fixed" ? "Unesite redovne mjesečne obaveze i evidentirajte plaćanje." : "Unesite sve aktivne mjesečne pretplate."}</p>
          </div>
          <button type="button" onClick={() => setAdding((current) => !current)} className="flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 text-sm font-bold text-zinc-800 transition active:scale-[0.98] min-[390px]:w-auto">
            <Plus size={16} /> {adding ? "Otkaži" : view === "fixed" ? "Dodaj trošak" : "Dodaj pretplatu"}
          </button>
        </div>

        {adding && (
          <form onSubmit={(event) => save(event, view)} className="mt-5 grid grid-cols-[minmax(0,1fr)_82px_42px] items-end gap-1.5 rounded-2xl bg-zinc-50 p-3 sm:grid-cols-[minmax(0,1fr)_140px_44px] sm:gap-3 sm:p-4">
            <label className="min-w-0 text-xs font-semibold text-zinc-700 sm:text-sm">Naziv<input name="name" required maxLength={100} className="mt-2 h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-2 text-[16px] outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50 sm:h-12 sm:px-3 sm:text-sm" /></label>
            <label className="min-w-0 text-xs font-semibold text-zinc-700 sm:text-sm">Iznos (€)<input name="amount" required type="number" inputMode="decimal" min="0.01" max="9999999999.99" step="0.01" className="mt-2 h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-2 text-[16px] font-bold outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50 sm:h-12 sm:px-3 sm:text-sm" /></label>
            <button disabled={savingId === "new"} aria-label="Sačuvaj novu stavku" title="Sačuvaj" className="grid h-11 w-10 place-items-center rounded-xl bg-zinc-900 text-white shadow-lg shadow-zinc-900/10 transition active:scale-[0.98] disabled:opacity-60 sm:h-12 sm:w-11"><Save size={18} /></button>
          </form>
        )}

        <div className="mt-5 space-y-3">
          {visibleItems.length === 0 ? <p className="rounded-2xl bg-zinc-50 p-5 text-sm text-zinc-500">Još nema unesenih stavki.</p> : visibleItems.map((item) => (
            <form key={item.id} onSubmit={(event) => save(event, item.kind, item.id)} className="grid grid-cols-[minmax(0,1fr)_60px_repeat(4,40px)] items-end gap-1 rounded-2xl border border-zinc-200/80 p-2 sm:grid-cols-[minmax(0,1fr)_140px_repeat(4,44px)] sm:gap-2 sm:p-4">
              <label className="min-w-0 overflow-hidden text-[11px] font-semibold text-zinc-700 sm:text-sm">Naziv<input name="name" required defaultValue={item.name} className="mt-2 h-11 w-full min-w-0 rounded-xl border border-zinc-200 px-2 text-[16px] outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50 sm:h-12 sm:px-3 sm:text-sm" /></label>
              <label className="min-w-0 overflow-hidden text-[11px] font-semibold text-zinc-700 sm:text-sm">Iznos (€)<input name="amount" required type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={item.amount} className="mt-2 h-11 w-full min-w-0 rounded-xl border border-zinc-200 px-1.5 text-[16px] font-bold outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50 sm:h-12 sm:px-3 sm:text-sm" /></label>
              <button disabled={savingId === item.id} aria-label={`Sačuvaj ${item.name}`} title="Sačuvaj" className="grid h-11 w-10 place-items-center rounded-xl border border-zinc-200 text-zinc-700 transition active:scale-[0.98] disabled:opacity-60 sm:h-12 sm:w-11"><Save size={17} /></button>
              <button type="button" onClick={() => pay(item)} disabled={savingId === item.id || item.paid} aria-label={item.paid ? `${item.name} je plaćeno` : `Plati ${item.name}`} title={item.paid ? "Plaćeno" : "Plati"} className="grid h-11 w-10 place-items-center rounded-xl bg-zinc-900 text-white transition active:scale-95 disabled:bg-emerald-50 disabled:text-emerald-700 disabled:opacity-100 sm:h-12 sm:w-11">{item.paid ? <CircleCheckBig size={18} /> : <CreditCard size={18} />}</button>
              <button type="button" onClick={() => resetPayment(item)} disabled={!item.paid || savingId !== null} aria-label={`Poništi plaćanje za ${item.name}`} title="Poništi plaćanje" className="grid h-11 w-10 place-items-center rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 sm:h-12 sm:w-11"><RotateCcw size={17} /></button>
              <button type="button" onClick={() => remove(item)} disabled={savingId === item.id} aria-label={`Ukloni ${item.name}`} className="grid h-11 w-10 place-items-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95 disabled:opacity-60 sm:h-12 sm:w-11"><Trash2 size={17} /></button>
            </form>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {view === "fixed" ? <Total label="Pretplate" value={subscriptionsTotal} /> : null}
          <Total label={view === "fixed" ? "Ukupno mjesečni troškovi" : "Ukupno pretplate"} value={view === "fixed" ? fixedTotal + subscriptionsTotal : subscriptionsTotal} />
        </div>
        {message && <p role="status" className="mt-4 text-sm font-medium text-[#66816d]">{message}</p>}
      </div>
    </section>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-sm font-semibold text-emerald-900/70">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-emerald-950">{formatMoney(value)} €</p></div>;
}
