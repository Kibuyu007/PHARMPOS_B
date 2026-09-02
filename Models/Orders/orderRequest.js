import mongoose from "mongoose";

const requestItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "items",
      required: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected"],
      default: "Pending",
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const amendmentItemSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "items" },
    itemName: String,
    quantity: Number,
  },
  { _id: false },
);

const amendmentHistorySchema = new mongoose.Schema(
  {
    cycle: { type: Number, required: true },
    amendedAt: { type: Date, default: Date.now },
    customerComment: { type: String, default: "" },
    previousItems: [amendmentItemSchema],
    newItems: [amendmentItemSchema],
    previousRequestedDeliveryDate: Date,
    newRequestedDeliveryDate: Date,
  },
  { _id: false },
);

const timelineSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    description: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    actor: {
      type: String,
      enum: ["Customer", "Staff", "System"],
      required: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const requestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true, index: true },

    requestedDeliveryDate: { type: Date, required: true },
    approvedDeliveryDate: { type: Date, default: null },
    deliveryDateChanged: { type: Boolean, default: false },
    deliveryDateChangeReason: { type: String, default: "", trim: true },

    items: {
      type: [requestItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: "Request must contain at least one item",
      },
    },

    notes: { type: String, default: "", trim: true },
    source: {
      type: String,
      enum: ["Website", "WhatsApp", "Manual"],
      default: "Website",
    },

    status: {
      type: String,
      enum: [
        "Pending Review",
        "Awaiting Customer Confirmation",
        "Accepted",
        "Converted",
        "Collected",
        "Cancelled",
        "Rejected",
      ],
      default: "Pending Review",
    },
    readyForPickupAt: {
      type: Date,
      default: null,
    },
    collectedAt: {
      type: Date,
      default: null,
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },

    customerAction: {
      type: String,
      enum: ["Waiting", "Accepted", "Requested Amendment"],
      default: "Waiting",
    },

    reviewCycle: { type: Number, default: 1 },
    amendmentHistory: [amendmentHistorySchema],
    timeline: [timelineSchema],

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "orders",
      default: null,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, default: "", trim: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Helper method
requestSchema.methods.addTimeline = function (
  action,
  description,
  actor,
  performedBy = null,
) {
  this.timeline.push({ action, description, actor, performedBy });
};

// ✅ Add compound indexes for better performance
requestSchema.index({ status: 1, createdAt: -1 });
requestSchema.index({ customerPhone: 1, status: 1 });
requestSchema.index({ isDeleted: 1 });

export default mongoose.model("requests", requestSchema);
