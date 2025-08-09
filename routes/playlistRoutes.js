import express from "express";
import { createPlaylist, getPlaylists } from "../controllers/playlistController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", authenticate, createPlaylist);
router.get("/", authenticate, getPlaylists);

export default router;
