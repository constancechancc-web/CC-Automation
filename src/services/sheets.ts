import { google, sheets_v4 } from 'googleapis';

export const SHEET_RANGE = 'Sheet1!A:I';

export const COLUMNS = {
  DATE: 0,
  CONTACT_NO: 1,
  NAME: 2,
  REQUIREMENT: 3,
  BUDGET: 4,
  REMARK: 5,
  SOURCE: 6,
  STATUS: 7,
  LAST_FOLLOW_UP_DATE: 8,
} as const;

export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

let cachedSheets: sheets_v4.Sheets | null = null;

export function getSheetsClient(): sheets_v4.Sheets {
  if (cachedSheets) return cachedSheets;

  const auth = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    ? new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      })
    : new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

  cachedSheets = google.sheets({ version: 'v4', auth });
  return cachedSheets;
}
