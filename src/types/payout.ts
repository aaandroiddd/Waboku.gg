export interface PayoutData {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'in_transit';
  arrival_date: number;
  created: number;
  description?: string;
  failure_code?: string;
  failure_message?: string;
  method: string;
  type: string;
}

export interface TransferData {
  id: string;
  amount: number;
  currency: string;
  created: number;
  description?: string;
  metadata: Record<string, string>;
}

export interface BalanceData {
  amount: number;
  currency: string;
  source_types?: Record<string, number>;
}

export interface PayoutSummary {
  totalEarnings: number;
  totalPayouts: number;
  availableBalance: number;
  pendingBalance: number;
}

export interface PayoutSchedule {
  delay_days: string | number;
  interval: 'manual' | 'daily' | 'weekly' | 'monthly';
  monthly_anchor?: number;
  weekly_anchor?: string;
}

export interface AccountDetails {
  country: string;
  default_currency: string;
  payouts_enabled: boolean;
  charges_enabled: boolean;
}

export interface PayoutResponse {
  balance: {
    available: BalanceData[];
    pending: BalanceData[];
  };
  payouts: PayoutData[];
  pendingPayouts: PayoutData[];
  transfers: TransferData[];
  summary: PayoutSummary;
  payoutSchedule: PayoutSchedule;
  accountDetails: AccountDetails;
}