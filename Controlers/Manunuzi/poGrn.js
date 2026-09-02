import poGrn from "../../Models/Manunuzi/poGrn.js";
import Items from "../../Models/Items/items.js";
import supplier from "../../Models/Manunuzi/supplier.js";
import { v4 as uuidv4 } from "uuid";
import outStand from "../../Models/Manunuzi/outStandReport.js";
import billed from "../../Models/Manunuzi/billReport.js";

export const addPoGrn = async (req, res) => {
  const {
    items,
    supplierName,
    invoiceNumber,
    lpoNumber,
    deliveryPerson,
    deliveryNumber,
    description,
    receivingDate,
    grnNumber,
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Items must be a non-empty array",
    });
  }

  try {
    const supplierDetails = await supplier.findOne({
      supplierName: { $regex: new RegExp(`^${supplierName.trim()}$`, "i") },
    });

    if (!supplierDetails) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    const stockIdentifier = uuidv4();
    const itemEntries = [];

    for (const item of items) {
      const itemDetails = await Items.findOne({ name: item.name });

      if (!itemDetails) {
        return res.status(404).json({
          success: false,
          message: `Item ${item.name} not found`,
        });
      }

      // Update item quantity and details
      itemDetails.itemQuantity =
        Number(itemDetails.itemQuantity) +
        Number(item.receivedQuantity) +
        Number(item.billedAmount);
      itemDetails.manufactureDate = item.manufactureDate;
      itemDetails.expireDate = item.expiryDate;
      itemDetails.price = item.newSellingPrice;
      await itemDetails.save();

      // Determine status based on billedAmount
      const status =
        item.billedAmount && item.billedAmount > 0 ? "Billed" : "Completed";

      // Add item to list
      itemEntries.push({
        name: itemDetails._id,
        requiredQuantity: item.requiredQuantity,
        receivedQuantity: item.receivedQuantity,
        outstandingQuantity: item.requiredQuantity - item.receivedQuantity,
        newBuyingPrice: item.newBuyingPrice,
        newSellingPrice: item.newSellingPrice,
        batchNumber: item.batchNumber,
        manufactureDate: item.manufactureDate,
        expiryDate: item.expiryDate,
        receivedDate: item.receivedDate || new Date(),
        foc: item.foc,
        rejected: item.rejected,
        billedAmount: item.billedAmount,
        comments: item.comments,
        totalCost: item.totalCost,
        status,
      });
    }

    // Save one GRN document with all items
    const newGrn = new poGrn({
      stockIdentifier,
      items: itemEntries,
      supplierName: supplierDetails._id,
      invoiceNumber,
      lpoNumber,
      deliveryPerson,
      deliveryNumber,
      description,
      receivingDate,
      grnNumber,
      createdBy: req.userId,
    });

    const saved = await newGrn.save();

    res.status(200).json({
      success: true,
      message: "New GRN added with all items",
      data: saved,
    });
  } catch (error) {
    console.error("Error adding GRN:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to add GRN",
      error: error.message,
    });
  }
};

export const outstandingGrn = async (req, res) => {
  try {
    const records = await poGrn
      .find({ "items.outstandingQuantity": { $gt: 0 } })
      .populate("items.name", "name")
      .populate("supplierName", "supplierName")
      .populate("createdBy", "firstName lastName")
      .select(
        "items supplierName invoiceNumber receivingDate createdBy createdAt"
      )
      .lean();

    const outstandingItems = [];

    records.forEach((record) => {
      record.items.forEach((item) => {
        if (item.outstandingQuantity > 0) {
          outstandingItems.push({
            grnId: record._id,
            itemId: item.name._id,
            name: item.name.name,
            supplier: record.supplierName?.supplierName || "Unknown",
            requiredQuantity: item.requiredQuantity,
            outstandingQuantity: item.outstandingQuantity,
            newBuyingPrice: item.newBuyingPrice,
            invoiceNumber: record.invoiceNumber,
            receivingDate: record.receivingDate,
            createdBy: record.createdBy || "N/A",
            createdAt: record.createdAt,
          });
        }
      });
    });

    res.status(200).json({
      success: true,
      data: outstandingItems,
    });
  } catch (error) {
    console.error("Error fetching outstanding items:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch outstanding items",
    });
  }
};

