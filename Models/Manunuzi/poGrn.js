import mongoose from "mongoose";

const poGrnSchema = new mongoose.Schema(
  {
    stockIdentifier: { type: String, required: true },
    items: [
      {
        name: { type: mongoose.Schema.Types.ObjectId, ref: "items" },
        requiredQuantity: { type: Number },
        receivedQuantity: { type: Number },
        outstandingQuantity: { type: Number },
        newBuyingPrice: { type: Number },
        newSellingPrice: { type: Number },
        batchNumber: { type: String },
        manufactureDate: { type: Date },
        expiryDate: { type: Date },
        receivedDate: { type: Date },
        foc: { type: String },
        rejected: { type: String },
        billedAmount: { type: Number },
        comments: { type: String },
        totalCost: { type: Number },
        requiredQuantity: { type: Number },
        status: {
          type: String,
          enum: ["Billed", "Completed"],
          default: "Completed",
        },
      },
    ],
    supplierName: { type: mongoose.Schema.Types.ObjectId, ref: "supplier" },
    invoiceNumber: { type: String },
    lpoNumber: { type: String },
    deliveryPerson: { type: String },
    deliveryNumber: { type: String },
    description: { type: String },
    receivingDate: { type: Date },
    createdBy: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "Users",
         required: false,
       },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    grnNumber: { type: String, unique: true },
  },
  { timestamps: true }
);

export default mongoose.model("poGrn", poGrnSchema);
