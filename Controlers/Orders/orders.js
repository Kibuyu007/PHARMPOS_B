import Orders from "../../Models/Orders/orders.js";
import Items from "../../Models/Items/items.js";

//CREATE ORDER
export const createOrder = async (req, res) => {
  try {
    const { customerName, customerPhone, items, notes } = req.body;

    if (!customerName?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Customer name is required" });
    }

    if (!items || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No items selected" });
    }

    let totalAmount = 0;
    let totalDiscount = 0;
    const orderItems = [];

    for (const orderItem of items) {
      const product = await Items.findById(orderItem.itemId);
      if (!product) {
        return res
          .status(404)
          .json({ success: false, message: "Item not found" });
      }

      if (product.itemQuantity < orderItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.itemQuantity} ${product.name} remaining`,
        });
      }

      let unitPrice = product.price;
      let isWholesale = false;

      if (
        product.enableWholesale &&
        orderItem.quantity >= product.wholesaleMinQty &&
        product.wholesalePrice > 0
      ) {
        unitPrice = product.wholesalePrice;
        isWholesale = true;
      }

      const discount = Math.max(0, Number(orderItem.discount || 0));
      const totalPrice = Math.max(0, unitPrice * orderItem.quantity - discount);

      totalAmount += unitPrice * orderItem.quantity;
      totalDiscount += discount;

      orderItems.push({
        item: product._id,
        itemName: product.name,
        quantity: orderItem.quantity,
        unitPrice,
        discount,
        totalPrice,
        isWholesale,
        fulfillmentStatus: "Pending",
        completedAt: null,
        sale: null,
      });

      await product.save();
    }

    const grandTotal = Math.max(0, totalAmount - totalDiscount);

    const order = await Orders.create({
      orderNumber: `ORD-${Date.now()}`,
      customerName,
      customerPhone,
      items: orderItems,
      totalAmount,
      totalDiscount,
      grandTotal,
      balance: grandTotal,
      paymentStatus: "Unpaid",
      notes: notes || "",
      createdBy: req.userId,
      lastModifiedBy: req.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create order" });
  }
};

//UPDATE ORDER STATUS
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ["Pending", "Confirmed", "Cancelled"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be Pending, Confirmed or Cancelled",
      });
    }

    const order = await Orders.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.status === "Completed") {
      return res.status(400).json({
        success: false,
        message: "Completed orders cannot be modified",
      });
    }

    order.status = status;
    order.lastModifiedBy = req.userId;
    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order marked as ${status}`,
      data: order,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update order status" });
  }
};

//GETTING ALL ORDERS
export const getOrders = async (req, res) => {
  try {
    const orders = await Orders.find()
      .sort({ createdAt: -1 })
      .populate("createdBy", "firstName lastName")
      .populate("sale", "totalAmount paidAmount balance")
      .populate({
        path: "items.item",
        model: "items",
        select:
          "name itemQuantity price retailPrice wholesalePrice enableWholesale expireDate status buyingPrice",
      });

    const transformedOrders = orders.map((order) => {
      const orderObj = order.toObject();

      orderObj.items = orderObj.items.map((item) => {
        const itemData = item.item || {};
        const currentStock =
          itemData.itemQuantity !== undefined ? itemData.itemQuantity : 0;

        return {
          ...item,
          item: itemData._id || item.item,
          itemName: itemData.name || item.itemName || "Unknown",
          currentStock: currentStock,
          retailPrice: itemData.price || 0,
          wholesalePrice: itemData.wholesalePrice || 0,
          enableWholesale: itemData.enableWholesale || false,
          expireDate: itemData.expireDate || null,
          status: itemData.status || "Active",
          buyingPrice: itemData.buyingPrice || 0,
          itemExists: !!itemData._id,
          // CRITICAL: Keep fulfillment status
          fulfillmentStatus: item.fulfillmentStatus || "Pending",
          completedAt: item.completedAt || null,
          sale: item.sale || null,
        };
      });

      return orderObj;
    });

    return res.status(200).json({
      success: true,
      data: transformedOrders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

//GETTING ONLT ONE ORDER
export const getSingleOrder = async (req, res) => {
  try {
    const order = await Orders.findById(req.params.id)
      .populate("items.item")
      .populate("createdBy", "firstName lastName")
      .populate("sale")
      .populate("items.sale", "createdAt totalAmount");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch order" });
  }
};

//DELETE ORDER
export const deleteOrder = async (req, res) => {
  try {
    const order = await Orders.findById(req.params.id);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.status === "Completed") {
      return res.status(400).json({
        success: false,
        message: "Completed orders cannot be deleted",
      });
    }

    await Orders.findByIdAndDelete(req.params.id);

    return res
      .status(200)
      .json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete order" });
  }
};

//GETTTING PENDING ORDERS
export const getPendingOrders = async (req, res) => {
  try {
    const orders = await Orders.find({ status: "Pending" })
      .sort({ createdAt: -1 })
      .populate("createdBy", "firstName lastName");

    return res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch pending orders" });
  }
};

//SEARCHING ORDERS
export const searchOrders = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search keyword required",
      });
    }

    const orders = await Orders.find({
      $or: [
        { customerName: { $regex: q, $options: "i" } },
        { customerPhone: { $regex: q, $options: "i" } },
        { orderNumber: { $regex: q, $options: "i" } },
      ],
    }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Search failed" });
  }
};

