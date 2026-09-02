import Sales from "../../Models/Transactions/sales.js";
import Item from "../../Models/Items/items.js";
import Customer from "../../Models/Customers/customer.js";
import NewGrn from "../../Models/Manunuzi/newGrn.js";
import Orders from "../../Models/Orders/orders.js";

import { jsPDF } from "jspdf";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store Transaction
export const storeTransaction = async (req, res) => {
  try {
    console.log("=== TRANSACTION REQUEST ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const {
      items: soldItems,
      customerDetails,
      loyalCustomer,
      orderId = null,
      orderItemsToFulfill = [],
      status = "Paid",
      paymentMethod = "Cash",
    } = req.body;

    /* ===============================
       0. BASIC VALIDATION
    =============================== */
    if (!soldItems || soldItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No items provided",
      });
    }

    /* ===============================
       1. VALIDATE STOCK
    =============================== */
    for (const soldItem of soldItems) {
      const item = await Item.findById(soldItem.item);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: `Item not found: ${soldItem.item}`,
        });
      }
      if (item.itemQuantity < soldItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.name}. Available: ${item.itemQuantity}, Requested: ${soldItem.quantity}`,
        });
      }
    }

    /* ===============================
       2. FETCH LOYAL CUSTOMER
    =============================== */
    let loyalCustomerData = null;
    if (loyalCustomer) {
      loyalCustomerData = await Customer.findOne({
        _id: loyalCustomer,
        status: "Active",
      });
      if (!loyalCustomerData) {
        return res.status(404).json({
          success: false,
          message: "Active loyal customer not found",
        });
      }
    }

    /* ===============================
       3. VALIDATE ORDER (if provided)
    =============================== */
    let order = null;
    if (orderId) {
      order = await Orders.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Check if order is already completed
      if (order.status === "Completed") {
        return res.status(400).json({
          success: false,
          message: "This order is already completed",
        });
      }

      // Check if there are any pending items in the order
      const pendingItems = order.items.filter(
        (item) => item.fulfillmentStatus === "Pending",
      );

      if (pendingItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: "All items in this order are already fulfilled",
        });
      }

      console.log(
        `Order ${order.orderNumber} found. Pending items: ${pendingItems.length}`,
      );
    }

    /* ===============================
   4. PROCESS ITEMS
=============================== */
    let subTotal = 0;
    let tradeDiscount = 0;
    let saleType = "Retail";
    const processedItems = [];

    for (const si of soldItems) {
      const item = await Item.findById(si.item);

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `Item not found: ${si.item}`,
        });
      }

      // Get selected price type from frontend
      const priceType = si.priceType || "Retail";

      // Validate price type
      if (!["Retail", "Wholesale"].includes(priceType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid price type for ${item.name}`,
        });
      }

      let appliedPrice;

      /* ===============================
     RETAIL
  =============================== */
      if (priceType === "Retail") {
        appliedPrice = Number(si.pricePerQuantity);

        if (!Number.isFinite(appliedPrice) || appliedPrice < 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid retail price for ${item.name}`,
          });
        }
      }

      /* ===============================
     WHOLESALE
  =============================== */
      if (priceType === "Wholesale") {
        if (!item.enableWholesale || item.wholesalePrice <= 0) {
          return res.status(400).json({
            success: false,
            message: `Wholesale price is not available for ${item.name}`,
          });
        }

        if (item.wholesaleMinQty > 0 && si.quantity < item.wholesaleMinQty) {
          return res.status(400).json({
            success: false,
            message: `Minimum wholesale quantity for ${item.name} is ${item.wholesaleMinQty}`,
          });
        }

        appliedPrice = Number(item.wholesalePrice);
      }

      // Set overall sale type
      if (priceType === "Wholesale") {
        saleType = "Wholesale";
      }

      const quantity = Number(si.quantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for ${item.name}`,
        });
      }

      const grossAmount = appliedPrice * quantity;

      const itemDiscount = Math.max(0, Number(si.discount || 0));

      const itemSubtotal = Math.max(0, grossAmount - itemDiscount);

      subTotal += grossAmount;
      tradeDiscount += itemDiscount;

      /* ===============================
     GET BUYING PRICE FROM LATEST GRN
  =============================== */
      let buyingPrice = 0;

      try {
        const lastGrn = await NewGrn.findOne({
          "items.name": si.item,
        })
          .sort({ createdAt: -1 })
          .limit(1);

        if (lastGrn) {
          const grnItem = lastGrn.items.find(
            (g) => g.name.toString() === si.item.toString(),
          );

          buyingPrice = Number(grnItem?.buyingPrice || 0);
        }
      } catch (grnError) {
        console.warn("Could not fetch buying price:", grnError.message);
      }

      processedItems.push({
        item: si.item,
        quantity,
        price: appliedPrice,
        priceType,
        buyingPrice,
        discount: itemDiscount,
        subtotal: itemSubtotal,
        orderItemId: si.orderItemId || null,
      });
    }

    /* ===============================
       5. FINAL TOTALS
    =============================== */
    const totalAmount = Math.max(0, subTotal - tradeDiscount);
    const totalBuyingPrice = processedItems.reduce(
      (sum, item) => sum + item.buyingPrice * item.quantity,
      0,
    );
    const grossProfit = totalAmount - totalBuyingPrice;

    /* ===============================
       6. UPDATE STOCK
    =============================== */
    for (const si of soldItems) {
      await Item.findByIdAndUpdate(si.item, {
        $inc: { itemQuantity: -si.quantity },
      });
    }

    /* ===============================
       7. CUSTOMER DETAILS
    =============================== */
    const saleCustomerDetails = loyalCustomerData
      ? {
          name: loyalCustomerData.customerName || loyalCustomerData.name,
          phone: loyalCustomerData.phone || "",
        }
      : {
          name: customerDetails?.name || "Walk-in Customer",
          phone: customerDetails?.phone || "",
        };

    const paidAmount = status === "Paid" ? totalAmount : 0;

    /* ===============================
       8. SAVE SALE
    =============================== */
    const sale = new Sales({
      saleType,
      items: processedItems,
      subTotal,
      tradeDiscount,
      totalAmount,
      totalBuyingPrice,
      grossProfit,
      paidAmount,
      paymentMethod,
      customerDetails: saleCustomerDetails,
      loyalCustomer: loyalCustomerData?._id || null,
      status,
      order: orderId,
      createdBy: req.userId,
    });

    const savedSale = await sale.save();
    console.log(`Sale ${savedSale._id} created with order: ${orderId}`);

    /* ===============================
       9. UPDATE ORDER (CRITICAL PART)
    =============================== */
    let orderUpdateResult = null;

    if (order) {
      // Link sale to order
      order.sale = savedSale._id;

      // Track which order items are being fulfilled
      const fulfilledItemIds = new Set();

      // Method 1: If orderItemsToFulfill is provided (from frontend)
      if (orderItemsToFulfill && orderItemsToFulfill.length > 0) {
        for (const fulfillment of orderItemsToFulfill) {
          const orderItem = order.items.find(
            (item) => item._id.toString() === fulfillment.orderItemId,
          );

          if (orderItem && orderItem.fulfillmentStatus === "Pending") {
            orderItem.fulfillmentStatus = "Completed";
            orderItem.completedAt = new Date();
            orderItem.sale = savedSale._id;
            fulfilledItemIds.add(orderItem._id.toString());
            console.log(
              `Item ${orderItem.itemName} fulfilled from order ${order.orderNumber}`,
            );
          }
        }
      }

      // Method 2: Auto-detect from sold items (fallback)
      if (fulfilledItemIds.size === 0) {
        for (const soldItem of soldItems) {
          // Find the corresponding order item by matching the item ID
          const orderItem = order.items.find(
            (item) =>
              item.item.toString() === soldItem.item.toString() &&
              item.fulfillmentStatus === "Pending",
          );

          if (orderItem) {
            orderItem.fulfillmentStatus = "Completed";
            orderItem.completedAt = new Date();
            orderItem.sale = savedSale._id;
            fulfilledItemIds.add(orderItem._id.toString());
            console.log(
              `Auto-detected: Item ${orderItem.itemName} fulfilled from order ${order.orderNumber}`,
            );
          }
        }
      }

      // Calculate order status
      const totalItems = order.items.length;
      const completedItems = order.items.filter(
        (item) => item.fulfillmentStatus === "Completed",
      ).length;

      // Determine overall order status
      if (completedItems === totalItems) {
        order.status = "Completed";
        console.log(`Order ${order.orderNumber} is now COMPLETED`);
      } else if (completedItems > 0) {
        order.status = "Partially Completed";
        console.log(
          `Order ${order.orderNumber} is PARTIALLY COMPLETED (${completedItems}/${totalItems})`,
        );
      }

      // Update payment status
      if (status === "Paid") {
        order.paidAmount = (order.paidAmount || 0) + totalAmount;
        order.balance = Math.max(0, order.grandTotal - order.paidAmount);

        if (order.balance <= 0) {
          order.paymentStatus = "Paid";
          order.balance = 0;
        } else {
          order.paymentStatus = "Partially Paid";
        }
        console.log(
          `Order payment updated: ${order.paymentStatus}, Balance: ${order.balance}`,
        );
      }

      order.lastModifiedBy = req.userId;
      await order.save();

      // Prepare order update result
      orderUpdateResult = {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        remainingBalance: order.balance,
        completedItems: completedItems,
        totalItems: totalItems,
        fulfilledItemIds: Array.from(fulfilledItemIds),
        isFullyCompleted: order.status === "Completed",
      };

      console.log(
        `Order ${order.orderNumber} update result:`,
        orderUpdateResult,
      );
    } else {
      console.log("No order to update - regular sale");
    }

    /* ===============================
       10. RESPONSE
    =============================== */
    return res.status(201).json({
      success: true,
      message: orderUpdateResult?.isFullyCompleted
        ? "Order completed successfully!"
        : orderUpdateResult
          ? "Order updated successfully"
          : "Transaction successful",
      data: savedSale,
      orderUpdate: orderUpdateResult,
    });
  } catch (error) {
    console.error("Transaction error:", error);
    return res.status(500).json({
      success: false,
      message: "Transaction failed",
      error: error.message,
    });
  }
};

