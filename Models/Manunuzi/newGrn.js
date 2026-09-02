import mongoose from "mongoose";

const newGrnSchema = new mongoose.Schema(
  {
    // =====================================================
    // GRN IDENTIFIER
    // =====================================================

    stockIdentifier: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // =====================================================
    // GRN ITEMS
    // =====================================================

    items: [
      {
        // -------------------------------------------------
        // ITEM REFERENCE
        // -------------------------------------------------

        name: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "items",
          required: true,
        },

        // -------------------------------------------------
        // BATCH REFERENCE
        // -------------------------------------------------

        // This points to the actual batch created
        // during the GRN process.
        batch: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "batches",
          required: true,
        },

        // -------------------------------------------------
        // RECEIVED QUANTITY
        // -------------------------------------------------

        quantity: {
          type: Number,
          required: true,
          min: 0,
        },

        // -------------------------------------------------
        // PRICING SNAPSHOT
        // -------------------------------------------------

        // Buying price of the batch at receiving time.
        buyingPrice: {
          type: Number,
          required: true,
          min: 0,
        },

        // Selling price of the item at receiving time.
        //
        // This is a historical snapshot.
        // The current selling price lives in Item.price.
        sellingPrice: {
          type: Number,
          min: 0,
        },

        // =================================================
        // BATCH INFORMATION SNAPSHOT
        // =================================================

        batchNumber: {
          type: String,
          trim: true,
        },

        manufactureDate: {
          type: Date,
        },

        expiryDate: {
          type: Date,
        },

        receivedDate: {
          type: Date,
          default: Date.now,
        },

        // =================================================
        // RECEIVING INFORMATION
        // =================================================

        foc: {
          type: Number,
          default: 0,
          min: 0,
        },

        rejected: {
          type: Number,
          default: 0,
          min: 0,
        },

        // =================================================
        // WHOLESALE SNAPSHOT
        // =================================================

        enableWholesale: {
          type: Boolean,
          default: false,
        },

        wholesaleMinQty: {
          type: Number,
          default: 0,
          min: 0,
        },

        wholesalePrice: {
          type: Number,
          default: 0,
          min: 0,
        },

        // =================================================
        // BILLING
        // =================================================

        billedAmount: {
          type: Number,
          default: 0,
          min: 0,
        },

        billedTotalCost: {
          type: Number,
          default: 0,
          min: 0,
        },

        paidAmount: {
          type: Number,
          default: 0,
          min: 0,
        },

        remainingBalance: {
          type: Number,
          default: 0,
          min: 0,
        },

        isFullyPaid: {
          type: Boolean,
          default: false,
        },

        // =================================================
        // OTHER
        // =================================================

        comments: {
          type: String,
          trim: true,
        },

        totalCost: {
          type: Number,
          default: 0,
          min: 0,
        },

        // =================================================
        // GRN ITEM STATUS
        // =================================================

        status: {
          type: String,
          enum: ["Billed", "Completed"],
          default: "Completed",
        },

        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // =====================================================
    // SUPPLIER
    // =====================================================

    supplierName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "supplier",
      required: true,
    },

    // =====================================================
    // DOCUMENT INFORMATION
    // =====================================================

    invoiceNumber: {
      type: String,
      trim: true,
    },

    lpoNumber: {
      type: String,
      trim: true,
    },

    deliveryPerson: {
      type: String,
      trim: true,
    },

    deliveryNumber: {
      type: String,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    // =====================================================
    // RECEIVING DATE
    // =====================================================

    receivingDate: {
      type: Date,
      default: Date.now,
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

// Find GRNs by supplier
newGrnSchema.index({
  supplierName: 1,
});

// Find GRNs by receiving date
newGrnSchema.index({
  receivingDate: -1,
});

// Find GRN items by batch
newGrnSchema.index({
  "items.batch": 1,
});

// Find GRN items by item
newGrnSchema.index({
  "items.name": 1,
});

export default mongoose.model(
  "newGrn",
  newGrnSchema
);