export const getGrnPo = async (req, res) => {
  const { id } = req.params;

  try {
    const grn = await poGrn
      .findById(id)
      .populate("items.name", "name")
      .populate("supplierName", "supplierName")
      .populate("createdBy", "firstName lastName")
      .lean();

    if (!grn) {
      return res.status(404).json({ success: false, message: "GRN not found" });
    }

    // Prepare data for modal
    const formattedItems = grn.items.map((item) => ({
      name: item.name?.name || "Unknown Item",
      requiredQuantity: item.requiredQuantity,
      receivedQuantity: item.receivedQuantity,
      outstandingQuantity: item.outstandingQuantity,
      batchNumber: item.batchNumber,
      newBuyingPrice: item.newBuyingPrice,
      newSellingPrice: item.newSellingPrice,
      manufactureDate: item.manufactureDate,
      expiryDate: item.expiryDate,
      foc: item.foc,
      rejected: item.rejected,
      comments: item.comments,
      totalCost: item.totalCost,
      status: item.status,
    }));

    res.status(200).json({
      success: true,
      grnNumber: grn.grnNumber,
      supplierName: grn.supplierName?.supplierName || "Unknown Supplier",
      invoiceNumber: grn.invoiceNumber,
      receivingDate: grn.receivingDate,
      createdBy: grn.createdBy?.username || "Unknown",
      items: formattedItems,
    });
  } catch (error) {
    console.error("Error fetching GRN details:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch GRN items",
    });
  }
};

export const allGrnsPo = async (req, res) => {
  try {
    const grns = await poGrn
      .find({})
      .populate("items.name", "name")
      .populate("supplierName", "supplierName")
      .populate("createdBy", "firstName lastName")
      .lean();

    if (!grns || grns.length === 0) {
      return res.status(200).json({
        success: true,
        totalCost: 0,
        todayTotalCost: 0,
        data: [],
        message: "No GRNs found",
      });
    }

    let totalCost = 0;
    let todayTotalCost = 0;
    const today = new Date();
    const todayDateStr = today.toISOString().split("T")[0]; // e.g., '2025-07-07'

    const formattedGrns = grns.map((grn) => {
      const items = grn.items.map((item) => {
        const itemCost = item.totalCost || 0;
        totalCost += itemCost;

        // Check if this GRN is from today
        const grnDateStr = new Date(grn.receivingDate)
          .toISOString()
          .split("T")[0];
        if (grnDateStr === todayDateStr) {
          todayTotalCost += itemCost;
        }

        return {
          name: item.name?.name || "Unknown Item",
          requiredQuantity: item.requiredQuantity,
          receivedQuantity: item.receivedQuantity,
          outstandingQuantity: item.outstandingQuantity,
          batchNumber: item.batchNumber,
          newBuyingPrice: item.newBuyingPrice,
          newSellingPrice: item.newSellingPrice,
          manufactureDate: item.manufactureDate,
          expiryDate: item.expiryDate,
          foc: item.foc,
          rejected: item.rejected,
          comments: item.comments,
          totalCost: item.totalCost,
          status: item.status,
        };
      });

      return {
        grnNumber: grn.grnNumber,
        supplierName: grn.supplierName?.supplierName || "Unknown Supplier",
        invoiceNumber: grn.invoiceNumber,
        receivingDate: grn.receivingDate,
        createdBy: grn.createdBy || "Unknown",
        items,
      };
    });

    res.status(200).json({
      success: true,
      totalCost,
      todayTotalCost,
      data: formattedGrns,
    });
  } catch (error) {
    console.error("Failed to get all GRNs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch GRNs",
    });
  }
};

