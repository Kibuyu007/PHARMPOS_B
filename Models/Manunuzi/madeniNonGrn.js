// Models/Manunuzi/grnPayments.js
import mongoose from "mongoose";

const grnPaymentSchema = new mongoose.Schema(
  {
    grnId: { type: mongoose.Schema.Types.ObjectId, ref: "newGrn" },
    itemId: { type: mongoose.Schema.Types.ObjectId },
    amountPaid: Number,
    remainingBalance: Number,
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  },
  { timestamps: true }
);

export default mongoose.model("grnPayments", grnPaymentSchema);
