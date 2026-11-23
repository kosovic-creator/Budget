export type PlannedItemKind = "addition" | "expectedExpense";

export interface PlannedItem {
  id: string;
  description: string;
  amount: number;
  kind: PlannedItemKind;
}
