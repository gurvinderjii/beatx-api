import express from "express";
import {signup, login, verifyEmail} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/verify-email", verifyEmail);

export default router;