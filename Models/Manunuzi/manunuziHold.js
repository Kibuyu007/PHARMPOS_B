import mongoose from "mongoose";

const poSchema = mongoose.Schema(
  {
    grnSessionId: {
      type: String,
      required: true,
    },
    grnNumber: {
      type: String,
      unique: true,
      required: true,
    },
    allItems: [
      {
        item: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "items",
          required: true,
        },
        requiredQuantity: { type: Number, required: true },
        description: { type: String },
      },
    ],
    supplierName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "supplier",
      required: true,
    },

    comments: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },

     lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

export default mongoose.model("po", poSchema);
