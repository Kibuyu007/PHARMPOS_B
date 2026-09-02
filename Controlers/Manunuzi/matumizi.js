import Expense from "../../Models/Manunuzi/matumizi.js";



//Cretae Expenses Matumizi ya Siku
export const createExpense = async (req, res) => {
  try {
    const { title, amount, details, date } = req.body;

    if (!title || !amount || !date) {
      return res
        .status(400)
        .json({ message: "Title, Amount and Received Date are required" });
    }

    const newExpense = await Expense.create({
      title,
      amount,
      details,
      date,
      createdBy: req.userId,
    });

    res.status(201).json({
      message: "Expense added successfully",
      expense: newExpense,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};


//Get Expenses
export const getExpenses = async (req, res) => {
  try {
    let { fromDate, toDate } = req.query;

    let filters = {};

    // Date filter
    if (fromDate && toDate) {
      filters.date = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    }

    const expenses = await Expense.find(filters)
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 });

    res.status(200).json(expenses);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};



// Update / Edit Expense
export const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, amount, details, date } = req.body;

    if (!title || !amount || !date) {
      return res
        .status(400)
        .json({ message: "Title, Amount and Date are required" });
    }

    const expense = await Expense.findById(id);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Optional: ensure only creator can edit
    if (expense.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: "Anatakiwa Yule aliye Add hii Expense ndo afanye Edit" });
    }

    expense.title = title;
    expense.amount = amount;
    expense.details = details;
    expense.date = date;

    await expense.save();

    res.status(200).json({
      message: "Expense updated successfully",
      expense,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};
