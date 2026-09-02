import express from 'express';
import { retrieveReceipt, uploadSalesReceipt } from '../../Controlers/Transactions/Receipts/receipt.js';
import {  printReceipt } from '../../Controlers/Transactions/sales.js';




const router = express.Router();

router.post('/salesReceipt', uploadSalesReceipt);
router.get('/showSalesReceipt/:pdfName', retrieveReceipt);
router.get('/:id/receipt', printReceipt);

export default router;