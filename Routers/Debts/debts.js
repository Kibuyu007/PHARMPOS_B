import express from "express";
import {
  createDebt,
  getDebts,
  getDebtById,
  addPayment,
  deleteDebt,
  updateDebtStatus
} from "../../Controlers/Debts/debts.js";

const router = express.Router();

router.post("/addDebt", createDebt);
router.get("/allDebts", getDebts);
router.get("/oneDebt/:id", getDebtById);
router.post("/payDebt/:id", addPayment);
router.delete("/deleteDebts/:id", deleteDebt);
router.put("/updateDebt/:id", updateDebtStatus);

export default router;
