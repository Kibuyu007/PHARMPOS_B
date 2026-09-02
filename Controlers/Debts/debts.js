import Debt from "../../Models/Debts/debts.js";

// Create Debt
export const createDebt = async (req, res) => {
  try {
    const { customerName, phone, totalAmount, debtStatus } = req.body;

    const debt = await Debt.create({
      customerName,
      phone,
      totalAmount,
      remainingAmount: totalAmount,
      status: "pending",
      debtStatus: debtStatus || "Asset", // 👈 added
    });

    res.status(201).json(debt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get All Depts
export const getDebts = async (req, res) => {
  try {
    const debts = await Debt.find().sort({ createdAt: -1 });
    res.json(debts);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

//Get Single Debt
export const getDebtById = async (req, res) => {
  try {
    const debt = await Debt.findById(req.params.id);
    if (!debt) {
      return res.status(404).json({ message: "Debt not found" });
    }
    res.json(debt);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update / Pay Debts
export const addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (amount <= 0) {
      return res.status(400).json({ message: "Invalid payment amount" });
    }

    const debt = await Debt.findById(id);
    if (!debt) return res.status(404).json({ message: "Debt not found" });

    // Deduct amount
    debt.remainingAmount -= amount;

    // Record payment
    debt.payments.push({ amount });

    // Update status
    if (debt.remainingAmount <= 0) {
      debt.remainingAmount = 0;
      debt.status = "cleared";
    }

    await debt.save();
    res.json(debt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Change Debt Status (Asset / Liability)
export const updateDebtStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { debtStatus } = req.body;

    if (!["Asset", "Liability"].includes(debtStatus)) {
      return res.status(400).json({
        message: "Invalid debt status. Must be Asset or Liability",
      });
    }

    const debt = await Debt.findById(id);
    if (!debt) {
      return res.status(404).json({ message: "Debt not found" });
    }

    debt.debtStatus = debtStatus;
    await debt.save();

    res.json({
      message: "Debt status updated successfully",
      debt,
    });
  } catch (error) {
    console.error("Error updating debt status:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete Dept
export const deleteDebt = async (req, res) => {
  try {
    await Debt.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
