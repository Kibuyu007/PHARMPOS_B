import mongoose from "mongoose";

const receiptSchema = mongoose.Schema({

  pdfContent: {
    type: String,
    required: true,
  },
  
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "sales",
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },

});

export default mongoose.model("pdf", receiptSchema);
