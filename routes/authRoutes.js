import express from "express";
import {
    signup,
    login,
    verifyEmail,
    getProfile,
    logout,
    refreshToken,
    updateProfile
} from "../controllers/authController.js";
import {authenticate} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refreshToken);
router.get("/verify-email", verifyEmail);
router.get("/profile", authenticate, getProfile);
router.post("/update", authenticate, updateProfile);

export default router;