// Receipt Printing PDF (Thermal Printer 58mm)
export const printReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sales.findById(id).populate("items.item");

    if (!sale) {
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    }

    // Helper function to format numbers with commas
    const formatNumber = (num) => {
      return parseFloat(num)
        .toFixed(0)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    // Thermal printer format (58mm width)
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [58, 150],
    });

    // ========== THERMAL PRINTER SETTINGS ==========
    const PAGE_WIDTH = 58;
    const LEFT_MARGIN = 2;
    const RIGHT_MARGIN = 2;

    let y = 5;

    doc.setFont("helvetica", "bold");

    // ========== HEADER ==========
    let logoBase64 = "";
    try {
      const logoPath = path.join(__dirname, "../Transaction/Receipts/wise.png");
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
        const logoWidth = 40;
        const logoHeight = 15;
        const logoX = (PAGE_WIDTH - logoWidth) / 2;
        doc.addImage(logoBase64, "PNG", logoX, y, logoWidth, logoHeight);
        y += logoHeight + 3;
      } else {
        throw new Error("Logo file not found");
      }
    } catch (imageError) {
      console.warn("Could not load logo image, using text fallback");
      doc.setFontSize(9);
      doc.text("WISE STORE", PAGE_WIDTH / 2, y, { align: "center" });
      y += 4;
    }

    doc.setFontSize(7);
    doc.text("SALES RECEIPT", PAGE_WIDTH / 2, y, { align: "center" });

    doc.setFontSize(5);
    doc.text("Tip Top, Manzense", PAGE_WIDTH / 2, y + 3, { align: "center" });
    doc.text("Dar es Salaam", PAGE_WIDTH / 2, y + 6, { align: "center" });
    doc.text("+255 652 564 345", PAGE_WIDTH / 2, y + 9, { align: "center" });

    y += 18;

    // ========== DIVIDER ==========
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(LEFT_MARGIN, y, PAGE_WIDTH - RIGHT_MARGIN, y);
    y += 4;

    // ========== RECEIPT INFO ==========
    doc.setFontSize(6);

    const receiptId = sale._id.toString().slice(-6);
    const saleDate = new Date(sale.createdAt);
    const dateStr = `${saleDate.getDate().toString().padStart(2, "0")}/${(saleDate.getMonth() + 1).toString().padStart(2, "0")}/${saleDate.getFullYear().toString().slice(-2)}`;
    const timeStr = `${saleDate.getHours().toString().padStart(2, "0")}:${saleDate.getMinutes().toString().padStart(2, "0")}`;

    doc.text(`#${receiptId}`, LEFT_MARGIN, y);
    doc.text(`${dateStr} ${timeStr}`, PAGE_WIDTH - RIGHT_MARGIN, y, {
      align: "right",
    });

    y += 3;
    doc.text(`Status: ${sale.status}`, LEFT_MARGIN, y);
    doc.text(
      `Payment: ${sale.paymentMethod || "Cash"}`,
      PAGE_WIDTH - RIGHT_MARGIN,
      y,
      { align: "right" },
    );

    y += 6;

    // ========== CUSTOMER INFO ==========
    if (sale.customerDetails?.name || sale.customerDetails?.phone) {
      doc.text("CUSTOMER:", LEFT_MARGIN, y);

      if (sale.customerDetails?.name) {
        const custName =
          sale.customerDetails.name.length > 18
            ? sale.customerDetails.name.substring(0, 16) + ".."
            : sale.customerDetails.name;
        doc.text(`Name: ${custName}`, LEFT_MARGIN, y + 3);
      }

      if (sale.customerDetails?.phone) {
        doc.text(`Phone: ${sale.customerDetails.phone}`, LEFT_MARGIN, y + 6);
        y += 6;
      } else {
        y += 3;
      }

      y += 3;
    }

    // ========== DIVIDER ==========
    doc.line(LEFT_MARGIN, y, PAGE_WIDTH - RIGHT_MARGIN, y);
    y += 3;

    // ========== ITEMS TABLE HEADER ==========
    doc.setFontSize(6);

    const COL_ITEM_END = 28;
    const COL_QTY = 30;
    const COL_PRICE = 36;
    const COL_TOTAL = 45;

    doc.text("ITEM", LEFT_MARGIN, y);
    doc.text("QTY", COL_QTY, y);
    doc.text("PRICE", COL_PRICE, y);
    doc.text("TOTAL", COL_TOTAL, y);

    y += 3;
    doc.line(LEFT_MARGIN, y, PAGE_WIDTH - RIGHT_MARGIN, y);
    y += 6;

    // ========== ITEMS ==========
    doc.setFontSize(6);

    sale.items.forEach((it, index) => {
      if (y > 130) {
        doc.addPage();
        y = 10;
      }

      const itemName = it.item?.name || "Item";
      const price = formatNumber(it.price);
      const total = formatNumber(it.quantity * it.price);

      const maxCharsPerLine = 20;

      let displayName = itemName;
      let needsSecondLine = false;

      if (itemName.length > maxCharsPerLine) {
        const splitIndex = itemName.lastIndexOf(" ", maxCharsPerLine);
        if (splitIndex > 0) {
          displayName = itemName.substring(0, splitIndex);
          const secondLine = itemName.substring(splitIndex + 1);

          doc.text(`${index + 1}. ${displayName}`, LEFT_MARGIN, y);
          doc.text(
            secondLine.substring(0, maxCharsPerLine),
            LEFT_MARGIN + 5,
            y + 3,
          );
          needsSecondLine = true;
        } else {
          displayName = itemName.substring(0, maxCharsPerLine - 3) + "...";
          doc.text(`${index + 1}. ${displayName}`, LEFT_MARGIN, y);
        }
      } else {
        doc.text(`${index + 1}. ${displayName}`, LEFT_MARGIN, y);
      }

      doc.text(`${it.quantity}`, COL_QTY, y);
      doc.text(`${price}`, COL_PRICE + 7, y, { align: "right" });
      doc.text(`${total}`, COL_TOTAL + 7, y, { align: "right" });

      y += needsSecondLine ? 6 : 4;
    });

    // ========== DIVIDER ==========
    doc.line(LEFT_MARGIN, y, PAGE_WIDTH - RIGHT_MARGIN, y);
    y += 4;

    // ========== TOTALS ==========
    const TOTAL_LABEL_START = 33;
    const TOTAL_VALUE_START = 45;

    doc.text("Subtotal:", TOTAL_LABEL_START, y);
    doc.text(` ${formatNumber(sale.subTotal)}`, TOTAL_VALUE_START + 7, y, {
      align: "right",
    });
    y += 3;

    if (sale.tradeDiscount > 0) {
      doc.text("Discount:", TOTAL_LABEL_START, y);
      doc.text(
        ` ${formatNumber(sale.tradeDiscount)}`,
        TOTAL_VALUE_START + 7,
        y,
        { align: "right" },
      );
      y += 3;
    }

    if (sale.taxAmount > 0) {
      doc.text("Tax:", TOTAL_LABEL_START, y);
      doc.text(` ${formatNumber(sale.taxAmount)}`, TOTAL_VALUE_START + 7, y, {
        align: "right",
      });
      y += 3;
    }

    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.line(TOTAL_LABEL_START - 5, y, TOTAL_VALUE_START + 7, y);
    y += 4;

    doc.setFontSize(7);
    doc.text("TOTAL:", TOTAL_LABEL_START - 3, y);
    doc.text(
      `Tsh ${formatNumber(sale.totalAmount)}`,
      TOTAL_VALUE_START + 7,
      y,
      { align: "right" },
    );
    doc.setFontSize(6);
    y += 6;

    // ========== PAYMENT STATUS ==========
    if (sale.status === "Bill") {
      doc.setFontSize(7);
      doc.text("* PAYMENT PENDING *", PAGE_WIDTH / 2, y, { align: "center" });
      doc.setFontSize(5);
      doc.text("Bill notice - not a receipt", PAGE_WIDTH / 2, y + 3, {
        align: "center",
      });
      y += 8;
    }

    // ========== FOOTER ==========
    doc.setFontSize(5);
    doc.text("Thank you for shopping with us!", PAGE_WIDTH / 2, y, {
      align: "center",
    });
    y += 3;
    doc.text("Exchange within 7 days with receipt", PAGE_WIDTH / 2, y, {
      align: "center",
    });

    y += 6;
    doc.setFontSize(4);
    const now = new Date();
    const genTime = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear().toString().slice(-2)} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    doc.text(`Generated: ${genTime}`, PAGE_WIDTH / 2, y, { align: "center" });

    // ========== CUT LINE ==========
    y += 4;
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(LEFT_MARGIN, y, PAGE_WIDTH - RIGHT_MARGIN, y);
    doc.setLineDashPattern([], 0);

    // ========== SEND TO BROWSER ==========
    const pdfData = doc.output("arraybuffer");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=thermal-receipt-${sale._id}.pdf`,
    );
    res.send(Buffer.from(pdfData));
  } catch (error) {
    console.error("Thermal receipt generation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate thermal receipt",
    });
  }
}; 

// Get Billed Transactions
export const billedTransactions = async (req, res) => {
  try {
    const billedSales = await Sales.find({ status: "Bill" })
      .populate("items.item")
      .populate("loyalCustomer", "customerName phone")
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: billedSales.length,
      data: billedSales,
    });
  } catch (error) {
    console.error("Error getting billed transactions:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch billed transactions.",
      error: error.message,
    });
  }
};

// Pay Billed Transaction
export const payBilledTransaction = async (req, res) => {
  try {
    const { paymentAmount, paymentMethod = "Cash" } = req.body;

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    const transaction = await Sales.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (transaction.status !== "Bill") {
      return res.status(400).json({
        success: false,
        message: "Transaction already paid",
      });
    }

    const remainingBalance = transaction.totalAmount - transaction.paidAmount;

    if (paymentAmount > remainingBalance) {
      return res.status(400).json({
        success: false,
        message: `Payment exceeds remaining balance (${remainingBalance})`,
      });
    }

    transaction.paidAmount += paymentAmount;
    transaction.paymentMethod = paymentMethod;

    // Auto-close bill
    if (transaction.paidAmount >= transaction.totalAmount) {
      transaction.status = "Paid";
    }

    transaction.lastModifiedBy = req.userId;

    await transaction.save();

    res.status(200).json({
      success: true,
      message: "Payment recorded successfully",
      data: transaction,
    });
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update payment",
      error: error.message,
    });
  }
};

// All Transactions with Pagination and Filters
export const allTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { status, startDate, endDate, cashier, search } = req.query;

    let filter = {};

    if (status && status !== "All") {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate + "T23:59:59.999Z");
      }
    }

    if (cashier) {
      filter.createdBy = cashier;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { "customerDetails.name": searchRegex },
        { "customerDetails.phone": searchRegex },
      ];
    }

    const totalCount = await Sales.countDocuments(filter);

    let sales = await Sales.find(filter)
      .populate("items.item")
      .populate("createdBy", "firstName lastName")
      .populate("lastModifiedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Replace null items with safe placeholder
    sales = sales.map((sale) => {
      const safeItems = sale.items.map((i) => ({
        ...i._doc,
        item: i.item || { _id: null, name: "Deleted item", price: 0 },
      }));
      return {
        ...sale._doc,
        items: safeItems,
        customerDetails: sale.customerDetails || {
          name: "Walk-in",
          phone: "-",
        },
      };
    });

    // Calculate totals from filtered data
    const totalsResult = await Sales.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalPaid: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Paid"] },
                { $ifNull: ["$paidAmount", "$totalAmount"] },
                0,
              ],
            },
          },
          totalBilled: {
            $sum: {
              $cond: [{ $eq: ["$status", "Bill"] }, "$totalAmount", 0],
            },
          },
          totalDiscount: {
            $sum: { $ifNull: ["$tradeDiscount", 0] },
          },
          totalGrossProfit: {
            $sum: { $ifNull: ["$grossProfit", 0] },
          },
        },
      },
    ]);

    const totals =
      totalsResult.length > 0
        ? totalsResult[0]
        : {
            totalPaid: 0,
            totalBilled: 0,
            totalDiscount: 0,
            totalGrossProfit: 0,
          };

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      data: sales,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
      totals: {
        paid: totals.totalPaid || 0,
        bill: totals.totalBilled || 0,
        discount: totals.totalDiscount || 0,
        grossProfit: totals.totalGrossProfit || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
      error: error.message,
    });
  }
};

// Most Sold Items
export const mostSoldItems = async (req, res) => {
  try {
    const { period = "monthly" } = req.query;
    const now = new Date();

    let startDate;
    switch (period) {
      case "daily":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "weekly":
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "monthly":
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const mostSold = await Sales.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: now },
          status: "Paid",
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.item",
          totalQuantity: { $sum: "$items.quantity" },
          totalAmount: {
            $sum: {
              $multiply: ["$items.price", "$items.quantity"],
            },
          },
          totalProfit: {
            $sum: {
              $multiply: [
                { $subtract: ["$items.price", "$items.buyingPrice"] },
                "$items.quantity",
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "items",
          localField: "_id",
          foreignField: "_id",
          as: "itemDetails",
        },
      },
      { $unwind: { path: "$itemDetails", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: { $ifNull: ["$itemDetails.name", "Deleted Item"] },
          totalQuantity: 1,
          totalAmount: 1,
          totalProfit: 1,
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 20 },
    ]);

    res.json({
      success: true,
      period,
      data: mostSold,
    });
  } catch (error) {
    console.error("Error fetching most sold items:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get all Billed transactions with Loyal Customers
export const getBilledWallet = async (req, res) => {
  try {
    const billedTransactions = await Sales.find({
      status: "Bill",
      loyalCustomer: { $ne: null },
    })
      .populate("loyalCustomer", "customerName phone status address email")
      .populate("items.item", "name price")
      .populate("createdBy", "firstName lastName")
      .populate("lastModifiedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    if (!billedTransactions || billedTransactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No billed transactions with loyal customers found",
      });
    }

    // Group transactions by customer
    const customersMap = {};

    billedTransactions.forEach((txn) => {
      if (!txn.loyalCustomer) return;

      const customerId = txn.loyalCustomer._id.toString();
      if (!customersMap[customerId]) {
        customersMap[customerId] = {
          _id: customerId,
          name: txn.loyalCustomer.customerName || txn.loyalCustomer.name,
          phone: txn.loyalCustomer.phone || "",
          address: txn.loyalCustomer.address || "",
          email: txn.loyalCustomer.email || "",
          bills: [],
          totalOutstanding: 0,
        };
      }

      const balance = txn.totalAmount - txn.paidAmount;
      customersMap[customerId].totalOutstanding += balance;

      customersMap[customerId].bills.push({
        _id: txn._id,
        totalAmount: txn.totalAmount,
        paidAmount: txn.paidAmount,
        balance: balance,
        status: txn.status,
        createdAt: txn.createdAt,
        items: txn.items.map((i) => ({
          name: i.item?.name || "Deleted Item",
          price: i.item?.price || i.price,
          quantity: i.quantity,
        })),
      });
    });

    const formattedData = Object.values(customersMap);

    res.status(200).json({
      success: true,
      count: formattedData.length,
      data: formattedData,
    });
  } catch (error) {
    console.error("Error fetching billed transactions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch billed transactions",
      error: error.message,
    });
  }
};
