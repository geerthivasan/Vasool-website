
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

// User interface for authenticated session tracking
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  businessName: string;
  mfaEnabled: boolean;
  avatarUrl: string;
}

export enum EscalationLevel {
  LEVEL_0 = 0,
  LEVEL_1 = 1,
  LEVEL_2 = 2,
  LEVEL_3 = 3,
  LEVEL_4 = 4,
  LEVEL_5 = 5
}

export type CommChannel = 'WHATSAPP' | 'EMAIL' | 'SMS' | 'CALL' | 'MANUAL';

export interface EscalationProtocol {
  level1Days: number;
  level1Channel: CommChannel[];
  level2Days: number;
  level2Channel: CommChannel[];
  level3Days: number;
  level3Channel: CommChannel[];
  level4Days: number;
  level4Channel: CommChannel[];
  level5Days: number;
  level5Channel: CommChannel[];
  // Risk Matrix Configuration
  riskHighAmount: number;
  riskHighDays: number;
  riskMediumAmount: number;
  riskMediumDays: number;
}

export interface StageContact {
  name: string;
  email: string;
  phone: string;
}

export interface ManualLog {
  date: string;
  note: string;
  performedBy: string;
}

export interface Invoice {
  id: string;
  externalId?: string;
  source?: 'MANUAL' | 'EXCEL' | 'ZOHO' | 'QUICKBOOKS' | 'TALLY' | 'ZEROBOOKS' | 'BANK_RECON';
  customerName: string;
  amount: number;
  balance: number;
  currency: string;
  dueDate: string;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'DRAFT';
  isEmailed: boolean;
  probabilityOfPayment: number;
  manualLogs: ManualLog[];
  escalationLevel: EscalationLevel;
}

export interface Customer {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  totalOutstanding: number;
  riskLevel: 'low' | 'medium' | 'high';
  lastFollowUp: string;
  currentEscalation: EscalationLevel;
  aiEnabled: boolean;
  stageContacts: Record<number, StageContact>;
}

export interface FollowUp {
  id: string;
  customerId: string;
  customerName: string;
  type: CommChannel;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'REPLIED' | 'FAILED' | 'IN_PROGRESS' | 'LOGGED';
  timestamp: string;
  message: string;
  customerResponse?: string;
  aiSuggestedNextStep?: {
    action: string;
    description: string;
    type: 'PLAN' | 'MESSAGE' | 'PAUSE' | 'LEGAL';
  };
  escalationLevel: EscalationLevel;
}

export interface PaymentPlan {
  totalAmount: number;
  installments: {
    percentage: number;
    amount: number;
    dueDate: string;
  }[];
  reasoning: string;
}

export interface AIInsight {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  actionLabel: string;
}

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  matchedInvoiceId?: string;
  status: 'UNMATCHED' | 'SUGGESTED' | 'RECONCILED';
}
