import mongoose from "mongoose";
import items from "../../Models/Items/items.js";
import newGrn from "../../Models/Manunuzi/newGrn.js";
import ItemsCategory from "../../Models/Items/itemsCategories.js";
import batches from "../../Models/Items/batches.js";

// Generate numeric barcode
const generateBarcode = () => {
  return Math.floor(1000000 + Math.random() * 90000000).toString();
};

// ADD NEW ITEM
export const addNewItem = async (req, res) => {
  try {
    const {
      name,
      price,
      category,

      // Wholesale
      wholesalePrice,
      wholesaleMinQty,
      enableWholesale,

      // Pharmacy information
      genericName,
      brandName,
      manufacturer,
      dosageForm,
      strength,
      routeOfAdministration,
      requiresPrescription,

      // Other
      reOrder,
      discount,
    } = req.body;

    // =====================================================
    // VALIDATE CATEGORY
    // =====================================================

    if (!category || !mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    // =====================================================
    // VALIDATE ITEM NAME
    // =====================================================

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Item name is required",
      });
    }

    // =====================================================
    // VALIDATE SELLING PRICE
    // =====================================================

    if (
      price === undefined ||
      price === null ||
      price === "" ||
      Number(price) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid selling price is required",
      });
    }

    // =====================================================
    // SAFE VALUES
    // =====================================================

    const safePrice = Math.max(0, Number(price));

    const safeDiscount = Math.max(
      0,
      Number(discount) || 0
    );

    const safeWholesalePrice = Math.max(
      0,
      Number(wholesalePrice) || 0
    );

    const safeWholesaleMinQty = Math.max(
      0,
      Number(wholesaleMinQty) || 0
    );

    const safeReOrder = Math.max(
      0,
      Number(reOrder) || 0
    );

    // =====================================================
    // WHOLESALE VALIDATION
    // =====================================================

    const wholesaleEnabled =
      enableWholesale === true &&
      safeWholesalePrice > 0 &&
      safeWholesaleMinQty > 0;

    // =====================================================
    // GENERATE UNIQUE BARCODE
    // =====================================================

    let barCode;
    let exists = true;

    while (exists) {
      barCode = generateBarcode();

      exists = await items.exists({
        barCode,
      });
    }

    // =====================================================
    // CREATE ITEM
    // =====================================================

    const newItem = new items({
      // ---------------------------------------------------
      // Basic information
      // ---------------------------------------------------

      name: name.trim(),

      price: safePrice,

      category,

      barCode,

      // ---------------------------------------------------
      // Wholesale
      // ---------------------------------------------------

      wholesalePrice: safeWholesalePrice,

      wholesaleMinQty: safeWholesaleMinQty,

      enableWholesale: wholesaleEnabled,

      // ---------------------------------------------------
      // Pharmacy information
      // ---------------------------------------------------

      genericName: genericName?.trim() || undefined,

      brandName: brandName?.trim() || undefined,

      manufacturer: manufacturer?.trim() || undefined,

      dosageForm: dosageForm || "Other",

      strength: strength?.trim() || undefined,

      routeOfAdministration:
        routeOfAdministration?.trim() || undefined,

      requiresPrescription:
        requiresPrescription === true,

      // ---------------------------------------------------
      // Inventory
      // ---------------------------------------------------

      // Stock is added later through GRN / Batch.
      itemQuantity: 0,

      reOrder: safeReOrder,

      reOrderStatus: "Normal",

      // ---------------------------------------------------
      // Discount
      // ---------------------------------------------------

      discount: safeDiscount,

      // ---------------------------------------------------
      // Status
      // ---------------------------------------------------

      status: "Active",

      // ---------------------------------------------------
      // Audit
      // ---------------------------------------------------

      createdBy: req.userId,
    });

    // =====================================================
    // SAVE ITEM
    // =====================================================

    const savedItem = await newItem.save();

    return res.status(201).json({
      success: true,
      message: "Item added successfully!",
      data: savedItem,
    });
  } catch (error) {
    console.error("Error adding item:", error);

    // =====================================================
    // DUPLICATE KEY
    // =====================================================

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An item with this barcode already exists",
      });
    }

    // =====================================================
    // SERVER ERROR
    // =====================================================

    return res.status(500).json({
      success: false,
      message: "Could not add item",
      error: error.message,
    });
  }
};


