
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Invoice, AIInsight, Customer, PaymentPlan, FollowUp, BankTransaction } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function fetchMockAccountingData(provider: string): Promise<Partial<Invoice>[]> {
  try {
    const prompt = `Generate 8 realistic invoice records for ${provider}. Include an escalationLevel (0-5), balance (remaining amount), and isEmailed (boolean). Amounts should vary between 1000 and 100000. Dates should be between Oct and Nov 2025.`;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              externalId: { type: Type.STRING },
              customerName: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              balance: { type: Type.NUMBER },
              currency: { type: Type.STRING },
              dueDate: { type: Type.STRING },
              status: { type: Type.STRING, enum: ['PENDING', 'OVERDUE', 'PAID', 'DRAFT'] },
              escalationLevel: { type: Type.INTEGER },
              isEmailed: { type: Type.BOOLEAN }
            },
            required: ["externalId", "customerName", "amount", "balance", "dueDate", "status", "escalationLevel", "isEmailed"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [];
  }
}

export async function fetchMockBankData(bankName: string): Promise<BankTransaction[]> {
  try {
    const prompt = `Generate 5 realistic bank transaction records for a business bank account at ${bankName}. 
    Include transaction date, description (use realistic Indian banking terms like NEFT, RTGS, IMPS, UPI, or CHQ), and amount. 
    Status should be 'SUGGESTED' for most, or 'UNMATCHED'.`;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              date: { type: Type.STRING },
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              status: { type: Type.STRING, enum: ['UNMATCHED', 'SUGGESTED', 'RECONCILED'] }
            },
            required: ["id", "date", "description", "amount", "status"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Error fetching bank data:", error);
    return [];
  }
}

export async function generatePaymentPlan(amount: number, customerName: string): Promise<PaymentPlan> {
  try {
    const prompt = `Create a realistic 3-part installment payment plan for a debt of ${amount} INR for ${customerName}. 
    Suggest percentages and dates (1 week apart). Provide a professional reasoning for why this plan helps the customer.`;
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            totalAmount: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
            installments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  percentage: { type: Type.NUMBER },
                  amount: { type: Type.NUMBER },
                  dueDate: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    throw error;
  }
}

export async function generateReminderText(channel: string, customer: string, amount: number, tone: string): Promise<string> {
  try {
    // Highly specific prompt to prevent chatty responses
    const prompt = `
    Act as a professional collections automation system. 
    Write exactly ONE single reminder message for a customer named "${customer}" who owes ${amount} INR.
    
    Channel: ${channel}
    Tone: ${tone}
    
    Constraints:
    1. Output ONLY the raw message body. Do not include "Here is a draft", "Subject:", or quotation marks.
    2. Do NOT provide multiple options. Decide on the single best message based on the tone.
    3. Include a placeholder [PAYMENT_LINK] at the end.
    4. If the channel is WhatsApp or SMS, keep it concise.
    5. If the channel is Email, include a standard greeting and sign-off.
    `;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text?.trim() || "Reminder regarding your invoice.";
  } catch (error) {
    return "Reminder regarding your invoice.";
  }
}

export async function generateReminderAudio(customerName: string, amount: number, dueDate: string, tone: 'soft' | 'firm' = 'soft'): Promise<string | undefined> {
  try {
    const speechText = tone === 'firm' 
      ? `This is a formal and urgent notification from Vasool regarding your significantly overdue payment of ${amount} rupees for ${customerName}. This balance was due on ${dueDate}. Immediate settlement is required to prevent legal escalation or credit score impact. Contact us immediately.`
      : `Hello, this is a friendly reminder from Vasool for ${customerName} regarding your outstanding balance of ${amount} rupees. We noticed the due date of ${dueDate} has passed. Please settle this when you can. Thank you!`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: speechText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: tone === 'firm' ? 'Puck' : 'Kore' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    return undefined;
  }
}

export async function getCashflowInsights(invoices: Invoice[]): Promise<AIInsight[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze these SME invoices and suggest 3 high-impact recovery actions: ${JSON.stringify(invoices)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
              actionLabel: { type: Type.STRING }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [];
  }
}

export async function extractInvoiceFromText(textData: string): Promise<Partial<Invoice>[]> {
  try {
    const extractionPrompt = `Act as a senior accounting auditor. Extract a clean list of EVERY SINGLE valid invoice from the provided data.
    Intelligently map column headers to: customerName, amount, balance, dueDate, status, isEmailed.
    
    Data to process: ${textData}
    
    CRITICAL: 
    1. You MUST process and return every valid row provided in the input. Do not summarize.
    2. Convert all dates to YYYY-MM-DD.
    3. Ensure balance equals amount if balance is missing.
    4. Default currency is INR.`;

    const finalResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: extractionPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              customerName: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              balance: { type: Type.NUMBER },
              dueDate: { type: Type.STRING },
              status: { type: Type.STRING, enum: ['PENDING', 'OVERDUE', 'PAID', 'DRAFT'] },
              isEmailed: { type: Type.BOOLEAN }
            },
            required: ["customerName", "amount", "dueDate"]
          }
        }
      }
    });

    return JSON.parse(finalResponse.text || "[]");
  } catch (error) {
    console.error("AI Extraction Error:", error);
    return [];
  }
}

export async function analyzeCustomerResponse(customerResponse: string): Promise<FollowUp['aiSuggestedNextStep']> {
  try {
    const prompt = `Analyze this customer response to a payment reminder: "${customerResponse}". 
    Suggest the best next step for the SME owner. 
    Possible types: PLAN (if they ask for installments), MESSAGE (if they just need a bit more time), PAUSE (if they dispute), LEGAL (if they are refusing or being hostile).`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, description: "Short title of the action" },
            description: { type: Type.STRING, description: "Detailed reasoning" },
            type: { type: Type.STRING, enum: ['PLAN', 'MESSAGE', 'PAUSE', 'LEGAL'] }
          },
          required: ["action", "description", "type"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return {
      action: "Send Reminder",
      description: "Standard follow-up recommended as AI analysis failed.",
      type: "MESSAGE"
    };
  }
}
