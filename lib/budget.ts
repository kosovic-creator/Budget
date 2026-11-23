export interface BudgetSettings {
  household: number;
  personal: number;
  other: number;
  cash: number;
  otp: number;
  nlb: number;
  additions: number;
  expectedExpenses: number;
}

export const emptyBudget: BudgetSettings = {
  household: 0,
  personal: 0,
  other: 0,
  cash: 0,
  otp: 0,
  nlb: 0,
  additions: 0,
  expectedExpenses: 0,
};