// UPDATE ITEM
export const editItem = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      price,
      category,

      // Wholesale
      wholesalePrice,
      wholesaleMinQty,
      enableWholesale,

      // Pharmacy information
      genericName,
      brandName,
      manufacturer,
      dosageForm,
      strength,
      routeOfAdministration,
      requiresPrescription,

      // Other
      reOrder,
      discount,

      // Existing batches
      batches: batchUpdates = [],
    } = req.body;

    // =====================================================
    // VALIDATE ITEM ID
    // =====================================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID",
      });
    }

    // =====================================================
    // FIND ITEM
    // =====================================================

    const existingItem = await items.findById(id);

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    // =====================================================
    // VALIDATE CATEGORY
    // =====================================================

    if (
      !category ||
      !mongoose.Types.ObjectId.isValid(category)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    // =====================================================
    // VALIDATE ITEM NAME
    // =====================================================

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Item name is required",
      });
    }

    // =====================================================
    // VALIDATE SELLING PRICE
    // =====================================================

    if (
      price === undefined ||
      price === null ||
      price === "" ||
      Number(price) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid selling price is required",
      });
    }

    // =====================================================
    // SAFE VALUES
    // =====================================================

    const safePrice = Math.max(
      0,
      Number(price)
    );

    const safeDiscount = Math.max(
      0,
      Number(discount) || 0
    );

    const safeWholesalePrice = Math.max(
      0,
      Number(wholesalePrice) || 0
    );

    const safeWholesaleMinQty = Math.max(
      0,
      Number(wholesaleMinQty) || 0
    );

    const safeReOrder = Math.max(
      0,
      Number(reOrder) || 0
    );

    // =====================================================
    // WHOLESALE
    // =====================================================

    const wholesaleEnabled =
      enableWholesale === true &&
      safeWholesalePrice > 0 &&
      safeWholesaleMinQty > 0;

    // =====================================================
    // UPDATE ITEM
    // =====================================================

    existingItem.name = name.trim();

    existingItem.price = safePrice;

    existingItem.category = category;

    // -----------------------------------------------------
    // Wholesale
    // -----------------------------------------------------

    existingItem.wholesalePrice =
      safeWholesalePrice;

    existingItem.wholesaleMinQty =
      safeWholesaleMinQty;

    existingItem.enableWholesale =
      wholesaleEnabled;

    // -----------------------------------------------------
    // Pharmacy information
    // -----------------------------------------------------

    existingItem.genericName =
      genericName?.trim() || undefined;

    existingItem.brandName =
      brandName?.trim() || undefined;

    existingItem.manufacturer =
      manufacturer?.trim() || undefined;

    existingItem.dosageForm =
      dosageForm || "Other";

    existingItem.strength =
      strength?.trim() || undefined;

    existingItem.routeOfAdministration =
      routeOfAdministration?.trim() || undefined;

    existingItem.requiresPrescription =
      requiresPrescription === true;

    // -----------------------------------------------------
    // Other
    // -----------------------------------------------------

    existingItem.reOrder = safeReOrder;

    existingItem.discount = safeDiscount;

    existingItem.reOrderStatus =
      existingItem.itemQuantity <= safeReOrder
        ? "Low"
        : "Normal";

    // -----------------------------------------------------
    // Audit
    // -----------------------------------------------------

    existingItem.lastModifiedBy =
      req.userId;

    // =====================================================
    // SAVE ITEM
    // =====================================================

    const updatedItem = await existingItem.save();

    // =====================================================
    // VALIDATE BATCH ARRAY
    // =====================================================

    if (!Array.isArray(batchUpdates)) {
      return res.status(400).json({
        success: false,
        message: "Batches must be an array",
      });
    }

    // =====================================================
    // UPDATE EXISTING BATCHES
    // =====================================================

    for (const batchData of batchUpdates) {
      const {
        _id: batchId,
        batchNumber,
        buyingPrice,
        manufactureDate,
        expireDate,
        supplier,
      } = batchData;

      // ---------------------------------------------------
      // Validate batch ID
      // ---------------------------------------------------

      if (!batchId) {
        return res.status(400).json({
          success: false,
          message:
            "Batch ID is required when editing a batch",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid batch ID: ${batchId}`,
        });
      }

      // ---------------------------------------------------
      // Validate batch number
      // ---------------------------------------------------

      if (
        !batchNumber ||
        !batchNumber.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Batch number is required",
        });
      }

      // ---------------------------------------------------
      // Validate buying price
      // ---------------------------------------------------

      if (
        buyingPrice === undefined ||
        buyingPrice === null ||
        buyingPrice === "" ||
        Number(buyingPrice) < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Valid buying price is required for batch ${batchNumber}`,
        });
      }

      // ---------------------------------------------------
      // Validate expiry
      // ---------------------------------------------------

      if (!expireDate) {
        return res.status(400).json({
          success: false,
          message:
            `Expiry date is required for batch ${batchNumber}`,
        });
      }

      // ---------------------------------------------------
      // Find existing batch
      // ---------------------------------------------------

      const batch = await batches.findOne({
        _id: batchId,
        item: id,
      });

      if (!batch) {
        return res.status(404).json({
          success: false,
          message:
            `Batch ${batchNumber} was not found for this item`,
        });
      }

      // ---------------------------------------------------
      // Update batch details
      // ---------------------------------------------------

      batch.batchNumber =
        batchNumber.trim();

      batch.buyingPrice =
        Number(buyingPrice);

      batch.manufactureDate =
        manufactureDate || null;

      batch.expireDate =
        new Date(expireDate);

      batch.supplier =
        supplier || undefined;

      // ---------------------------------------------------
      // Update batch status
      // ---------------------------------------------------

      const currentDate = new Date();

      if (
        batch.quantityRemaining <= 0
      ) {
        batch.status = "Depleted";
      } else if (
        batch.expireDate < currentDate
      ) {
        batch.status = "Expired";
      } else {
        batch.status = "Active";
      }

      // ---------------------------------------------------
      // Audit
      // ---------------------------------------------------

      batch.lastModifiedBy =
        req.userId;

      await batch.save();
    }

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      success: true,
      message:
        "Item and batch details updated successfully!",
      data: updatedItem,
    });
  } catch (error) {
    console.error(
      "Error updating item:",
      error
    );

    // =====================================================
    // DUPLICATE KEY
    // =====================================================

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Duplicate barcode or batch number detected",
        error: error.message,
      });
    }

    // =====================================================
    // SERVER ERROR
    // =====================================================

    return res.status(500).json({
      success: false,
      message: "Could not update item",
      error: error.message,
    });
  }
};



