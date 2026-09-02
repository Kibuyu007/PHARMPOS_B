import mongoose from "mongoose";

const outStdReportSchema = new mongoose.Schema(
  {
    grnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "poGrn",
      required: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Items",
      required: true,
    },
    filledQuantity: { type: Number, required: true },
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("outStand", outStdReportSchema);
