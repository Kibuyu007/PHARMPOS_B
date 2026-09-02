import mongoose from "mongoose";

const grnCounterSchema = mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("grnCounter", grnCounterSchema);