// GET ALL ITEMS WITH CATEGORY FILTER AND SEARCH
export const getAllItems = async (req, res) => {
  try {
    const categoryFilter = req.query.category || "";
    const searchQuery = req.query.search || "";

    // =====================================================
    // BUILD ITEM FILTER
    // =====================================================

    const match = {};

    if (categoryFilter) {
      if (!mongoose.Types.ObjectId.isValid(categoryFilter)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      match.category = new mongoose.Types.ObjectId(
        categoryFilter
      );
    }

    // =====================================================
    // SEARCH
    // =====================================================

    if (searchQuery) {
      match.$or = [
        {
          name: {
            $regex: searchQuery,
            $options: "i",
          },
        },
        {
          genericName: {
            $regex: searchQuery,
            $options: "i",
          },
        },
        {
          brandName: {
            $regex: searchQuery,
            $options: "i",
          },
        },
        {
          barCode: {
            $regex: searchQuery,
            $options: "i",
          },
        },
      ];
    }

    // =====================================================
    // GET ITEMS
    // =====================================================

    const foundItems = await items
      .find(match)
      .lean();

    if (!foundItems || foundItems.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // =====================================================
    // GET BATCHES
    // =====================================================

    const itemIds = foundItems.map(
      (item) => item._id
    );

    // Get ALL batches.
    const batchList = await batches
      .find({
        item: {
          $in: itemIds,
        },
      })
      .sort({
        expireDate: 1,
      })
      .lean();

    // =====================================================
    // GROUP BATCHES BY ITEM
    // =====================================================

    const batchMap = {};

    batchList.forEach((batch) => {
      const key = String(batch.item);

      if (!batchMap[key]) {
        batchMap[key] = [];
      }

      batchMap[key].push(batch);
    });

    // =====================================================
    // CURRENT DATE
    // =====================================================

    const currentDate = new Date();

    // =====================================================
    // PREPARE ITEMS
    // =====================================================

    const updatedItems = foundItems.map((item) => {
      const key = String(item._id);

      const itemBatches =
        batchMap[key] || [];

      // ===================================================
      // ACTIVE / AVAILABLE BATCHES
      // ===================================================

      const activeBatches =
        itemBatches.filter((batch) => {
          const quantity =
            Number(batch.quantityRemaining) || 0;

          const expired =
            batch.expireDate &&
            new Date(batch.expireDate) <
              currentDate;

          return quantity > 0 && !expired;
        });

      // ===================================================
      // EXPIRED BATCHES
      // ===================================================

      const expiredBatches =
        itemBatches.filter((batch) => {
          return (
            batch.expireDate &&
            new Date(batch.expireDate) <
              currentDate
          );
        });

      // ===================================================
      // TOTAL CURRENT STOCK
      // ===================================================

      const itemQuantity =
        itemBatches.reduce(
          (total, batch) =>
            total +
            Math.max(
              0,
              Number(
                batch.quantityRemaining
              ) || 0
            ),
          0
        );

      // ===================================================
      // FEFO BATCH
      // ===================================================

      // Batches are already sorted by expiry date.
      //
      // Therefore the first active batch is the
      // batch that should be sold first.
      const firstActiveBatch =
        activeBatches[0] || null;

      // ===================================================
      // BUYING PRICE
      // ===================================================

      // Buying price belongs to the batch.
      //
      // For the item list we show the buying price
      // of the current FEFO batch.
      const buyingPrice =
        firstActiveBatch?.buyingPrice ?? 0;

      // ===================================================
      // SELLING PRICE
      // ===================================================

      // Selling price belongs to the ITEM,
      // not the batch.
      const sellingPrice =
        Number(item.price) || 0;

      // ===================================================
      // ITEM STATUS
      // ===================================================

      let status = "Active";

      if (item.status === "Inactive") {
        status = "Inactive";
      } else if (
        activeBatches.length === 0 &&
        expiredBatches.length > 0
      ) {
        status = "Expired";
      }

      // ===================================================
      // REORDER STATUS
      // ===================================================

      const reOrderStatus =
        itemQuantity <=
        (Number(item.reOrder) || 0)
          ? "Low"
          : "Normal";

      // ===================================================
      // CURRENT FEFO BATCH
      // ===================================================

      const currentBatch =
        firstActiveBatch
          ? {
              _id: firstActiveBatch._id,

              batchNumber:
                firstActiveBatch.batchNumber,

              expireDate:
                firstActiveBatch.expireDate,

              manufactureDate:
                firstActiveBatch.manufactureDate,

              quantityRemaining:
                firstActiveBatch.quantityRemaining,

              buyingPrice:
                firstActiveBatch.buyingPrice,

              supplier:
                firstActiveBatch.supplier,
            }
          : null;

      // ===================================================
      // RETURN ITEM
      // ===================================================

      return {
        ...item,

        // Total stock across ALL batches
        itemQuantity,

        // Buying price of current FEFO batch
        buyingPrice,

        // Selling price belongs to item
        sellingPrice,

        // Current status
        status,

        // Reorder status
        reOrderStatus,

        // All batches
        batches: itemBatches,

        // Batch that should be sold first
        currentBatch,

        // Number of batches
        batchCount: itemBatches.length,

        // Number of expired batches
        expiredBatchCount:
          expiredBatches.length,

        // Number of batches currently available
        activeBatchCount:
          activeBatches.length,
      };
    });

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.json({
      success: true,
      data: updatedItems,
    });
  } catch (error) {
    console.error(
      "Error fetching items:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Couldn't fetch items",
      error: error.message,
    });
  }
};

// GET ITEM COUNTS BY CATEGORY
export const getCountsByCategory = async (req, res) => {
  try {
    const categoriesData = await items.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      }
    ]);

    const categories = await ItemsCategory.find();

    const enriched = categories.map(cat => {
      const found = categoriesData.find(c => c._id?.toString() === cat._id.toString());
      return {
        ...cat._doc,
        itemCount: found ? found.count : 0
      };
    });

    return res.json({ success: true, data: enriched });
  } catch (error) {
    console.log("Error fetching category counts:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET ALL ITEMS RAW (WITHOUT SEARCH OR PAGINATION)
export const getAllItemsRaw = async (req, res) => {
  try {
    const allItems = await items.find({});

    const currentDate = new Date();

    const updatedItems = await Promise.all(
      allItems.map(async (item) => {
        const status =
          item.expireDate && new Date(item.expireDate) < currentDate ? "Expired" : "Active";

        if (item.status !== status) {
          await items.findByIdAndUpdate(item._id, { status });
        }

        return {
          ...item._doc,
          itemQuantity: Math.max(0, item.itemQuantity || 0),
          status,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: updatedItems.length,
      data: updatedItems,
    });
  } catch (error) {
    console.error("Error fetching all items:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch all items",
    });
  }
};

// GET ITEMS PUBLIC
export const getItemsPublic = async (req, res) => {
  try {
    const searchQuery = req.query.search || "";
    
    const match = {};
    if (searchQuery) {
      match.$or = [
        { name: { $regex: searchQuery, $options: "i" } },
        { barCode: { $regex: searchQuery, $options: "i" } },
      ];
    }

    const foundItems = await items
      .find(match)
      .select("name itemQuantity price barCode") // Add barCode for better public display
      .sort({ name: 1 })
      .lean();

    res.status(200).json({ 
      success: true, 
      count: foundItems.length,
      data: foundItems 
    });
  } catch (error) {
    console.error("Error in getItemsPublic:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch items" 
    });
  }
};

// SEARCH ITEM
export const searchItem = async (req, res) => {
  const query = req.query.query;

  if (!query) {
    return res.status(400).json({ 
      success: false, 
      message: "Search query is required" 
    });
  }

  try {
    const allItems = await items.find({
      name: { $regex: query, $options: "i" },
    });

    res.status(200).json({ 
      success: true, 
      data: allItems,
      count: allItems.length 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Error fetching items" 
    });
    console.error("Error fetching items:", error);
  }
};

// POS SEARCH (Name or Barcode)
export const searchItemsInPos = async (req, res) => {
  const searchQuery = req.query.search?.trim() || "";
  const categoryFilter = req.query.category || "";

  try {
    let searchFilter = {};

    if (searchQuery) {
      if (/^\d{4,}$/.test(searchQuery)) {
        searchFilter = { barCode: searchQuery };
      } else {
        searchFilter = { name: { $regex: searchQuery, $options: "i" } };
      }
    }

    if (categoryFilter) {
      searchFilter.category = categoryFilter;
    }

    const results = await items.find(searchFilter);

    const currentDate = new Date();
    const updatedItems = await Promise.all(
      results.map(async (item) => {
        const status =
          item.expireDate && new Date(item.expireDate) < currentDate ? "Expired" : "Active";
        if (item.status !== status) {
          await items.findByIdAndUpdate(item._id, { status });
        }

        return {
          ...item._doc,
          itemQuantity: Math.max(0, item.itemQuantity || 0),
          status,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: updatedItems.length,
      data: updatedItems,
    });
  } catch (error) {
    console.error("Error searching items:", error);
    res.status(500).json({ 
      success: false, 
      message: "Search failed",
      error: error.message 
    });
  }
};