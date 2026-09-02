import newGrn from "../../Models/Manunuzi/newGrn.js";
import Items from "../../Models/Items/items.js";
import supplier from "../../Models/Manunuzi/supplier.js";
import billedNon from "../../Models/Manunuzi/billNonReport.js";
import batches from "../../Models/Items/batches.js";
import { v4 as uuidv4 } from "uuid";

//Add Non PO GRN
export const addNewGrn = async (req, res) => {
  const {
    items,
    supplierName,
    invoiceNumber,
    lpoNumber,
    deliveryPerson,
    deliveryNumber,
    description,
    receivingDate,
  } = req.body;

  // =====================================================
  // VALIDATE ITEMS
  // =====================================================

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Items must be a non-empty array",
    });
  }

  try {
    // =====================================================
    // 1. VALIDATE SUPPLIER
    // =====================================================

    if (!supplierName || !supplierName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Supplier is required",
      });
    }

    // =====================================================
    // 2. FIND SUPPLIER
    // =====================================================

    const supplierDetails = await supplier.findOne({
      supplierName: {
        $regex: new RegExp(
          `^${supplierName.trim()}$`,
          "i"
        ),
      },
    });

    if (!supplierDetails) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    // =====================================================
    // 3. GENERATE STOCK IDENTIFIER
    // =====================================================

    const stockIdentifier = uuidv4();

    const itemsToSave = [];

    // =====================================================
    // 4. PROCESS EACH GRN ITEM
    // =====================================================

    for (const item of items) {
      // ---------------------------------------------------
      // FIND ITEM
      // ---------------------------------------------------

      if (!item.name) {
        return res.status(400).json({
          success: false,
          message: "Item name is required",
        });
      }

      const itemDetails = await Items.findOne({
        name: item.name,
      });

      if (!itemDetails) {
        return res.status(404).json({
          success: false,
          message: `Item "${item.name}" not found`,
        });
      }

      // ---------------------------------------------------
      // SAFE NUMERIC VALUES
      // ---------------------------------------------------

      const receivedQty = Number(item.quantity);

      const buyingPrice = Number(
        item.buyingPrice
      );

      const sellingPrice =
        item.sellingPrice !== undefined &&
        item.sellingPrice !== null &&
        item.sellingPrice !== ""
          ? Number(item.sellingPrice)
          : null;

      const wholesaleMinQty = Math.max(
        0,
        Number(item.wholesaleMinQty) || 0
      );

      const wholesalePrice = Math.max(
        0,
        Number(item.wholesalePrice) || 0
      );

      const billedAmount = Math.max(
        0,
        Number(item.billedAmount) || 0
      );

      const foc = Math.max(
        0,
        Number(item.foc) || 0
      );

      const rejected = Math.max(
        0,
        Number(item.rejected) || 0
      );

      // ---------------------------------------------------
      // VALIDATE QUANTITY
      // ---------------------------------------------------

      if (
        !Number.isFinite(receivedQty) ||
        receivedQty <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Valid quantity is required for ${item.name}`,
        });
      }

      // ---------------------------------------------------
      // VALIDATE BUYING PRICE
      // ---------------------------------------------------

      if (
        !Number.isFinite(buyingPrice) ||
        buyingPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Valid buying price is required for ${item.name}`,
        });
      }

      // ---------------------------------------------------
      // VALIDATE SELLING PRICE
      // ---------------------------------------------------

      if (
        sellingPrice !== null &&
        (!Number.isFinite(sellingPrice) ||
          sellingPrice < 0)
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid selling price for ${item.name}`,
        });
      }

      // ---------------------------------------------------
      // VALIDATE BATCH NUMBER
      // ---------------------------------------------------

      if (
        !item.batchNumber ||
        !item.batchNumber.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Batch number is required for ${item.name}`,
        });
      }

      // ---------------------------------------------------
      // VALIDATE EXPIRY DATE
      // ---------------------------------------------------

      if (!item.expiryDate) {
        return res.status(400).json({
          success: false,
          message:
            `Expiry date is required for ${item.name}`,
        });
      }

      const expiryDate = new Date(
        item.expiryDate
      );

      if (Number.isNaN(expiryDate.getTime())) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid expiry date for ${item.name}`,
        });
      }

      // ---------------------------------------------------
      // VALIDATE MANUFACTURE DATE
      // ---------------------------------------------------

      let manufactureDate = null;

      if (item.manufactureDate) {
        manufactureDate = new Date(
          item.manufactureDate
        );

        if (
          Number.isNaN(
            manufactureDate.getTime()
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              `Invalid manufacture date for ${item.name}`,
          });
        }

        if (manufactureDate > expiryDate) {
          return res.status(400).json({
            success: false,
            message:
              `Manufacture date cannot be after expiry date for ${item.name}`,
          });
        }
      }

      // ===================================================
      // 5. CHECK DUPLICATE BATCH
      // ===================================================

      const existingBatch =
        await batches.findOne({
          item: itemDetails._id,
          batchNumber:
            item.batchNumber.trim(),
        });

      if (existingBatch) {
        return res.status(409).json({
          success: false,
          message:
            `Batch ${item.batchNumber} already exists for ${item.name}`,
        });
      }

      // ===================================================
      // 6. DETERMINE BATCH STATUS
      // ===================================================

      const batchStatus =
        expiryDate < new Date()
          ? "Expired"
          : "Active";

      // ===================================================
      // 7. CREATE BATCH
      // ===================================================

      const newBatch = new batches({
        item: itemDetails._id,

        batchNumber:
          item.batchNumber.trim(),

        buyingPrice,

        quantityReceived: receivedQty,

        quantityRemaining: receivedQty,

        manufactureDate,

        expireDate: expiryDate,

        supplier:
          supplierDetails._id,

        status: batchStatus,

        createdBy: req.userId,
      });

      const savedBatch =
        await newBatch.save();

      // ===================================================
      // 8. UPDATE ITEM MASTER
      // ===================================================

      const currentQuantity =
        Number(itemDetails.itemQuantity) || 0;

      itemDetails.itemQuantity =
        currentQuantity + receivedQty;

      // ---------------------------------------------------
      // UPDATE SELLING PRICE
      // ---------------------------------------------------

      if (sellingPrice !== null) {
        itemDetails.price =
          sellingPrice;
      }

      // ---------------------------------------------------
      // UPDATE WHOLESALE SETTINGS
      // ---------------------------------------------------

      if (
        wholesalePrice > 0 &&
        wholesaleMinQty > 0
      ) {
        itemDetails.enableWholesale = true;

        itemDetails.wholesalePrice =
          wholesalePrice;

        itemDetails.wholesaleMinQty =
          wholesaleMinQty;
      }

      // ---------------------------------------------------
      // UPDATE REORDER STATUS
      // ---------------------------------------------------

      itemDetails.reOrderStatus =
        itemDetails.itemQuantity <=
        (Number(itemDetails.reOrder) || 0)
          ? "Low"
          : "Normal";

      // ---------------------------------------------------
      // AUDIT
      // ---------------------------------------------------

      itemDetails.lastModifiedBy =
        req.userId;

      await itemDetails.save();

      // ===================================================
      // 9. BILLING
      // ===================================================

      const billedTotalCost =
        billedAmount * buyingPrice;

      const remainingBalance =
        billedTotalCost;

      const status =
        billedAmount > 0
          ? "Billed"
          : "Completed";

      // ===================================================
      // 10. BUILD GRN ITEM
      // ===================================================

      itemsToSave.push({
        name: itemDetails._id,

        // Actual quantity received
        quantity: receivedQty,

        buyingPrice,

        // Historical selling price
        sellingPrice:
          sellingPrice !== null
            ? sellingPrice
            : itemDetails.price,

        // Wholesale snapshot
        enableWholesale:
          wholesalePrice > 0 &&
          wholesaleMinQty > 0,

        wholesaleMinQty,

        wholesalePrice,

        // Batch information snapshot
        batchNumber:
          item.batchNumber.trim(),

        manufactureDate,

        expiryDate,

        receivedDate:
          item.receivedDate
            ? new Date(item.receivedDate)
            : new Date(),

        // Other receiving information
        foc,

        rejected,

        billedAmount,

        billedTotalCost,

        paidAmount: 0,

        remainingBalance,

        isFullyPaid: false,

        comments:
          item.comments || "",

        totalCost:
          Number(item.totalCost) || 0,

        status,

        changedAt: new Date(),

        // Actual Batch reference
        batch: savedBatch._id,
      });
    }

    // =====================================================
    // 11. CREATE GRN
    // =====================================================

    const newStockDetails = new newGrn({
      stockIdentifier,

      items: itemsToSave,

      supplierName:
        supplierDetails._id,

      invoiceNumber,

      lpoNumber,

      deliveryPerson,

      deliveryNumber,

      description,

      receivingDate:
        receivingDate
          ? new Date(receivingDate)
          : new Date(),

      createdBy: req.userId,
    });

    // =====================================================
    // 12. SAVE GRN
    // =====================================================

    const saved =
      await newStockDetails.save();

    // =====================================================
    // 13. RESPONSE
    // =====================================================

    return res.status(201).json({
      success: true,
      message:
        "New stock added successfully",
      data: saved,
    });
  } catch (error) {
    console.error(
      "Error adding new stock:",
      error
    );

    // =====================================================
    // DUPLICATE KEY
    // =====================================================

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Duplicate batch number detected",
        error: error.message,
      });
    }

    // =====================================================
    // SERVER ERROR
    // =====================================================

    return res.status(500).json({
      success: false,
      message:
        "Failed to add new stock",
      error: error.message,
    });
  }
};


//Get All Non PO GRNs
export const completedNonPo = async (req, res) => {
  try {
    // =====================================================
    // PAGINATION
    // =====================================================

    const page = Math.max(
      1,
      parseInt(req.query.page) || 1
    );

    const limit = Math.max(
      1,
      parseInt(req.query.limit) || 10
    );

    const skip = (page - 1) * limit;

    // =====================================================
    // SEARCH / FILTER PARAMETERS
    // =====================================================

    const searchTerm =
      req.query.search?.trim() || "";

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // =====================================================
    // BUILD FILTER
    // =====================================================

    const filter = {};

    // =====================================================
    // SEARCH
    // =====================================================

    if (searchTerm) {
      // Find suppliers matching search term
      const suppliers = await Supplier.find({
        supplierName: {
          $regex: searchTerm,
          $options: "i",
        },
      }).select("_id");

      const supplierIds = suppliers.map(
        (supplier) => supplier._id
      );

      filter.$or = [
        {
          stockIdentifier: {
            $regex: searchTerm,
            $options: "i",
          },
        },
        {
          invoiceNumber: {
            $regex: searchTerm,
            $options: "i",
          },
        },
        {
          lpoNumber: {
            $regex: searchTerm,
            $options: "i",
          },
        },
        {
          supplierName: {
            $in: supplierIds,
          },
        },
      ];
    }

    // =====================================================
    // DATE FILTER
    // =====================================================

    if (startDate || endDate) {
      filter.receivingDate = {};

      if (startDate) {
        const start = new Date(startDate);

        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid start date",
          });
        }

        // Start of the day
        start.setHours(0, 0, 0, 0);

        filter.receivingDate.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);

        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid end date",
          });
        }

        // End of the day
        end.setHours(23, 59, 59, 999);

        filter.receivingDate.$lte = end;
      }
    }

    // =====================================================
    // FETCH GRNS
    // =====================================================

    const allGrns = await newGrn
      .find(filter)

      // Supplier
      .populate(
        "supplierName",
        "supplierName"
      )

      // User who created GRN
      .populate(
        "createdBy",
        "userName"
      )

      // Item
      .populate(
        "items.name",
        "name genericName brandName dosageForm strength"
      )

      // Actual batch
      .populate(
        "items.batch",
        "batchNumber buyingPrice sellingPrice quantityReceived quantityRemaining manufactureDate expireDate status"
      )

      .sort({
        createdAt: -1,
      })

      .skip(skip)

      .limit(limit)

      .lean();

    // =====================================================
    // TOTAL COUNT
    // =====================================================

    const totalCount =
      await newGrn.countDocuments(filter);

    // =====================================================
    // CALCULATE COSTS
    // =====================================================

    let totalItemCost = 0;
    let todayTotalCost = 0;

    const today = new Date();

    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    for (const grn of allGrns) {
      // ---------------------------------------------------
      // TOTAL GRN COST
      // ---------------------------------------------------

      const grnTotal = (grn.items || []).reduce(
        (sum, item) => {
          return sum + (Number(item.totalCost) || 0);
        },
        0
      );

      totalItemCost += grnTotal;

      // ---------------------------------------------------
      // TODAY'S COST
      // ---------------------------------------------------

      const grnDate = new Date(
        grn.receivingDate ||
          grn.createdAt
      );

      if (
        grnDate >= todayStart &&
        grnDate <= todayEnd
      ) {
        todayTotalCost += grnTotal;
      }
    }

    // =====================================================
    // PAGINATION
    // =====================================================

    const totalPages = Math.ceil(
      totalCount / limit
    );

    const hasNextPage =
      page < totalPages;

    const hasPrevPage =
      page > 1;

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      success: true,

      data: allGrns,

      pagination: {
        currentPage: page,
        totalPages,

        totalItems: totalCount,

        itemsPerPage: limit,

        hasNextPage,
        hasPrevPage,

        nextPage: hasNextPage
          ? page + 1
          : null,

        prevPage: hasPrevPage
          ? page - 1
          : null,
      },

      summary: {
        totalItemCost,
        todayTotalCost,
      },

      message:
        "GRNs fetched successfully",
    });
  } catch (error) {
    console.error(
      "Error fetching GRNs:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch GRNs",
      error: error.message,
    });
  }
};

// Get all Billed Items in Non PO GRNs
export const billedItemsNonPo = async (req, res) => {
  try {
    // =====================================================
    // GET GRNS WITH BILLED ITEMS
    // =====================================================

    const grns = await newGrn
      .find({
        "items.status": "Billed",
      })

      // ---------------------------------------------------
      // SUPPLIER
      // ---------------------------------------------------

      .populate(
        "supplierName",
        "supplierName"
      )

      // ---------------------------------------------------
      // USER
      // ---------------------------------------------------

      .populate(
        "createdBy",
        "firstName lastName userName"
      )

      // ---------------------------------------------------
      // ITEM
      // ---------------------------------------------------

      .populate(
        "items.name",
        "name genericName brandName dosageForm strength"
      )

      // ---------------------------------------------------
      // BATCH
      // ---------------------------------------------------

      .populate(
        "items.batch",
        "batchNumber buyingPrice quantityReceived quantityRemaining manufactureDate expireDate status"
      )

      .sort({
        createdAt: -1,
      })

      .lean();

    // =====================================================
    // GROUP BILLS BY SUPPLIER
    // =====================================================

    const supplierBills = {};

    grns.forEach((grn) => {
      const supplierId =
        grn.supplierName?._id?.toString() ||
        "unknown";

      // ---------------------------------------------------
      // INITIALIZE SUPPLIER
      // ---------------------------------------------------

      if (!supplierBills[supplierId]) {
        supplierBills[supplierId] = {
          supplierId,

          supplierName:
            grn.supplierName?.supplierName ||
            "Unknown",

          createdBy: grn.createdBy
            ? `${grn.createdBy.firstName || ""} ${
                grn.createdBy.lastName || ""
              }`.trim()
            : "Unknown",

          items: [],

          totalBilledAmount: 0,

          totalPaidAmount: 0,

          totalRemainingBalance: 0,
        };
      }

      // ===================================================
      // FILTER PENDING BILLS
      // ===================================================

      const billedItems =
        (grn.items || []).filter(
          (item) =>
            item.status === "Billed" &&
            Number(item.remainingBalance) > 0
        );

      // ===================================================
      // ADD BILLED ITEMS
      // ===================================================

      billedItems.forEach((item) => {
        supplierBills[supplierId].items.push({
          // ------------------------------------------------
          // GRN
          // ------------------------------------------------

          grnId: grn._id,

          stockIdentifier:
            grn.stockIdentifier,

          invoiceNumber:
            grn.invoiceNumber,

          receivingDate:
            grn.receivingDate,

          // ------------------------------------------------
          // ITEM
          // ------------------------------------------------

          itemId:
            item.name?._id,

          name:
            item.name?.name ||
            "Unknown",

          genericName:
            item.name?.genericName ||
            null,

          brandName:
            item.name?.brandName ||
            null,

          dosageForm:
            item.name?.dosageForm ||
            null,

          strength:
            item.name?.strength ||
            null,

          // ------------------------------------------------
          // BATCH
          // ------------------------------------------------

          batchId:
            item.batch?._id ||
            null,

          batchNumber:
            item.batch?.batchNumber ||
            item.batchNumber ||
            null,

          manufactureDate:
            item.batch?.manufactureDate ||
            item.manufactureDate ||
            null,

          expireDate:
            item.batch?.expireDate ||
            item.expiryDate ||
            null,

          quantityRemaining:
            item.batch?.quantityRemaining ??
            null,

          // ------------------------------------------------
          // STOCK / PRICING
          // ------------------------------------------------

          quantity:
            item.quantity || 0,

          buyingPrice:
            item.buyingPrice || 0,

          sellingPrice:
            item.sellingPrice || 0,

          // ------------------------------------------------
          // BILLING
          // ------------------------------------------------

          billedAmount:
            item.billedAmount || 0,

          billedTotalCost:
            item.billedTotalCost || 0,

          paidAmount:
            item.paidAmount || 0,

          remainingBalance:
            item.remainingBalance || 0,

          isFullyPaid:
            item.isFullyPaid || false,

          // ------------------------------------------------
          // OTHER
          // ------------------------------------------------

          comments:
            item.comments || "",

          createdAt:
            grn.createdAt,
        });

        // =================================================
        // SUPPLIER TOTALS
        // =================================================

        supplierBills[supplierId]
          .totalBilledAmount +=
          Number(item.billedTotalCost) || 0;

        supplierBills[supplierId]
          .totalPaidAmount +=
          Number(item.paidAmount) || 0;

        supplierBills[supplierId]
          .totalRemainingBalance +=
          Number(item.remainingBalance) || 0;
      });
    });

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      success: true,

      data: Object.values(
        supplierBills
      ),

      message:
        "Supplier bills fetched successfully",
    });
  } catch (error) {
    console.error(
      "Error fetching billed GRNs:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch billed supplier bills",

      error: error.message,
    });
  }
};


// Make payment for billed GRN itemm
export const makePartialPaymentOld = async (req, res) => {
  const { grnId, itemId, paymentAmount } = req.body;

  if (!grnId || !itemId || !paymentAmount || paymentAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "grnId, itemId, and positive paymentAmount are required",
    });
  }

  try {
    // Find the GRN containing the item
    const grn = await newGrn.findOne({ _id: grnId, "items._id": itemId });

    if (!grn) {
      return res.status(404).json({
        success: false,
        message: "GRN or item not found",
      });
    }

    // Find the specific item
    const item = grn.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found in this GRN",
      });
    }

    if (item.isFullyPaid) {
      return res.status(400).json({
        success: false,
        message: "Item is already fully paid",
      });
    }

    // Calculate new balances
    const newPaidAmount = Number(item.paidAmount || 0) + Number(paymentAmount);
    const remainingBalance = Math.max(
      (item.billedTotalCost || 0) - newPaidAmount,
      0
    );
    const isFullyPaid = remainingBalance === 0;

    // Update item fields
    item.paidAmount = newPaidAmount;
    item.remainingBalance = remainingBalance;
    item.isFullyPaid = isFullyPaid;

    // Change status to Completed if fully paid
    if (isFullyPaid) {
      item.status = "Completed";
    }

    item.changedAt = new Date();

    // Save the GRN
    await grn.save();

    return res.status(200).json({
      success: true,
      message: "Payment applied successfully",
      data: item,
    });
  } catch (error) {
    console.error("Error processing payment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to apply payment",
      error: error.message,
    });
  }
};

// Make payment for billed GRN items by supplier (FIFO)
export const makePartialPayment = async (req, res) => {
  const {
    supplierId,
    paymentAmount,
  } = req.body;

  // =====================================================
  // VALIDATE SUPPLIER
  // =====================================================

  if (
    !supplierId ||
    !mongoose.Types.ObjectId.isValid(
      supplierId
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid supplierId is required",
    });
  }

  // =====================================================
  // VALIDATE PAYMENT
  // =====================================================

  const amount = Number(paymentAmount);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return res.status(400).json({
      success: false,
      message:
        "A positive paymentAmount is required",
    });
  }

  // =====================================================
  // MONEY HELPER
  // =====================================================

  const roundMoney = (value) =>
    Math.round(
      (Number(value) + Number.EPSILON) * 100
    ) / 100;

  try {
    // ===================================================
    // GET ALL BILLED GRNS FOR SUPPLIER
    // ===================================================

    const grns = await newGrn
      .find({
        supplierName: supplierId,
        "items.status": "Billed",
      })
      .sort({
        createdAt: 1,
      });

    // ===================================================
    // CHECK BILLS
    // ===================================================

    if (!grns.length) {
      return res.status(404).json({
        success: false,
        message:
          "No billed items found for this supplier",
      });
    }

    // ===================================================
    // PAYMENT PROCESSING
    // ===================================================

    let remainingPayment =
      roundMoney(amount);

    const updatedItems = [];

    // ===================================================
    // FIFO PAYMENT
    // Oldest GRN / oldest bill first
    // ===================================================

    for (const grn of grns) {
      let grnChanged = false;

      for (const item of grn.items) {
        // ------------------------------------------------
        // SKIP COMPLETED / EMPTY BILLS
        // ------------------------------------------------

        const currentBalance =
          roundMoney(
            item.remainingBalance || 0
          );

        if (
          item.status !== "Billed" ||
          currentBalance <= 0 ||
          remainingPayment <= 0
        ) {
          continue;
        }

        // ------------------------------------------------
        // CALCULATE PAYMENT
        // ------------------------------------------------

        const deduction = roundMoney(
          Math.min(
            currentBalance,
            remainingPayment
          )
        );

        // ------------------------------------------------
        // UPDATE PAYMENT
        // ------------------------------------------------

        item.paidAmount = roundMoney(
          (item.paidAmount || 0) +
            deduction
        );

        item.remainingBalance =
          roundMoney(
            currentBalance -
              deduction
          );

        remainingPayment =
          roundMoney(
            remainingPayment -
              deduction
          );

        // ------------------------------------------------
        // CHECK FULL PAYMENT
        // ------------------------------------------------

        if (
          item.remainingBalance <= 0
        ) {
          item.remainingBalance = 0;

          item.isFullyPaid = true;

          item.status = "Completed";
        } else {
          item.isFullyPaid = false;

          item.status = "Billed";
        }

        // ------------------------------------------------
        // AUDIT
        // ------------------------------------------------

        item.changedAt = new Date();

        grnChanged = true;

        // ------------------------------------------------
        // RETURN UPDATED ITEM
        // ------------------------------------------------

        updatedItems.push({
          grnId: grn._id,

          stockIdentifier:
            grn.stockIdentifier,

          invoiceNumber:
            grn.invoiceNumber,

          itemId:
            item._id,

          name:
            item.name,

          batchId:
            item.batch || null,

          batchNumber:
            item.batchNumber || null,

          billedTotalCost:
            item.billedTotalCost || 0,

          paidBefore:
            roundMoney(
              (item.paidAmount || 0) -
                deduction
            ),

          paidNow:
            deduction,

          paidTotal:
            item.paidAmount,

          remainingBalance:
            item.remainingBalance,

          status:
            item.status,

          isFullyPaid:
            item.isFullyPaid,
        });
      }

      // =================================================
      // SAVE GRN ONLY IF CHANGED
      // =================================================

      if (grnChanged) {
        grn.lastModifiedBy =
          req.userId;

        await grn.save();
      }

      // =================================================
      // STOP WHEN PAYMENT IS FULLY ALLOCATED
      // =================================================

      if (
        remainingPayment <= 0
      ) {
        break;
      }
    }

    // =====================================================
    // TOTAL ACTUALLY PAID
    // =====================================================

    const totalPaid =
      roundMoney(
        amount -
          remainingPayment
      );

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      success: true,

      message:
        "Supplier payment applied successfully",

      data: {
        supplierId,

        paymentAmount: amount,

        totalPaid,

        remainingUnallocated:
          remainingPayment,

        updatedItems,
      },
    });
  } catch (error) {
    console.error(
      "Error paying supplier bill:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to apply supplier payment",

      error: error.message,
    });
  }
};


//Update Non PO GRN Item Status to Billed
export const updateNonBill = async (req, res) => {
  const { grnId, itemId, billedAmount, userId } = req.body;

  try {
    const grn = await newGrn
      .findById(grnId)
      .populate("supplierName", "supplierName");

    if (!grn) {
      return res.status(404).json({ success: false, message: "GRN not found" });
    }

    const item = grn.items.id(itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in GRN" });
    }

    if (item.status === "Completed") {
      return res
        .status(400)
        .json({ success: false, message: "Item already marked as Completed" });
    }

    const oldStatus = item.status;
    item.status = "Completed";
    await grn.save();

    // Calculate total cost
    const billedTotalCost = (item.buyingPrice || 0) * (item.billedAmount || 0);

    // Resolve item name
    let itemName = "Unknown";
    if (typeof item.name === "object" && item.name.name) {
      itemName = item.name.name;
    } else {
      const itemDoc = await Items.findById(item.name);
      if (itemDoc) itemName = itemDoc.name;
    }

    const supplier = grn.supplierName?.supplierName || "Unknown";

    // Create billedNon report WITH PAYMENT FIELDS
    const report = new billedNon({
      grnId: grn._id,
      itemId: item._id,
      itemName,
      supplier,
      buyingPrice: item.buyingPrice || 0,
      billedAmount: item.billedAmount || 0,
      billedTotalCost,
      paidAmount: 0, // Initial payment is 0
      remainingBalance: billedTotalCost, // Full amount remains
      isFullyPaid: false,
      oldStatus,
      newStatus: item.status,
      createdBy: req.userId,
    });

    await report.save();

    res.status(200).json({
      success: true,
      message: "Item status updated and report saved with payment tracking",
      report,
    });
  } catch (error) {
    console.error("Error updating billed item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update item and save report",
      error: error.message,
    });
  }
};

//Bill Non PO Report
export const billNonPoReport = async (req, res) => {
  try {
    // Fetch all GRNs that contain at least one fully paid billed item
    const grns = await newGrn
      .find({ "items.isFullyPaid": true, "items.billedAmount": { $gt: 0 } })
      .populate("supplierName", "supplierName")
      .populate("createdBy", "firstName lastName")
      .populate("items.name", "name")
      .sort({ createdAt: -1 })
      .lean();

    const reportData = [];

    grns.forEach((grn) => {
      const fullyPaidBilledItems = grn.items.filter(
        (item) => item.isFullyPaid && item.billedAmount > 0
      );

      fullyPaidBilledItems.forEach((item) => {
        reportData.push({
          grnId: grn._id,
          grnNumber: grn.stockIdentifier,
          itemId: item._id,
          itemName: item.name?.name || "Unknown",
          supplier: grn.supplierName?.supplierName || "Unknown",
          createdBy: grn.createdBy
            ? `${grn.createdBy.firstName} ${grn.createdBy.lastName}`
            : "Unknown",
          billedAmount: item.billedAmount || 0,
          billedTotalCost: item.billedTotalCost || 0,
          paidAmount: item.paidAmount || 0,
          remainingBalance: item.remainingBalance || 0,
          status: item.status, // should be Completed
          completedAt: item.changedAt || grn.updatedAt,
          createdAt: grn.createdAt,
        });
      });
    });

    return res.status(200).json({
      success: true,
      data: reportData,
      message: "Fully paid billed items fetched successfully",
    });
  } catch (err) {
    console.error("Error fetching fully paid billed items report:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch fully paid billed items report",
      error: err.message,
    });
  }
};
