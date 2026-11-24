export type PlannedItemKind = "addition" | "expectedExpense";
export type PlannedExpenseCategory = "household" | "personal";

export interface PlannedItem {
  id: string;
  description: string;
  amount: number;
  kind: PlannedItemKind;
  expenseCategory: PlannedExpenseCategory | null;
}
