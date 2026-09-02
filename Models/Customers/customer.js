import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    phone: {
      type: String, // use String instead of Number to allow leading zeros, country codes (+255..)
      required: [true, "Phone number is required"],
      match: [/^\+?\d{7,15}$/, "Please enter a valid phone number"],
    },
    address: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Please enter a valid email"],
    },
    company: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Customer", customerSchema);
