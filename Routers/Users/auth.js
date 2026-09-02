import express from "express";
import { login, logout, register } from "../../Controlers/Users/auth.js";
import multer from "multer";


const router = express.Router()

// Multer Storage Configuration (File Upload)
const storage = multer.diskStorage({
    destination: "./images",
    filename: (req, file, callback) => {
        callback(null, `${Date.now()}_${file.originalname}`);
    },
});

const upload = multer({ storage });

router.post("/register", upload.single("file"), register);
router.post('/login',login)
router.get('/logout',logout)

export default router