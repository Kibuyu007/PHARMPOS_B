import mongoose from "mongoose";

const batchesSchema = mongoose.Schema(
  {
    // =====================================================
    // ITEM
    // =====================================================

    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "items",
      required: true,
      index: true,
    },

    // =====================================================
    // BATCH INFORMATION
    // =====================================================

    batchNumber: {
      type: String,
      required: true,
      trim: true,
    },

    // =====================================================
    // BUYING PRICE
    // =====================================================

    // Actual price paid for this particular batch.
    buyingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // =====================================================
    // STOCK
    // =====================================================

    // Quantity received when this batch was created.
    quantityReceived: {
      type: Number,
      required: true,
      min: 0,
    },

    // Current remaining quantity.
    // This decreases when medicines are sold.
    quantityRemaining: {
      type: Number,
      required: true,
      min: 0,
    },

    // =====================================================
    // DATES
    // =====================================================

    manufactureDate: {
      type: Date,
    },

    expireDate: {
      type: Date,
      required: true,
    },

    // =====================================================
    // SUPPLIER
    // =====================================================

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Suppliers",
    },

    // =====================================================
    // STATUS
    // =====================================================

    status: {
      type: String,
      enum: ["Active", "Expired", "Depleted"],
      default: "Active",
    },

    // =====================================================
    // AUDIT
    // =====================================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },

    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
  },
  {
    timestamps: true,
  }
);

// =========================================================
// INDEXES
// =========================================================

// Find all batches for an item
batchesSchema.index({
  item: 1,
});

// FEFO:
// Find batches by earliest expiry date
batchesSchema.index({
  item: 1,
  expireDate: 1,
});

// Prevent duplicate batch numbers
// for the same medicine
batchesSchema.index(
  {
    item: 1,
    batchNumber: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.model("batches", batchesSchema);