import items from "../../Models/Items/items.js";
import supplier from "../../Models/Manunuzi/supplier.js";
import po from "../../Models/Manunuzi/manunuziHold.js";
import { v4 as uuidv4 } from "uuid";

export const addPo = async (req, res) => {
  const { allItems, supplierName, comments } = req.body;

  if (!Array.isArray(allItems) || allItems.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "Items are required" });
  }

  try {
    const itemEntries = await Promise.all(
      allItems.map(async (entry) => {
        const itemDoc = await items.findOne({ name: entry.name });

        if (!itemDoc) {
          throw new Error(`Item '${entry.name}' not found`);
        }

        return {
          item: itemDoc._id,
          requiredQuantity: entry.requiredQuantity,
          description: entry.description || "",
        };
      })
    );

    // Find supplier details
    const supplierDetails = await supplier.findOne({ supplierName });

    if (!supplierDetails) {
      return res
        .status(404)
        .json({ success: false, message: "Supplier not found" });
    }

    const lastPO = await po.findOne().sort({ createdAt: -1 });
    let newGrnNumber = "GRN-00001";
    if (lastPO && lastPO.grnNumber) {
      const lastNumber = parseInt(lastPO.grnNumber.split("-")[1]);
      const nextNumber = String(lastNumber + 1).padStart(5, "0");
      newGrnNumber = `GRN-${nextNumber}`;
    }

    const newPO = new po({
      grnSessionId: uuidv4(),
      grnNumber: newGrnNumber,
      allItems: itemEntries,
      supplierName: supplierDetails._id,
      comments,
      status: "Pending",
      createdBy: req.userId,
    });

    const savedPO = await newPO.save();

    return res.status(201).json({
      success: true,
      message: "Purchase Order created successfully",
      data: savedPO,
    });
  } catch (error) {
    console.error("Failed to create PO:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create Purchase Order",
    });
  }
};

export const getPo = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const purchaseOrders = await po
      .find(query)
      .populate("allItems.item", "name price")
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: purchaseOrders,
    });
  } catch (error) {
    console.error("Failed to get POs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchase orders",
    });
  }
};

export const updatePo = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  req.body.lastModifiedBy = req.userId;

  if (!["Pending", "Approved", "Rejected"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid status. Must be Pending, Approved, or Rejected.",
    });
  }

  try {
    const updatedPo = await po.findOneAndUpdate(
      { grnSessionId: id },
      { status },
      { new: true }
    );

    if (!updatedPo) {
      return res.status(404).json({
        success: false,
        message: "PO not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "PO status updated successfully",
      data: updatedPo,
    });
  } catch (error) {
    console.error("Failed to update PO status:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating PO status",
    });
  }
};



