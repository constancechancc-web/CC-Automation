import 'dotenv/config';

import { Router, Request, Response } from 'express';
import { COLUMNS, SHEET_RANGE, getSheetsClient, todayString } from '../services/sheets';

const router = Router();

export interface ExtractedLeadInfo {
  name: string;
  requirement: string;
  budget: string;
  remark: string;
  source: string | null;
}

export function extractLeadInfo(messageText: string): ExtractedLeadInfo {
  const nameMatch = messageText.match(/\b(?:i am|i'm|my name is|this is)\s+([A-Z][a-zA-Z]*)/i);
  const name = nameMatch ? nameMatch[1] : '';

  const transactionMatch = messageText.match(/\b(rent|renting|buy|buying|purchase)\b/i);
  let transactionType = '';
  if (transactionMatch) {
    transactionType = transactionMatch[1].toLowerCase().startsWith('rent') ? 'Rent' : 'Buy';
  }

  const propertyMatch = messageText.match(
    /\b(condo(?:minium)?|apartment|studio|bungalow|townhouse|villa|terrace(?: house)?|semi-d|house|land|office|shop(?:lot)?|unit)\b/i
  );
  const propertyType = propertyMatch ? propertyMatch[1] : '';

  const areaMatch = messageText.match(
    /\bin\s+([A-Za-z][A-Za-z\s]{1,30}?)(?=[,.!]|\s+\d|\s+(?:budget|around|for|from)\b|$)/i
  );
  const area = areaMatch ? areaMatch[1].trim() : '';

  const requirementParts = [transactionType, propertyType, area ? `in ${area}` : ''].filter(Boolean);
  const requirement = requirementParts.length ? requirementParts.join(' ') : 'Not specified';

  const currencyBudgetMatch = messageText.match(/\b(RM|USD|SGD|MYR|\$)\s?([\d,]+(?:\.\d+)?)/i);
  let budget = 'Not specified';
  if (currencyBudgetMatch) {
    budget = `${currencyBudgetMatch[1].toUpperCase()} ${currencyBudgetMatch[2]}`;
  } else {
    const bareBudgetMatch = messageText.match(/\bbudget\s+([\d,]+(?:\.\d+)?)\b/i);
    if (bareBudgetMatch) {
      budget = bareBudgetMatch[1];
    }
  }

  const sourceMatch = messageText.match(/interested in .*? from ([^.,!\n]+)/i);
  const source = sourceMatch ? sourceMatch[1].trim() : null;

  return { name, requirement, budget, remark: messageText, source };
}

router.get('/webhook/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    res.status(200).type('text/plain').send(String(challenge ?? ''));
  } else {
    res.sendStatus(403);
  }
});

router.post('/webhook/whatsapp', (req: Request, res: Response) => {
  res.sendStatus(200);
  void handleIncomingMessages(req.body);
});

async function handleIncomingMessages(body: any): Promise<void> {
  try {
    const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!Array.isArray(messages) || messages.length === 0) return;

    const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;
    const sheets = getSheetsClient();

    for (const message of messages) {
      const from: string | undefined = message?.from;
      const text: string | undefined = message?.text?.body;
      if (!from || !text) continue;

      const extracted = extractLeadInfo(text);
      const today = todayString();

      const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: SHEET_RANGE });
      const rows = result.data.values || [];

      let matchedRowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][COLUMNS.CONTACT_NO] === from) {
          matchedRowIndex = i;
          break;
        }
      }

      if (matchedRowIndex >= 0) {
        const sheetRowNumber = matchedRowIndex + 1;
        const existingRow = rows[matchedRowIndex];
        const existingRemark = existingRow[COLUMNS.REMARK] || '';
        const newRemark = existingRemark
          ? `${existingRemark}\n[${today}] ${extracted.remark}`
          : `[${today}] ${extracted.remark}`;
        const newSource = extracted.source || existingRow[COLUMNS.SOURCE] || '';
        const existingStatus = existingRow[COLUMNS.STATUS] || 'New Enquiry';

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Sheet1!F${sheetRowNumber}:I${sheetRowNumber}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[newRemark, newSource, existingStatus, today]],
          },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: SHEET_RANGE,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [
              [
                today,
                from,
                extracted.name,
                extracted.requirement,
                extracted.budget,
                extracted.remark,
                extracted.source || '',
                'New Enquiry',
                today,
              ],
            ],
          },
        });
      }
    }
  } catch (err) {
    console.error('Failed to process WhatsApp webhook payload:', err);
  }
}

export async function sendWhatsAppMessage(toPhone: string, body: string): Promise<void> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toPhone,
      type: 'text',
      text: { body },
    }),
  });
}

export default router;