export const updateOutstand = async (req, res) => {
  const { grnId, itemId, filledQuantity } = req.body;

  if (!grnId || !itemId || !filledQuantity || filledQuantity <= 0) {
    return res.status(400).json({ success: false, message: "Invalid input" });
  }

  try {
    const grn = await poGrn.findById(grnId);
    if (!grn) {
      return res.status(404).json({ success: false, message: "GRN not found" });
    }

    const item = grn.items.find((i) => i.name.toString() === itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in GRN" });
    }

    if (item.outstandingQuantity < filledQuantity) {
      return res.status(400).json({
        success: false,
        message: "Filled quantity exceeds outstanding",
      });
    }

    // Update GRN item quantities
    item.receivedQuantity += filledQuantity;
    item.outstandingQuantity -= filledQuantity;
    item.lastModifiedBy = req.userId;

    await grn.save();

    // Update item stock
    const stockItem = await Items.findById(itemId);
    if (!stockItem) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in stock" });
    }

    stockItem.itemQuantity += filledQuantity;
    await stockItem.save();

    // Log this update for reporting
    await outStand.create({
      grnId,
      itemId,
      filledQuantity,
      lastModifiedBy: req.userId,
    });

    res
      .status(200)
      .json({ success: true, message: "GRN and stock updated successfully" });
  } catch (err) {
    console.error("Error in updateOutstand:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const outStandReport = async (req, res) => {
  try {
    const logs = await GrnUpdateLog.find()
      .populate("grnId", "grnNumber")
      .populate("itemId", "name")
      .populate("updatedBy", "firstName lastName")
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    console.error("Error fetching report:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const billOtherDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const grn = await poGrn
      .findById(id)
      .populate("items.name", "name")
      .populate("supplierName", "supplierName")
      .populate("createdBy", "firstName lastName")
      .lean();

    if (!grn) {
      return res.status(404).json({ success: false, message: "GRN not found" });
    }

    // Format for frontend preview
    const allItems = grn.items.map((item) => ({
      name: item.name?.name._id,
      name: item.name.name,
      requiredQuantity: item.requiredQuantity,
      receivedQuantity: item.receivedQuantity,
      outstandingQuantity: item.outstandingQuantity,
      newBuyingPrice: item.newBuyingPrice,
      newSellingPrice: item.newSellingPrice,
      expiryDate: item.expiryDate,
      batchNumber: item.batchNumber,
      status: item.status,
    }));

    res.status(200).json({
      success: true,
      data: {
        grnId: grn._id,
        supplier: grn.supplierName?.supplierName || "Unknown",
        invoiceNumber: grn.invoiceNumber,
        receivingDate: grn.receivingDate,
        createdBy: grn.createdBy|| "N/A",
        createdAt: grn.createdAt,
        items: allItems,
      },
    });
  } catch (err) {
    console.error("Error fetching GRN by ID:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching GRN preview",
    });
  }
};

export const biilledItems = async (req, res) => {
  try {
    const records = await poGrn
      .find({ "items.status": "Billed" })
      .populate("items.name", "name")
      .populate("supplierName", "supplierName")
      .populate("createdBy", "firstName lastName")
      .select(
        "items supplierName invoiceNumber receivingDate createdBy createdAt"
      )
      .lean();

    const billedItems = [];

    records.forEach((record) => {
      record.items.forEach((item) => {
        if (item.status === "Billed") {
          billedItems.push({
            grnId: record._id,
            itemId: item._id,
            name: item.name?.name,
            billedAmount: item.billedAmount || 0,
            supplier: record.supplierName?.supplierName || "Unknown",
            requiredQuantity: item.requiredQuantity,
            receivedQuantity: item.receivedQuantity,
            newBuyingPrice: item.newBuyingPrice,
            newSellingPrice: item.newSellingPrice,
            billedTotalCost:
              (item.newBuyingPrice || 0) * (item.billedAmount || 0),
            invoiceNumber: record.invoiceNumber,
            receivingDate: record.receivingDate,
            createdBy: record.createdBy || "N/A",
            createdAt: record.createdAt,
          });
        }
      });
    });

    res.status(200).json({
      success: true,
      data: billedItems,
    });
  } catch (error) {
    console.error("Error fetching billed items:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch billed items",
    });
  }
};

export const updateBill = async (req, res) => {
  const { grnId, itemId } = req.body;

  try {
    // Populate both supplierName and items.name
    const grn = await poGrn
      .findById(grnId)
      .populate("supplierName", "supplierName")
      .populate("items.name", "name")
      .exec();

    if (!grn) {
      return res.status(404).json({ success: false, message: "GRN not found" });
    }

    // Find the embedded item by _id (subdocument ID)
    const item = grn.items.id(itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in GRN" });
    }

    if (item.status === "Completed") {
      return res
        .status(400)
        .json({ success: false, message: "Item already completed" });
    }

    const oldStatus = item.status;
    item.status = "Completed";
    await grn.save();

    const newBuyingPrice = item.newBuyingPrice || 0;
    const billedTotalCost = newBuyingPrice * (item.billedAmount || 0);

    const report = new billed({
      grnId: grn._id,
      itemId: item._id,
      itemName: item.name?.name || "Unknown", // Now returns correct name
      supplier: grn.supplierName?.supplierName || "Unknown",
      newBuyingPrice: item.newBuyingPrice || 0,
      billedAmount: item.billedAmount || 0,
      oldStatus,
      newStatus: item.status,
      billedTotalCost,
      createdBy: req.userId,
    });

    await report.save();

    console.log(report);

    res.status(200).json({
      success: true,
      message: "Item marked as Completed and report saved",
      report,
    });
  } catch (error) {
    console.error("Error updating and reporting:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update and store report",
      error: error.message,
    });
  }
};

export const billedReport = async (req, res) => {
  try {
    const logs = await billed
      .find()
      .populate("grnId", "grnNumber")
      .populate("itemName", "name")
      .populate("createdBy", "firstName lastName")
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    console.error("Error fetching billed updates:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
