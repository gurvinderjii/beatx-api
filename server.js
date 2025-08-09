import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import {fileURLToPath} from "url";
import authRoutes from "./routes/authRoutes.js";
import trackRoutes from "./routes/trackRoutes.js";
import playlistRoutes from "./routes/playlistRoutes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
    res.render("index", {title: "Welcome to BeatX"}); // looks for views/index.ejs
});
app.use("/auth", authRoutes);
app.use("/tracks", trackRoutes);
app.use("/playlists", playlistRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BeatX API running on port ${PORT}`));