import path from "path";
import fs from "fs";
import pdf from '../../../Models/Transactions/receipt.js';
import { fileURLToPath } from 'url';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const uploadSalesReceipt = async (req, res) => {
    const { pdfName, pdfContent } = req.body;
  
    const newPdf = new pdf({ pdfName, pdfContent });
  
    try {
      await newPdf.save();
      return res.status(200).json({ message: "Receipt Uploaded" });
    } 
    
    catch (error) {
      console.error("Error storing PDF metadata:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  
  export const retrieveReceipt = async (req, res) => {
    
    const { pdfName } = req.params;
  
    pdf.findOne({ pdfName }, (err, pdfDoc) => {
      if (err) {
        console.error("Error retrieving PDF from database:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
  
      if (pdfDoc && pdfDoc.pdfContent) {
        // Save the base64 content to a file
        const filePath = path.join(__dirname, "pdfs", pdfName);
        fs.writeFileSync(filePath, pdfDoc.pdfContent, { encoding: "base64" });
  
        // Send the file
        return res.sendFile(filePath);
      } else {
        return res.status(404).json({ error: "PDF not found" });
      }
    });
  };


  export const getReceipt = async (req, res) => {
    const pdfPath = path.join(__dirname, '../pdfs', 'Payment_Receipt_receipt.pdf');
    return res.sendFile(pdfPath);
  }
