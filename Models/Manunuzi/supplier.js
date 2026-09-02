import mongoose from "mongoose";

const supplierSchema = mongoose.Schema({
  supplierName: {
    type: String,
    required: true
  },
  phone: {
    type: Number,
    required: true
  },

  address: {
    type: String,
  },

  email: {
    type: String,
  },

  company: {
    type: String,
  },

  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
 
}, { timestamps: true });

export default mongoose.model('supplier', supplierSchema);
