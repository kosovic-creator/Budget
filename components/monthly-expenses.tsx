"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteRecurringItem, payRecurringItem, saveRecurringItem } from "@/app/actions";
import type { RecurringItem, RecurringItemKind } from "@/lib/recurring-items";
import type { Transaction } from "@/lib/transactions";

interface MonthlyExpensesProps {
  view: RecurringItemKind;
  items: RecurringItem[];
  onItemsChange: (items: RecurringItem[]) => void;
  onPaid: (transaction: Transaction) => void;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export default function MonthlyExpenses({ view, items, onItemsChange, onPaid }: MonthlyExpensesProps) {
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const visibleItems = items.filter((item) => item.kind === view);
  const fixedTotal = items.filter((item) => item.kind === "fixed").reduce((sum, item) => sum + item.amount, 0);
  const subscriptionsTotal = items.filter((item) => item.kind === "subscription").reduce((sum, item) => sum + item.amount, 0);

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
    if (!window.confirm(`Ukloniti stavku „${item.name}“?`)) return;
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
      setMessage(`Trošak „${item.name}“ je evidentiran kao odliv.`);
    } else setMessage(result.message);
    setSavingId(null);
  }

  const title = view === "fixed" ? "Mjesečni troškovi" : "Pretplate";

  return (
    <section className="mx-auto max-w-[1440px] px-4 py-4 sm:px-5 md:px-8 md:py-7 lg:px-10">
      <div className="rounded-xl border border-[#e7e8ea] bg-white p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="mt-1 text-sm text-[#85888d]">{view === "fixed" ? "Unesite redovne mjesečne obaveze i evidentirajte plaćanje." : "Unesite sve aktivne mjesečne pretplate."}</p>
          </div>
          <button type="button" onClick={() => setAdding((current) => !current)} className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[#dfe1e3] px-3 text-sm font-bold">
            <Plus size={16} /> {adding ? "Otkaži" : view === "fixed" ? "Dodaj trošak" : "Dodaj pretplatu"}
          </button>
        </div>

        {adding && (
          <form onSubmit={(event) => save(event, view)} className="mt-5 grid gap-3 rounded-xl bg-[#f5f6f7] p-4 md:grid-cols-[1fr_220px_auto]">
            <label className="text-sm font-semibold">Naziv<input name="name" required maxLength={100} className="mt-2 h-11 w-full rounded-lg border border-[#dfe1e3] bg-white px-3" /></label>
            <label className="text-sm font-semibold">Iznos (€)<input name="amount" required type="number" min="0.01" max="9999999999.99" step="0.01" className="mt-2 h-11 w-full rounded-lg border border-[#dfe1e3] bg-white px-3" /></label>
            <button disabled={savingId === "new"} className="h-11 self-end rounded-lg bg-[#202124] px-5 text-sm font-bold text-white disabled:opacity-60">Sačuvaj</button>
          </form>
        )}

        <div className="mt-5 space-y-3">
          {visibleItems.length === 0 ? <p className="rounded-xl bg-[#f5f6f7] p-5 text-sm text-[#85888d]">Još nema unesenih stavki.</p> : visibleItems.map((item) => (
            <form key={item.id} onSubmit={(event) => save(event, item.kind, item.id)} className="grid gap-3 rounded-xl border border-[#eceeef] p-3 md:grid-cols-[1fr_220px_auto_auto] md:items-end">
              <label className="text-sm font-semibold">Naziv<input name="name" required defaultValue={item.name} className="mt-2 h-11 w-full rounded-lg border border-[#dfe1e3] px-3" /></label>
              <label className="text-sm font-semibold">Iznos (€)<input name="amount" required type="number" min="0.01" step="0.01" defaultValue={item.amount} className="mt-2 h-11 w-full rounded-lg border border-[#dfe1e3] px-3" /></label>
              <button disabled={savingId === item.id} className="h-11 rounded-lg border border-[#dfe1e3] px-4 text-sm font-bold disabled:opacity-60">Sačuvaj</button>
              <div className="flex gap-2">
                {view === "fixed" ? <button type="button" onClick={() => pay(item)} disabled={savingId === item.id} className="h-11 rounded-lg bg-[#202124] px-4 text-sm font-bold text-white disabled:opacity-60">Plati</button> : null}
                <button type="button" onClick={() => remove(item)} disabled={savingId === item.id} aria-label={`Ukloni ${item.name}`} className="grid h-11 w-11 place-items-center rounded-lg border border-[#dfe1e3] text-[#777b82] hover:text-red-600 disabled:opacity-60"><Trash2 size={17} /></button>
              </div>
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
  return <div className="rounded-xl bg-[#f2f4f2] p-4"><p className="text-sm font-semibold text-[#686b70]">{label}</p><p className="mt-2 text-2xl font-bold">{formatMoney(value)} €</p></div>;
}
