
import { Invoice } from "../types";
import { fetchMockAccountingData } from "./gemini";

export type AccountingProvider = 'Zoho' | 'QuickBooks' | 'Tally' | 'Zerobooks';

export interface ProviderConfig {
  id: AccountingProvider;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export const PROVIDERS: ProviderConfig[] = [
  { 
    id: 'Zoho', 
    name: 'Zoho Books', 
    icon: 'fa-book-bookmark', 
    color: 'text-blue-600', 
    description: 'Direct integration with Zoho India/Global ledgers.' 
  },
  { 
    id: 'QuickBooks', 
    name: 'QuickBooks', 
    icon: 'fa-bolt', 
    color: 'text-emerald-500', 
    description: 'Two-way sync with Intuit QuickBooks Online.' 
  },
  { 
    id: 'Tally', 
    name: 'Tally Prime', 
    icon: 'fa-file-invoice-dollar', 
    color: 'text-orange-500', 
    description: 'Cloud bridge for Tally Prime and ERP 9.' 
  },
  { 
    id: 'Zerobooks', 
    name: 'Zerobooks', 
    icon: 'fa-calculator', 
    color: 'text-slate-900', 
    description: 'Sync with Xero and Zerobooks cloud accounting.' 
  }
];

/**
 * Simulates a successful OAuth handshake completion.
 */
export const connectProvider = async (providerId: AccountingProvider): Promise<boolean> => {
  // Simulate the token exchange and profile fetching
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Store a mock token with metadata
  const sessionData = {
    accessToken: `auth_v2_tk_${Math.random().toString(36).substring(7)}`,
    connectedAt: new Date().toISOString(),
    scopes: ['read_all', 'write_logs', 'partner_sync']
  };
  
  localStorage.setItem(`vasool_oauth_${providerId.toLowerCase()}`, JSON.stringify(sessionData));
  return true;
};

/**
 * Fetches realistic data using Gemini to simulate a live API response from a connected cloud source.
 */
export const syncProviderData = async (providerId: AccountingProvider): Promise<Partial<Invoice>[]> => {
  // Check if session exists (simulating token validation)
  if (!isProviderConnected(providerId)) {
    throw new Error("UNAUTHORIZED: No active OAuth session found for " + providerId);
  }
  
  // High fidelity mock data pull
  return await fetchMockAccountingData(providerId);
};

export const isProviderConnected = (providerId: AccountingProvider): boolean => {
  return !!localStorage.getItem(`vasool_oauth_${providerId.toLowerCase()}`);
};

export const disconnectProvider = (providerId: AccountingProvider) => {
  localStorage.removeItem(`vasool_oauth_${providerId.toLowerCase()}`);
};
