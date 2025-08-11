import express from "express";
import {
    createPlaylist,
    getPlaylists,
    getPlaylistTracks,
    toggleTrackInPlaylist
} from "../controllers/playlistController.js";
import {authenticate} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/create", authenticate, createPlaylist);
router.get("/get-all", authenticate, getPlaylists);
router.get("/tracks/:playlistId", authenticate, getPlaylistTracks);
router.post("/toggle-track", authenticate, toggleTrackInPlaylist);

export default router;