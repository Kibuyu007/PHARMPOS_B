import express from "express";
import Item from "../../Models/Items/items.js";
import {
  createOrder,
  deleteOrder,
  getOrders,
  getOrderWithFulfillment,
  getPendingOrders,
  getSingleOrder,
  searchOrders,
  updateOrderStatus,
  updateOrderFulfillment,
} from "../../Controlers/Orders/orders.js";
import { verifyUser } from "../../Middleware/verifyToken.js";
import {
  convertRequest,
  createRequest,
  customerAcceptRequest,
  customerAmendRequest,
  deleteRequest,
  getPendingRequests,
  getRequestByNumber,
  getRequests,
  getSingleRequest,
  markRequestCollected,
  rejectRequest,
  reviewRequest,
  searchRequests,
} from "../../Controlers/Orders/orderRequest.js";

export const router = express.Router();

//ORDERS
router.post("/addOrder", verifyUser, createOrder);
router.put("/updateOrder/:id", verifyUser, updateOrderStatus);
router.get("/allOrders", getOrders);
router.get("/orders/pending", getPendingOrders);
router.get("/orders/search", searchOrders);
router.get("/order/:id", getSingleOrder);
router.delete("/deleteOrder/:id", verifyUser, deleteOrder);
router.get("/getOrdersFull/:id", getOrderWithFulfillment);
router.put("/updateOrderFul/:id", verifyUser, updateOrderFulfillment);

//REQUESTS ORDERS

// PUBLIC ROUTES
router.post("/addRequests", createRequest);
router.get("/public/requests/:requestNumber", getRequestByNumber);
router.put("/:id/amend", customerAmendRequest);
router.patch("/:id/accept", customerAcceptRequest);

// PROTECTED ROUTES
router.get("/requests", getRequests);
router.get("/requests/pending", verifyUser, getPendingRequests);
router.get("/requests/:id", verifyUser, getSingleRequest);
router.put("/reviewRequests/:id", verifyUser, reviewRequest);
router.post("/requests/:id/convert", verifyUser, convertRequest);
router.post("/requests/:id/reject", verifyUser, rejectRequest);
router.get("/requests/search", verifyUser, searchRequests);
router.delete("/requests/:id", verifyUser, deleteRequest);
router.put("/requests/:id/collect", verifyUser, markRequestCollected);

export default router;
