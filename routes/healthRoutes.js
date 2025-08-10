import express from "express";
import {signup, login, verifyEmail} from "../controllers/authController.js";

const router = express.Router();

router.get('/', (req, res) => {
    res.status(200).send('OK');
});

export default router;