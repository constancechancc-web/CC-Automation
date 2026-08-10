import 'dotenv/config';
import express from 'express';
import path from 'path';
import whatsappWebhookRouter from './routes/whatsapp-webhook';
import apiRouter from './routes/api';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(whatsappWebhookRouter);
app.use(apiRouter);

app.listen(PORT, () => {
  console.log(`Property Leads server listening on port ${PORT}`);
  console.log('Mounted: whatsapp-webhook router, api router');
});
