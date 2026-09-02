import mongoose from "mongoose";

const depositSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  depositAmount: { type: Number, default: 0 },
  withdrawAmount: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },  // <-- FIX: add running balance
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Deposit", depositSchema);
