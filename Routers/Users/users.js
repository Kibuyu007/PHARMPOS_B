import express from "express";
import multer from "multer";
import { verifyUser } from "../../Middleware/verifyToken.js";
import { deleteUser, getAllUsers, getUser, updateUser, userStatus } from "../../Controlers/Users/users.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "pfps/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

const upload = multer({ storage });

router.put('/update/:id', upload.single("photo"), verifyUser, updateUser);
router.delete('/delete/:id', verifyUser, deleteUser);
router.get('/allUsers', getAllUsers);
router.get('/user/:id', getUser);
router.put('/status/:id', userStatus);

export default router;