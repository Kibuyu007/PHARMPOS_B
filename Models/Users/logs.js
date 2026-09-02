import mongoose from "mongoose";

const logsSchema = mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    action: { type: String, required: true },
    details: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  
);

export default mongoose.model("logs", logsSchema);
