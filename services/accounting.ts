
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
 * Simulates a connection process without refreshing the page.
 * In a real app, this would handle the OAuth handshake.
 */
export const connectProvider = async (providerId: AccountingProvider): Promise<boolean> => {
  // Simulate network latency for "Authentication"
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Store a mock token to represent a "Connected" state
  localStorage.setItem(`${providerId.toLowerCase()}_access_token`, `mock_token_${Date.now()}`);
  return true;
};

/**
 * Fetches realistic data using Gemini to simulate a live API response.
 */
export const syncProviderData = async (providerId: AccountingProvider): Promise<Partial<Invoice>[]> => {
  return await fetchMockAccountingData(providerId);
};

export const isProviderConnected = (providerId: AccountingProvider): boolean => {
  return !!localStorage.getItem(`${providerId.toLowerCase()}_access_token`);
};

export const disconnectProvider = (providerId: AccountingProvider) => {
  localStorage.removeItem(`${providerId.toLowerCase()}_access_token`);
};
