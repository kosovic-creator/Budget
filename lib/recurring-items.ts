export type RecurringItemKind = "fixed" | "subscription";

export interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  kind: RecurringItemKind;
}
