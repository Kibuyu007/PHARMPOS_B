import mongoose from "mongoose";
import Request from "../../Models/Orders/orderRequest.js";
import Item from "../../Models/Items/items.js";
import Order from "../../Models/Orders/orders.js";

// ============= HELPERS =============
const generateRequestNumber = async () => {
  const prefix = "REQ";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const count = await Request.countDocuments({
    requestNumber: { $regex: `^${prefix}-${date}` },
    isDeleted: { $ne: true },
  });
  const sequence = String(count + 1).padStart(4, "0");
  return `${prefix}-${date}-${sequence}`;
};

const generateOrderNumber = async () => {
  const prefix = "ORD";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const count = await Order.countDocuments({
    orderNumber: { $regex: `^${prefix}-${date}` },
  });
  const sequence = String(count + 1).padStart(4, "0");
  return `${prefix}-${date}-${sequence}`;
};

// GET REQUEST BY NUMBER (PUBLIC)
export const getRequestByNumber = async (req, res) => {
  try {
    const { requestNumber } = req.params;

    const request = await Request.findOne({
      requestNumber,
      isDeleted: { $ne: true },
    })
      .populate("items.item", "name price")
      .populate("reviewedBy", "fullName name")
      .populate("order", "orderNumber status grandTotal");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found.",
      });
    }

    console.log(request.items);
    const publicData = {
      _id: request._id,
      requestNumber: request.requestNumber,
      customerName: request.customerName,
      customerPhone: request.customerPhone,
      requestedDeliveryDate: request.requestedDeliveryDate,
      approvedDeliveryDate: request.approvedDeliveryDate,
      status: request.status,
      customerAction: request.customerAction,
      reviewCycle: request.reviewCycle,
      reviewNotes: request.reviewNotes,
      timeline: request.timeline,
      createdAt: request.createdAt,
      items: request.items.map((item) => ({
        itemId:
          item.item && typeof item.item === "object"
            ? item.item._id.toString()
            : item.item?.toString(),

        itemName: item.itemName,

        quantity: item.quantity,

        status: item.status,

        rejectionReason: item.rejectionReason,
      })),

      order: request.order
        ? {
            _id: request.order._id,
            orderNumber: request.order.orderNumber,
            status: request.order.status,
            grandTotal: request.order.grandTotal,
          }
        : null,
    };

    return res.status(200).json({
      success: true,
      data: publicData,
    });
  } catch (error) {
    console.error("Error fetching request:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// CREATE NEW REQUEST
export const createRequest = async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      requestedDeliveryDate,
      items,
      notes,
      source,
    } = req.body;

    if (
      !customerName?.trim() ||
      !customerPhone?.trim() ||
      !requestedDeliveryDate ||
      !items?.length
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields." });
    }

    const requestItems = [];
    for (const item of items) {
      if (!item.itemId || !item.quantity || item.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: "Each item must have valid itemId and quantity >= 1",
        });
      }

      const product = await Item.findById(item.itemId);
      if (!product) {
        return res
          .status(404)
          .json({ success: false, message: `Item not found: ${item.itemId}` });
      }

      // if (product.itemQuantity < item.quantity) {
      //   return res.status(400).json({
      //     success: false,
      //     message: `Insufficient stock for ${product.name}. Available: ${product.itemQuantity}`,
      //   });
      // }

      requestItems.push({
        item: product._id,
        itemName: product.name,
        quantity: item.quantity,
        status: "Pending",
        rejectionReason: "",
      });
    }

    const requestNumber = await generateRequestNumber();

    const request = await Request.create({
      requestNumber,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      requestedDeliveryDate: new Date(requestedDeliveryDate),
      items: requestItems,
      notes: notes || "",
      source: source || "Website",
      status: "Pending Review",
      customerAction: "Waiting",
      reviewCycle: 1,
      timeline: [
        {
          action: "Request Created",
          description: "Customer submitted a new request.",
          actor: "Customer",
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Request submitted successfully.",
      data: { requestNumber: request.requestNumber, _id: request._id },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error.", error: error.message });
  }
};

// GET ALL REQUESTS WITH FILTERS, SEARCH, AND PAGINATION
export const getRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search = "", status, source } = req.query;

    const query = { isDeleted: { $ne: true } };

    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: "i" } },
        { customerPhone: { $regex: search, $options: "i" } },
        { requestNumber: { $regex: search, $options: "i" } },
      ];
    }
    if (status) query.status = status;
    if (source) query.source = source;

    const requests = await Request.find(query)
      .populate("items.item", "name price itemQuantity")
      .populate("order", "orderNumber grandTotal status")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Request.countDocuments(query);

    res.status(200).json({
      success: true,
      data: requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// GET SINGLE REQUEST BY ID
export const getSingleRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid request ID" });
    }

    const request = await Request.findOne({ _id: id, isDeleted: { $ne: true } })
      .populate(
        "items.item",
        "name price wholesalePrice wholesaleMinQty itemQuantity category",
      )
      .populate(
        "order",
        "orderNumber grandTotal totalAmount paymentStatus status",
      )
      .populate("reviewedBy", "name email");

    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// GET PENDING REQUESTS FOR REVIEW
export const getPendingRequests = async (req, res) => {
  try {
    const requests = await Request.find({
      status: "Pending Review",
      isDeleted: { $ne: true },
    })
      .populate("items.item", "name price itemQuantity")
      .populate("reviewedBy", "name email")
      .populate("order", "orderNumber grandTotal status")
      .sort({ createdAt: 1 });

    res
      .status(200)
      .json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// GET CONVERTED REQUESTS
export const getConvertedRequests = async (req, res) => {
  try {
    const requests = await Request.find({
      status: "Converted",
      isDeleted: { $ne: true },
    })
      .populate("items.item", "name price sku")
      .populate("order", "orderNumber totalAmount status")
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// GET REJECTED REQUESTS
export const searchRequests = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q)
      return res
        .status(400)
        .json({ success: false, message: "Search query is required" });

    const query = {
      $or: [
        { customerName: { $regex: q, $options: "i" } },
        { customerPhone: { $regex: q, $options: "i" } },
        { requestNumber: { $regex: q, $options: "i" } },
      ],
      isDeleted: { $ne: true },
    };

    const requests = await Request.find(query)
      .populate("items.item", "name price")
      .populate("order", "orderNumber totalAmount")
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// GET REQUESTS BY STATUS
export const reviewRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      items,
      approvedDeliveryDate,
      deliveryDateChangeReason,
      reviewNotes,
      autoAccept, // Add this to receive from frontend
      hasRejected, // Add this to receive from frontend
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid request ID." });
    }

    const request = await Request.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });
    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });

    if (
      ["Accepted", "Converted", "Cancelled", "Rejected"].includes(
        request.status,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot review a ${request.status} request.`,
      });
    }

    if (!items || items.length !== request.items.length) {
      return res
        .status(400)
        .json({ success: false, message: "All items must be reviewed." });
    }

    // Track if all items are accepted
    let allAccepted = true;
    let hasRejectedItems = false;

    for (const reviewedItem of items) {
      const item = request.items.find(
        (i) => i.item.toString() === reviewedItem.itemId,
      );
      if (!item) continue;

      item.status = reviewedItem.status;
      item.rejectionReason =
        reviewedItem.status === "Rejected"
          ? reviewedItem.rejectionReason || "No reason provided"
          : "";

      // Update tracking variables
      if (reviewedItem.status === "Rejected") {
        allAccepted = false;
        hasRejectedItems = true;
      } else if (reviewedItem.status === "Pending") {
        allAccepted = false;
      }

      request.addTimeline?.(
        reviewedItem.status === "Accepted" ? "Item Accepted" : "Item Rejected",
        `${item.itemName} was ${reviewedItem.status.toLowerCase()}.`,
        "Staff",
        req.userId,
      );
    }

    // Update delivery date if provided
    if (approvedDeliveryDate) {
      const dateChanged =
        new Date(request.requestedDeliveryDate).getTime() !==
        new Date(approvedDeliveryDate).getTime();
      request.approvedDeliveryDate = new Date(approvedDeliveryDate);
      request.deliveryDateChanged = dateChanged;
      request.deliveryDateChangeReason = dateChanged
        ? deliveryDateChangeReason || ""
        : "";
    }

    request.reviewNotes = reviewNotes || "";
    request.reviewedBy = req.userId;
    request.reviewedAt = new Date();

    // ============================================
    // CRITICAL LOGIC: Determine request status
    // ============================================
    if (allAccepted) {
      // ALL items are accepted → Auto-accept the request
      request.status = "Accepted";
      request.customerAction = "Waiting";
      request.addTimeline?.(
        "Auto-Accepted",
        "All items were accepted. Request automatically approved.",
        "Staff",
        req.userId,
      );
    } else if (hasRejectedItems) {
      // Some items are rejected → Wait for customer confirmation
      request.status = "Awaiting Customer Confirmation";
      request.customerAction = "Waiting";
      request.addTimeline?.(
        "Reviewed with Rejections",
        "Some items were rejected. Awaiting customer confirmation.",
        "Staff",
        req.userId,
      );
    } else {
      // Fallback (should not happen, but just in case)
      request.status = "Awaiting Customer Confirmation";
      request.customerAction = "Waiting";
      request.addTimeline?.(
        "Reviewed",
        "Request reviewed. Awaiting customer confirmation.",
        "Staff",
        req.userId,
      );
    }

    await request.save();

    // Return appropriate message based on status
    let message = "Request reviewed successfully.";
    if (request.status === "Accepted") {
      message = "All items accepted. Request automatically approved.";
    } else if (request.status === "Awaiting Customer Confirmation") {
      message = "Review submitted. Waiting for customer confirmation.";
    }

    res.status(200).json({
      success: true,
      message: message,
      data: request,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// CUSTOMER ACTIONS: ACCEPT OR AMEND REQUEST
export const customerAcceptRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });

    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });
    if (request.status !== "Awaiting Customer Confirmation") {
      return res.status(400).json({
        success: false,
        message: "Request is not awaiting confirmation.",
      });
    }

    const hasRejectedItems = request.items.some(
      (item) => item.status === "Rejected",
    );
    if (hasRejectedItems) {
      return res.status(400).json({
        success: false,
        message: "Cannot accept request with rejected items.",
      });
    }

    request.status = "Accepted";
    request.customerAction = "Accepted";
    request.addTimeline?.(
      "Customer Accepted",
      "Customer accepted the reviewed request.",
      "Customer",
    );

    await request.save();

    res.status(200).json({
      success: true,
      message: "Request accepted successfully.",
      data: request,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// CUSTOMER AMEND REQUEST
export const customerAmendRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, requestedDeliveryDate, notes, customerComment } = req.body;

    const request = await Request.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });
    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });

    if (
      ["Accepted", "Converted", "Cancelled", "Rejected"].includes(
        request.status,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot amend a ${request.status} request.`,
      });
    }

    if (!items || !items.length) {
      return res
        .status(400)
        .json({ success: false, message: "At least one item is required." });
    }

    const previousItems = request.items.map((item) => ({
      item: item.item,
      itemName: item.itemName,
      quantity: item.quantity,
    }));

    const updatedItems = [];
    for (const newItem of items) {
      const product = await Item.findById(newItem.itemId);
      if (!product)
        return res.status(404).json({
          success: false,
          message: `Item not found: ${newItem.itemId}`,
        });

      if (product.itemQuantity < newItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }

      updatedItems.push({
        item: product._id,
        itemName: product.name,
        quantity: newItem.quantity,
        status: "Pending",
        rejectionReason: "",
      });
    }

    request.amendmentHistory.push({
      cycle: request.reviewCycle,
      customerComment: customerComment || "",
      previousItems,
      newItems: updatedItems.map((i) => ({
        item: i.item,
        itemName: i.itemName,
        quantity: i.quantity,
      })),
      previousRequestedDeliveryDate: request.requestedDeliveryDate,
      newRequestedDeliveryDate: requestedDeliveryDate
        ? new Date(requestedDeliveryDate)
        : request.requestedDeliveryDate,
    });

    request.items = updatedItems;
    if (requestedDeliveryDate)
      request.requestedDeliveryDate = new Date(requestedDeliveryDate);
    if (notes) request.notes = notes;

    request.reviewCycle += 1;
    request.status = "Pending Review";
    request.customerAction = "Requested Amendment";

    request.addTimeline?.(
      "Amended",
      "Customer submitted amendments.",
      "Customer",
    );

    await request.save();

    res.status(200).json({
      success: true,
      message: "Amendments submitted successfully.",
      data: request,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// CONVERT REQUEST TO ORDER
export const convertRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });

    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });
    if (request.status !== "Accepted") {
      return res.status(400).json({
        success: false,
        message: "Only accepted requests can be converted.",
      });
    }
    if (request.order) {
      return res
        .status(400)
        .json({ success: false, message: "Request already converted." });
    }

    const acceptedItems = request.items.filter(
      (item) => item.status === "Accepted",
    );
    if (acceptedItems.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No accepted items." });
    }

    const orderItems = [];
    let grandTotal = 0;

    for (const reqItem of acceptedItems) {
      const product = await Item.findById(reqItem.item);
      if (!product) continue;

      const unitPrice = product.price;
      const totalPrice = unitPrice * reqItem.quantity;
      grandTotal += totalPrice;

      orderItems.push({
        item: product._id,
        itemName: product.name,
        quantity: reqItem.quantity,
        unitPrice,
        totalPrice,
      });

      // Deduct stock
      product.itemQuantity -= reqItem.quantity;
      await product.save();
    }

    const order = await Order.create({
      orderNumber: await generateOrderNumber(),
      customerName: request.customerName,
      customerPhone: request.customerPhone,
      items: orderItems,
      grandTotal,
      status: "Pending",
      paymentStatus: "Unpaid",
      createdBy: req.userId,
      requestId: request._id,
    });

    request.status = "Converted";
    request.order = order._id;
    request.addTimeline?.(
      "Converted",
      `Converted to Order ${order.orderNumber}`,
      "Staff",
      req.userId,
    );

    await request.save();

    res.status(201).json({
      success: true,
      message: "Request converted successfully.",
      data: {
        request: { _id: request._id, requestNumber: request.requestNumber },
        order,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// REJECT REQUEST
export const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const request = await Request.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });
    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });

    if (
      !["Pending Review", "Awaiting Customer Confirmation"].includes(
        request.status,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject ${request.status} request.`,
      });
    }

    request.status = "Rejected";
    request.rejectionReason = reason || "No reason provided";
    request.reviewedBy = req.userId;
    request.reviewedAt = new Date();

    request.addTimeline?.(
      "Rejected",
      `Request rejected: ${reason || "No reason"}`,
      "Staff",
      req.userId,
    );

    await request.save();

    res.status(200).json({
      success: true,
      message: "Request rejected successfully",
      data: request,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// DELETE REQUEST (SOFT DELETE)
export const deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });

    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    if (request.status === "Converted") {
      return res
        .status(400)
        .json({ success: false, message: "Cannot delete converted request." });
    }

    request.isDeleted = true;
    request.deletedAt = new Date();
    request.deletedBy = req.userId;
    request.addTimeline?.(
      "Deleted",
      "Request was soft deleted",
      "Staff",
      req.userId,
    );

    await request.save();

    res
      .status(200)
      .json({ success: true, message: "Request deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// MARK REQUEST AS COLLECTED
export const markRequestCollected = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    const request = await Request.findOne({
      _id: id,
      isDeleted: { $ne: true },
    }).populate("order");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found.",
      });
    }

    // Must have an order
    if (!request.order) {
      return res.status(400).json({
        success: false,
        message: "This request has no associated order.",
      });
    }

    // Safety check
    if (request.order.status !== "Completed") {
      return res.status(400).json({
        success: false,
        message: "Order is not yet completed.",
      });
    }

    // Update request
    request.status = "Collected";
    request.collectedAt = new Date();
    request.collectedBy = req.userId;

    request.addTimeline?.(
      "Collected",
      "Customer collected the requested items.",
      "Staff",
      req.userId,
    );

    await request.save();

    return res.status(200).json({
      success: true,
      message: "Request marked as collected successfully.",
      data: request,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};
