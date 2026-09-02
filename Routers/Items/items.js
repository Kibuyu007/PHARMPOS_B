import express from "express";
import { 
  addNewItem, 
  editItem, 
  getAllItems, 
  getAllItemsRaw, 
  getCountsByCategory, 
  getItemsPublic, 
  searchItem, 
  searchItemsInPos,
} from "../../Controlers/Items/items.js";
import { verifyUser } from "../../Middleware/verifyToken.js";

const router = express.Router();

// Protected routes (require authentication)
router.post("/addItem", verifyUser, addNewItem);
router.put("/editItem/:id", verifyUser, editItem);

// Public routes (no authentication required)
router.get("/getAllItems", getAllItems);
router.get("/search", searchItem);
router.get("/searchInPos", searchItemsInPos);
router.get("/allItemsRaw", getAllItemsRaw);
router.get("/itemsWithCategories", getCountsByCategory);

// GET ALL ITEMS FOR PUBLIC
router.get("/public/items", getItemsPublic);

export default router;