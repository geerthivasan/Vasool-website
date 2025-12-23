
import { Invoice, EscalationLevel, EscalationProtocol } from "../types";

export const DEFAULT_PROTOCOL: EscalationProtocol = {
  level1Days: 5,
  level1Channel: ['EMAIL'],
  level2Days: 15,
  level2Channel: ['WHATSAPP'],
  level3Days: 30,
  level3Channel: ['WHATSAPP', 'EMAIL'],
  level4Days: 60,
  level4Channel: ['CALL'],
  level5Days: 90,
  level5Channel: ['CALL', 'WHATSAPP'],
  riskHighAmount: 100000,
  riskHighDays: 60,
  riskMediumAmount: 25000,
  riskMediumDays: 30
};

export const getEffectiveStatus = (invoice: Invoice): 'PAID' | 'OVERDUE' | 'PENDING' => {
  if (invoice.status === 'PAID') return 'PAID';
  const dueDate = new Date(invoice.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dueDate < today) return 'OVERDUE';
  return 'PENDING';
};

/**
 * Calculates the Escalation Level (0-5) based on the number of days since/until the due date,
 * strictly following the Escalation Matrix thresholds.
 */
export const calculateEscalationLevel = (invoice: Invoice, protocol: EscalationProtocol = DEFAULT_PROTOCOL): EscalationLevel => {
  if (invoice.status === 'PAID') return EscalationLevel.LEVEL_0;
  
  const dueDate = new Date(invoice.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Stage 1: Friendly Nudge (Pre-due window)
  if (diffDays <= 0 && diffDays >= -protocol.level1Days) return EscalationLevel.LEVEL_1;
  
  // Future invoices not yet in nudge range
  if (diffDays < -protocol.level1Days) return EscalationLevel.LEVEL_0;

  // Overdue stages (diffDays > 0)
  if (diffDays > 0 && diffDays <= protocol.level2Days) return EscalationLevel.LEVEL_2;
  if (diffDays > protocol.level2Days && diffDays <= protocol.level3Days) return EscalationLevel.LEVEL_3;
  if (diffDays > protocol.level3Days && diffDays <= protocol.level4Days) return EscalationLevel.LEVEL_4;
  if (diffDays > protocol.level4Days) return EscalationLevel.LEVEL_5;

  return EscalationLevel.LEVEL_0;
};

/**
 * Categorizes an invoice/customer into a Risk Bucket based on the Risk Matrix thresholds.
 */
export const calculateDynamicRisk = (totalOutstanding: number, maxOverdueDays: number, protocol: EscalationProtocol): 'low' | 'medium' | 'high' => {
  if (totalOutstanding >= protocol.riskHighAmount || maxOverdueDays >= protocol.riskHighDays) return 'high';
  if (totalOutstanding >= protocol.riskMediumAmount || maxOverdueDays >= protocol.riskMediumDays) return 'medium';
  return 'low';
};

export const getEscalationColor = (level: EscalationLevel) => {
  switch(level) {
    case EscalationLevel.LEVEL_1: return 'bg-blue-500';
    case EscalationLevel.LEVEL_2: return 'bg-emerald-500';
    case EscalationLevel.LEVEL_3: return 'bg-amber-500';
    case EscalationLevel.LEVEL_4: return 'bg-orange-600';
    case EscalationLevel.LEVEL_5: return 'bg-red-600';
    default: return 'bg-slate-200';
  }
};

export const getLevelChannel = (level: EscalationLevel, protocol: EscalationProtocol): string => {
  const channels = (() => {
    switch(level) {
      case EscalationLevel.LEVEL_1: return protocol.level1Channel;
      case EscalationLevel.LEVEL_2: return protocol.level2Channel;
      case EscalationLevel.LEVEL_3: return protocol.level3Channel;
      case EscalationLevel.LEVEL_4: return protocol.level4Channel;
      case EscalationLevel.LEVEL_5: return protocol.level5Channel;
      default: return ['EMAIL'];
    }
  })();
  // Default to first selected channel for automated triggers
  return channels && channels.length > 0 ? channels[0] : 'EMAIL';
};
