import express from "express";
import { addNewItemCategories, editItemCategories, getAllItemCategories } from "../../Controlers/Items/itemsCategories.js";
import { verifyUser } from "../../Middleware/verifyToken.js";


const router = express.Router();

router.post("/addItemCategories",verifyUser, addNewItemCategories);
router.get("/getItemCategories", getAllItemCategories);
router.put("/editItemCategories/:id", verifyUser, editItemCategories);

export default router;
