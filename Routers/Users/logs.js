import express from "express";
import { getUserLogs } from "../../Controlers/Users/logs.js";

const router = express.Router()

router.get("/userLogs", getUserLogs);

export default router