// GET ORDER WITH FULFILLMENT STATUS
export const getOrderWithFulfillment = async (req, res) => {
  try {
    const order = await Orders.findById(req.params.id)
      .populate("items.item")
      .populate("createdBy", "firstName lastName")
      .populate("sale", "totalAmount paidAmount balance");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Transform order items with stock info
    const orderObj = order.toObject();
    orderObj.items = orderObj.items.map((item) => {
      const itemData = item.item || {};

      // Get the item ID properly
      const itemId = itemData._id
        ? itemData._id.toString()
        : item.item
          ? item.item.toString()
          : null;

      return {
        ...item,
        // Store the item ID as string for frontend consistency
        itemId: itemId,
        currentStock: itemData.itemQuantity || 0,
        retailPrice: itemData.price || 0,
        wholesalePrice: itemData.wholesalePrice || 0,
        enableWholesale: itemData.enableWholesale || false,
        itemExists: !!itemData._id,
        canFulfill:
          item.fulfillmentStatus === "Pending" &&
          itemData.itemQuantity >= item.quantity,
        // Keep original item reference
        item: itemData,
      };
    });

    return res.status(200).json({
      success: true,
      data: orderObj,
    });
  } catch (error) {
    console.error("Error fetching order with fulfillment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

// UPDATE ORDER FULFILLMENT STATUS (for individual items)
// controllers/ordersController.js

// UPDATE ORDER FULFILLMENT STATUS (for individual items)
export const updateOrderFulfillment = async (req, res) => {
  try {
    // Fix: Use req.params.id instead of req.params.orderId
    const orderId = req.params.id;
    const { itemsToFulfill, saleId } = req.body;

    console.log("Update Order Fulfillment Request:", {
      orderId,
      itemsToFulfill,
      saleId,
    });

    if (!itemsToFulfill || itemsToFulfill.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No items selected for fulfillment",
      });
    }

    const order = await Orders.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    console.log(`Order ${order.orderNumber} found. Items:`, order.items.length);

    // Track which items were updated
    const updatedItems = [];
    const alreadyFulfilled = [];

    // Update each item's fulfillment status
    for (const fulfillment of itemsToFulfill) {
      // Fix: Find by orderItemId (the _id of the order item subdocument)
      const orderItem = order.items.find(
        (item) => item._id.toString() === fulfillment.orderItemId,
      );

      if (!orderItem) {
        console.log(`Order item ${fulfillment.orderItemId} not found in order`);
        continue;
      }

      if (orderItem.fulfillmentStatus === "Completed") {
        alreadyFulfilled.push(orderItem.itemName);
        continue;
      }

      // Mark as completed
      orderItem.fulfillmentStatus = "Completed";
      orderItem.completedAt = new Date();
      if (saleId) {
        orderItem.sale = saleId;
      }

      updatedItems.push(orderItem.itemName);
    }

    // Calculate order status
    const totalItems = order.items.length;
    const completedItems = order.items.filter(
      (item) => item.fulfillmentStatus === "Completed",
    ).length;

    let statusChanged = false;
    let newStatus = order.status;

    if (completedItems === totalItems) {
      newStatus = "Completed";
      statusChanged = true;
    } else if (completedItems > 0) {
      newStatus = "Partially Completed";
      statusChanged = true;
    }

    if (statusChanged) {
      order.status = newStatus;
    }

    // Update payment status if saleId is provided
    if (saleId) {
      const sale = await Sales.findById(saleId);
      if (sale) {
        if (sale.status === "Paid") {
          order.paidAmount = (order.paidAmount || 0) + sale.totalAmount;
          order.balance = Math.max(0, order.grandTotal - order.paidAmount);

          if (order.balance <= 0) {
            order.paymentStatus = "Paid";
            order.balance = 0;
          } else {
            order.paymentStatus = "Partially Paid";
          }
        }
      }
    }

    order.lastModifiedBy = req.userId;
    await order.save();

    console.log(`Order ${order.orderNumber} updated:`, {
      status: order.status,
      completedItems: completedItems,
      totalItems: totalItems,
      paymentStatus: order.paymentStatus,
      balance: order.balance,
      updatedItems,
      alreadyFulfilled,
    });

    return res.status(200).json({
      success: true,
      message: "Order fulfillment updated",
      data: {
        order: order,
        updatedItems: updatedItems,
        alreadyFulfilled: alreadyFulfilled,
        completedItems: completedItems,
        totalItems: totalItems,
        isCompleted: order.status === "Completed",
      },
    });
  } catch (error) {
    console.error("Error updating order fulfillment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update order fulfillment",
      error: error.message,
    });
  }
};
