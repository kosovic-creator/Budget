"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export function useConfirmation() {
  const [request, setRequest] = useState<{ message: string; resolve: (confirmed: boolean) => void } | null>(null);

  function confirmRemoval(message: string) {
    return new Promise<boolean>((resolve) => setRequest({ message, resolve }));
  }

  const confirmation = request && (
    <ConfirmationDialog message={request.message} onClose={(confirmed) => {
      setRequest(null);
      request.resolve(confirmed);
    }} />
  );
  return { confirmRemoval, confirmation };
}

function ConfirmationDialog({ message, onClose }: { message: string; onClose: (confirmed: boolean) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog ref={dialogRef} role="alertdialog" aria-labelledby={titleId} aria-describedby={messageId}
      onCancel={(event) => { event.preventDefault(); onClose(false); }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-5 text-zinc-900 shadow-2xl backdrop:bg-zinc-950/45">
      <div className="mb-3 grid size-11 place-items-center rounded-xl bg-rose-50 text-rose-700"><Trash2 size={20} aria-hidden /></div>
      <h2 id={titleId} className="text-lg font-bold">Potvrdi uklanjanje</h2>
      <p id={messageId} className="mt-2 break-words text-sm text-zinc-600">{message}</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" autoFocus onClick={() => onClose(false)} className="min-h-11 rounded-xl border border-zinc-200 px-3 text-sm font-semibold">Otkaži</button>
        <button type="button" onClick={() => onClose(true)} className="min-h-11 rounded-xl bg-rose-700 px-3 text-sm font-semibold text-white">Ukloni</button>
      </div>
    </dialog>
  );
}
