import Deposit from "../../Models/Customers/wallet.js";
import Sales from "../../Models/Transactions/sales.js";
import Customer from "../../Models/Customers/customer.js";

// Deposit money
const depozit = async (req, res) => {
  try {
    const { customerId, depositAmount } = req.body;

    // Get latest balance
    const lastTransaction = await Deposit.findOne({ customerId }).sort({
      createdAt: -1,
    });

    const prevBalance = lastTransaction ? lastTransaction.balance : 0;
    const newBalance = prevBalance + depositAmount;

    const deposit = new Deposit({
      customerId,
      depositAmount,
      balance: newBalance,
      createdBy: req.userId,
    });

    await deposit.save();
    res.json({ success: true, balance: newBalance, deposit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Withdraw money
const withDraw = async (req, res) => {
  try {
    const { customerId, withdrawAmount } = req.body;

    const lastTransaction = await Deposit.findOne({ customerId }).sort({
      createdAt: -1,
    });

    const prevBalance = lastTransaction ? lastTransaction.balance : 0;

    if (withdrawAmount > prevBalance) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const newBalance = prevBalance - withdrawAmount;

    const withdraw = new Deposit({
      customerId,
      withdrawAmount,
      balance: newBalance,
      createdBy: req.userId,
    });

    await withdraw.save();
    res.json({ success: true, balance: newBalance, withdraw });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get current balance
const getCurrentBalance = async (req, res) => {
  try {
    const { id } = req.params; // <-- FIX: use id, not customerId

    const lastTransaction = await Deposit.findOne({ customerId: id }).sort({
      createdAt: -1,
    });

    const balance = lastTransaction ? lastTransaction.balance : 0;

    res.json({ success: true, balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Pay bills
const payBill = async (req, res) => {
  try {
    const { customerId } = req.body;

    // Get customer's current balance from wallet
    const lastTransaction = await Deposit.findOne({ customerId }).sort({
      createdAt: -1,
    });
    const currentBalance = lastTransaction ? lastTransaction.balance : 0;

    if (currentBalance <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "No available balance to pay bills" });
    }

    // find bills with status 'Bill' for this customer
    const bills = await Sales.find({
      loyalCustomer: customerId,
      status: "Bill",
    }).sort({ createdAt: 1 }); // oldest first

    if (!bills.length) {
      return res
        .status(404)
        .json({ success: false, message: "No pending bills found" });
    }

    let remaining = currentBalance;

    for (let bill of bills) {
      if (remaining <= 0) break;

      const alreadyPaid = bill.paidAmount || 0;
      const pendingAmount = bill.totalAmount - alreadyPaid;

      if (remaining >= pendingAmount) {
        bill.paidAmount = bill.totalAmount;
        bill.status = "Paid";
        remaining -= pendingAmount;
      } else {
        bill.paidAmount = alreadyPaid + remaining;
        bill.status = "Bill"; // still partially pending
        remaining = 0;
      }

      await bill.save();
    }

    // Record deduction in wallet
    const deductionTransaction = new Deposit({
      customerId,
      withdrawAmount: currentBalance,
      balance: 0,
      createdBy: req.userId,
    });

    await deductionTransaction.save();

    // 🔑 Fetch updated bills + balance to return
    const updatedBills = await Sales.find({ loyalCustomer: customerId });
    const newLastTx = await Deposit.findOne({ customerId }).sort({
      createdAt: -1,
    });
    const newBalance = newLastTx ? newLastTx.balance : 0;

    res.json({
      success: true,
      message: "Payment processed successfully using wallet balance",
      updatedBills,
      balance: newBalance,
    });
  } catch (err) {
    console.error("Error paying bill:", err);
    res.status(500).json({ error: err.message });
  }
};


// Report of all deposits & withdrawals for a customer
const getCustomerReport = async (req, res) => {
  try {
    const { id } = req.params; // customerId

    // Fetch all transactions (both deposit & withdraw) for this customer
    const transactions = await Deposit.find({ customerId: id })
      .sort({ createdAt: -1 }) // latest first
      .populate("createdBy", "name email"); // optional: show who performed

    if (!transactions || transactions.length === 0) {
      return res.status(404).json({ message: "No transactions found" });
    }

    // Calculate totals
    const totalDeposits = transactions.reduce(
      (sum, tx) => sum + (tx.depositAmount || 0),
      0
    );
    const totalWithdrawals = transactions.reduce(
      (sum, tx) => sum + (tx.withdrawAmount || 0),
      0
    );

    res.json({
      customerId: id,
      totalDeposits,
      totalWithdrawals,
      balance: totalDeposits - totalWithdrawals,
      transactions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export { depozit, withDraw, payBill, getCurrentBalance, getCustomerReport };
