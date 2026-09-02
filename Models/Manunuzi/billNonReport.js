import mongoose from "mongoose";

const billNonReportSchema = new mongoose.Schema(
{
    grnId: { type: mongoose.Schema.Types.ObjectId, ref: "newGrn" },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "newGrn.items" }, // Changed ref for clarity, using embedded document _id
    itemName: String,
    grnNumber: String, // You might want to populate this from grnId or add it during creation
    buyingPrice: Number,
    oldStatus: String,
    supplier: String,
    newStatus: { type: String, default: "Billed" }, // Set default to Billed
    billedAmount: Number,
    billedTotalCost: Number,

    // ADD PAYMENT FIELDS HERE
    paidAmount: { type: Number, default: 0 }, // How much has been paid so far
    remainingBalance: { type: Number, required: true }, // Must be set on creation
    isFullyPaid: { type: Boolean, default: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: false,
    },
    changedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("billedNon", billNonReportSchema);