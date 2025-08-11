import express from "express";
import {getLikedTracks, getTracks, getTrackStream, toggleLikeTrack} from "../controllers/trackController.js";
import {authenticate} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, getTracks);
router.get("/liked", authenticate, getLikedTracks);
router.get('/:id/stream',authenticate, getTrackStream)
router.post("/like-toggle", authenticate, toggleLikeTrack);

export default router;
