import mongoose from "mongoose";

const salesSchema = mongoose.Schema(
  {
    saleType: {
      type: String,
      enum: ["Retail", "Wholesale"],
      default: "Retail",
    },

    items: [
      {
        item: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "items",
          required: true,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },

        price: {
          type: Number,
          required: true,
          min: 0,
        },

        priceType: {
          type: String,
          enum: ["Retail", "Wholesale"],
          default: "Retail",
        },

        buyingPrice: {
          type: Number,
          required: true,
          default: 0,
          min: 0,
        },

        discount: {
          type: Number,
          default: 0,
          min: 0,
        },

        subtotal: {
          type: Number,
          required: true,
          min: 0,
        },

        // Track which order item this fulfills (if applicable)
        orderItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "orders.items",
          default: null,
        },
      },
    ],

    subTotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    tradeDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalBuyingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    grossProfit: {
      type: Number,
      default: 0,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "orders",
      default: null,
    },

    customerDetails: {
      name: {
        type: String,
        default: "Walk-in Customer",
        trim: true,
      },
      phone: {
        type: String,
        default: "",
        trim: true,
      },
    },

    loyalCustomer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    status: {
      type: String,
      enum: ["Paid", "Bill"],
      default: "Paid",
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["Cash", "Mobile Money", "Bank Transfer", "Credit", "Other"],
      default: "Cash",
    },

    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for balance (remaining amount to pay)
salesSchema.virtual("balance").get(function () {
  return Math.max(0, this.totalAmount - this.paidAmount);
});

// Virtual for profit margin percentage
salesSchema.virtual("profitMargin").get(function () {
  if (this.totalAmount === 0) return 0;
  return ((this.grossProfit / this.totalAmount) * 100).toFixed(2);
});

// Index for better query performance
salesSchema.index({ createdAt: -1 });
salesSchema.index({ status: 1 });
salesSchema.index({ "customerDetails.name": 1 });
salesSchema.index({ loyalCustomer: 1 });

export default mongoose.model("sales", salesSchema);