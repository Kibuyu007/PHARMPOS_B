import express from "express";
import {
  allTransactions,
  billedTransactions,
  getBilledWallet,
  mostSoldItems,
  payBilledTransaction,
  storeTransaction,  
} from "../../Controlers/Transactions/sales.js";
import {
  dashboardCards,
  profitReport,
} from "../../Controlers/Dashboard/dashboard.js";
import { verifyUser } from "../../Middleware/verifyToken.js";

const router = express.Router();

router.post("/sales", verifyUser, storeTransaction);
router.get("/bill", billedTransactions);
router.patch("/payBill/:id", verifyUser, payBilledTransaction);
router.get("/all", allTransactions);
router.get("/mostSold", mostSoldItems);
router.get("/walletBill", getBilledWallet);
router.get("/dashboard", dashboardCards);
router.get("/profitReport", profitReport);

export default router;
