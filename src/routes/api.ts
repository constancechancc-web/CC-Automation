import { Router, Request, Response } from 'express';
import { COLUMNS, SHEET_RANGE, getSheetsClient, todayString } from '../services/sheets';

const router = Router();

interface Lead {
  date: string;
  contactNo: string;
  name: string;
  requirement: string;
  budget: string;
  remark: string;
  source: string;
  status: string;
  lastFollowUpDate: string;
}

function rowToLead(row: any[]): Lead {
  return {
    date: row[COLUMNS.DATE] || '',
    contactNo: row[COLUMNS.CONTACT_NO] || '',
    name: row[COLUMNS.NAME] || '',
    requirement: row[COLUMNS.REQUIREMENT] || '',
    budget: row[COLUMNS.BUDGET] || '',
    remark: row[COLUMNS.REMARK] || '',
    source: row[COLUMNS.SOURCE] || '',
    status: row[COLUMNS.STATUS] || '',
    lastFollowUpDate: row[COLUMNS.LAST_FOLLOW_UP_DATE] || '',
  };
}

router.get('/api/leads', async (_req: Request, res: Response) => {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: SHEET_RANGE });
    const rows = result.data.values || [];
    const leads = rows.slice(1).map(rowToLead).reverse();
    res.json(leads);
  } catch (err) {
    console.error('Failed to fetch leads:', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

router.patch('/api/leads/:contactNo', async (req: Request, res: Response) => {
  try {
    const { contactNo } = req.params;
    const { status } = req.body;
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: SHEET_RANGE });
    const rows = result.data.values || [];

    let matchedRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][COLUMNS.CONTACT_NO] === contactNo) {
        matchedRowIndex = i;
        break;
      }
    }

    if (matchedRowIndex === -1) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const sheetRowNumber = matchedRowIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Sheet1!H${sheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[status]] },
    });

    const updatedRow = rows[matchedRowIndex];
    updatedRow[COLUMNS.STATUS] = status;
    res.json(rowToLead(updatedRow));
  } catch (err) {
    console.error('Failed to update lead:', err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

router.post('/api/leads', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;
    const today = todayString();

    const newRow = [
      today,
      body.contactNo || '',
      body.name || '',
      body.requirement || '',
      body.budget || '',
      body.remark || '',
      body.source || '',
      body.status || 'New Enquiry',
      today,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: SHEET_RANGE,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [newRow] },
    });

    res.status(201).json(rowToLead(newRow));
  } catch (err) {
    console.error('Failed to add lead:', err);
    res.status(500).json({ error: 'Failed to add lead' });
  }
});

export default router;
