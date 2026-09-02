import Transaction from "../../Models/Transactions/sales.js";
import Expense from "../../Models/Manunuzi/matumizi.js";
import GrnPo from "../../Models/Manunuzi/poGrn.js";
import GrnNonPo from "../../Models/Manunuzi/newGrn.js";

export const dashboardCards = async (req, res) => {
  try {
    const { from, to } = req.query;

    // Validate required dates
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "'from' and 'to' dates are required",
      });
    }

    // Parse dates and set boundaries
    const [fromY, fromM, fromD] = from.split("-").map(Number);
    const [toY, toM, toD] = to.split("-").map(Number);

    const startDate = new Date(fromY, fromM - 1, fromD, 0, 0, 0, 0);
    const endDate = new Date(toY, toM - 1, toD, 23, 59, 59, 999);

    // For transactions and expenses: filter by createdAt
    const dateMatch = { createdAt: { $gte: startDate, $lte: endDate } };
    // For GRNs: filter by receivingDate
    const grnDateMatch = { receivingDate: { $gte: startDate, $lte: endDate } };

    const [
      transactionSummary,
      expenseSummary,
      grnPoSummary,
      grnNonPoSummary,
      profitBreakdown,
      chartData,
      billedTransactions,
    ] = await Promise.all([
      // ── 1. Transaction summary ──────────────────────────────────────────
      Transaction.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: null,
            sales: {
              $sum: {
                $add: [
                  { $ifNull: ["$totalAmount", 0] },
                  { $ifNull: ["$tradeDiscount", 0] },
                ],
              },
            },
            discounts: { $sum: { $ifNull: ["$tradeDiscount", 0] } },
            paid: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "Paid"] },
                  { $ifNull: ["$totalAmount", 0] },
                  0,
                ],
              },
            },
            bills: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "Bill"] },
                  { $ifNull: ["$totalAmount", 0] },
                  0,
                ],
              },
            },
            buying: {
              $sum: {
                $reduce: {
                  input: { $ifNull: ["$items", []] },
                  initialValue: 0,
                  in: {
                    $add: [
                      "$$value",
                      {
                        $multiply: [
                          { $ifNull: ["$$this.quantity", 0] },
                          { $ifNull: ["$$this.buyingPrice", 0] },
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      ]),

      // ── 2. Expense total ─────────────────────────────────────────────────
      Expense.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: null,
            expenses: { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } },
          },
        },
      ]),

      // ── 3. GRN PO total ──────────────────────────────────────────────────
      GrnPo.aggregate([
        { $match: grnDateMatch },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $reduce: {
                  input: { $ifNull: ["$items", []] },
                  initialValue: 0,
                  in: {
                    $add: ["$$value", { $ifNull: ["$$this.totalCost", 0] }],
                  },
                },
              },
            },
          },
        },
      ]),

      // ── 4. GRN Non-PO total ───────────────────────────────────────────────
      GrnNonPo.aggregate([
        { $match: grnDateMatch },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $reduce: {
                  input: { $ifNull: ["$items", []] },
                  initialValue: 0,
                  in: {
                    $add: ["$$value", { $ifNull: ["$$this.totalCost", 0] }],
                  },
                },
              },
            },
          },
        },
      ]),

      // ── 5. Profit breakdown per item ─────────────────────────────────────
      Transaction.aggregate([
        { $match: dateMatch },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "items",
            localField: "items.item",
            foreignField: "_id",
            as: "fetchedItem",
          },
        },
        { $unwind: { path: "$fetchedItem", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$items.item",
            itemName: { $first: "$fetchedItem.name" },
            qty: { $sum: "$items.quantity" },
            sellingPrice: { $first: "$items.price" },
            buyingPrice: { $first: "$items.buyingPrice" },
            discount: { $sum: { $ifNull: ["$items.discount", 0] } },
            totalSales: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$items.quantity", 0] },
                  { $ifNull: ["$items.price", 0] },
                ],
              },
            },
            totalBuying: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$items.quantity", 0] },
                  { $ifNull: ["$items.buyingPrice", 0] },
                ],
              },
            },
          },
        },
        {
          $addFields: {
            profit: {
              $subtract: [
                "$totalSales",
                { $add: ["$totalBuying", "$discount"] },
              ],
            },
          },
        },
        { $sort: { profit: -1 } },
        {
          $project: {
            _id: 0,
            itemName: { $ifNull: ["$itemName", "Unknown Item"] },
            qty: 1,
            sellingPrice: 1,
            buyingPrice: 1,
            discount: 1,
            profit: 1,
          },
        },
      ]),

      // ── 6. Chart data grouped by day ─────────────────────────────────────
      Transaction.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            sales: {
              $sum: {
                $add: [
                  { $ifNull: ["$totalAmount", 0] },
                  { $ifNull: ["$tradeDiscount", 0] },
                ],
              },
            },
            paid: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "Paid"] },
                  { $ifNull: ["$totalAmount", 0] },
                  0,
                ],
              },
            },
            bills: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "Bill"] },
                  { $ifNull: ["$totalAmount", 0] },
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            name: "$_id",
            sales: 1,
            paid: 1,
            bills: 1,
          },
        },
      ]),

      // ── 7. Billed transactions for TableDash ─────────────────────────────
      Transaction.find(
        { ...dateMatch, status: "Bill" },
        {
          _id: 1,
          totalAmount: 1,
          tradeDiscount: 1,
          status: 1,
          createdAt: 1,
          customerDetails: 1,
          items: 1,
        },
      )
        .populate({
          path: "customerDetails",
          select: "name",
        })
        .populate({
          path: "items.item",
          select: "name",
        })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const tx = transactionSummary[0] || {};
    const exp = expenseSummary[0] || {};
    const grnTotal =
      (grnPoSummary[0]?.total || 0) + (grnNonPoSummary[0]?.total || 0);

    const profit =
      (tx.sales || 0) -
      ((tx.buying || 0) + (exp.expenses || 0) + (tx.discounts || 0));

    return res.status(200).json({
      success: true,
      data: {
        totalSales: tx.sales || 0,
        totalPaid: tx.paid || 0,
        totalBills: tx.bills || 0,
        totalDiscount: tx.discounts || 0,
        totalBuyingPrice: tx.buying || 0,
        totalExpenses: exp.expenses || 0,
        totalGrn: grnTotal,
        profit,
        profitSummaryData: profitBreakdown,
        composedChartData: chartData,
        billed: billedTransactions,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//***************************************************************************************************** */
// PROFIT CALCULATION EXPLANATION:

// controllers/profitController.js
export const profitReport = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "'from' and 'to' dates are required",
      });
    }

    const [fromY, fromM, fromD] = from.split("-").map(Number);
    const [toY, toM, toD] = to.split("-").map(Number);

    const startDate = new Date(fromY, fromM - 1, fromD, 0, 0, 0, 0);
    const endDate = new Date(toY, toM - 1, toD, 23, 59, 59, 999);

    const dateMatch = { createdAt: { $gte: startDate, $lte: endDate } };

    const [transactions, expenses] = await Promise.all([
      Transaction.find(dateMatch)
        .populate("items.item", "name")
        .populate("customerDetails", "name")
        .populate("createdBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .lean(),

      Expense.find(dateMatch).sort({ createdAt: -1 }).lean(),
    ]);

    const reportData = [];

    for (const tx of transactions) {
      for (const soldItem of tx.items || []) {
        const qty = soldItem.quantity || 0;
        const sellingPrice = soldItem.price || 0;
        const buyingPrice = soldItem.buyingPrice || 0;
        const itemDiscount = Number(soldItem.discount || 0);
        const itemName = soldItem.item?.name || "Unknown";

        const salesAmount = qty * sellingPrice;
        const buyingAmount = qty * buyingPrice;

        // FIXED: Gross profit = revenue - buying cost (before discount)
        const grossProfit = salesAmount - buyingAmount;

        // FIXED: Net profit = gross profit - discount (after discount)
        const netProfit = grossProfit - itemDiscount;

        reportData.push({
          date: tx.createdAt,
          itemName,
          qty,
          sellingPrice,
          buyingPrice,
          salesAmount,
          buyingAmount,
          gross: grossProfit,
          discount: itemDiscount,
          cardDiscount: Number(tx.tradeDiscount || 0),
          profit: netProfit,
          status: tx.status,
          customer: tx.customerDetails?.name || "Walk-in",
          cashier: tx.createdBy
            ? `${tx.createdBy.firstName} ${tx.createdBy.lastName}`
            : "-",
        });
      }
    }

    const totals = reportData.reduce(
      (acc, row) => {
        acc.sales += row.salesAmount;
        acc.buying += row.buyingAmount;
        acc.discount += row.discount;
        acc.gross += row.gross; // Summ of gross profits
        acc.profit += row.profit; // Sum of net profits
        acc.qty += row.qty;
        return acc;
      },
      { sales: 0, buying: 0, discount: 0, gross: 0, profit: 0, qty: 0 },
    );

    const totalTradeDiscount = transactions.reduce((acc, tx) => {
      return acc + Number(tx.tradeDiscount || 0);
    }, 0);

    const totalExpenses = expenses.reduce(
      (s, e) => s + Number(e.amount || 0),
      0,
    );

    // Final net profit = total net profits - expenses - trade discount
    const finalProfit = totals.gross - totalExpenses - totalTradeDiscount;

    return res.status(200).json({
      success: true,
      data: {
        reportData,
        totals,
        totalTradeDiscount,
        totalExpenses,
        finalProfit,
        expensesCount: expenses.length,
        transactionsCount: transactions.length,
      },
    });
  } catch (error) {
    console.error("Profit report error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
