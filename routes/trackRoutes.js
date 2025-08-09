import express from "express";
import { getTracks, likeTrack } from "../controllers/trackController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/",authenticate, getTracks);
router.post("/like", authenticate, likeTrack);

export default router;
