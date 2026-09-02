import mongoose from "mongoose";

const itemsSchema = mongoose.Schema(
  {
    // =====================================================
    // BASIC PRODUCT INFORMATION
    // =====================================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    genericName: {
      type: String,
      trim: true,
    },

    brandName: {
      type: String,
      trim: true,
    },

    manufacturer: {
      type: String,
      trim: true,
    },

    // =====================================================
    // PHARMACY INFORMATION
    // =====================================================

    dosageForm: {
      type: String,
      enum: [
        "Tablet",
        "Capsule",
        "Syrup",
        "Suspension",
        "Injection",
        "Cream",
        "Ointment",
        "Gel",
        "Drops",
        "Inhaler",
        "Suppository",
        "Powder",
        "Solution",
        "Other",
      ],
      default: "Other",
    },

    strength: {
      type: String,
      trim: true,
    },

    routeOfAdministration: {
      type: String,
      trim: true,
    },

    requiresPrescription: {
      type: Boolean,
      default: false,
    },

    // =====================================================
    // RETAIL PRICE
    // =====================================================

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // =====================================================
    // WHOLESALE SETTINGS
    // =====================================================

    wholesalePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    wholesaleMinQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    enableWholesale: {
      type: Boolean,
      default: false,
    },

    // =====================================================
    // CATEGORY
    // =====================================================

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Categories",
      required: true,
    },

    // =====================================================
    // BARCODE
    // =====================================================

    barCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // =====================================================
    // STOCK
    // =====================================================

    // Total stock across all batches.
    // This value is maintained by the system.
    itemQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Minimum stock level before reorder warning.
    reOrder: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =====================================================
    // DISCOUNT
    // =====================================================

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =====================================================
    // PRODUCT STATUS
    // =====================================================

    status: {
      type: String,
      enum: ["Active", "Expired", "Inactive"],
      default: "Active",
    },

    reOrderStatus: {
      type: String,
      enum: ["Low", "Normal"],
      default: "Normal",
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

export default mongoose.model("items", itemsSchema);