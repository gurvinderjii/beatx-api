import supabase from "../config/supabaseClient.js";

export const getTracks = async (req, res) => {
    const { data, error } = await supabase.from("tracks").select("*");
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
};

export const likeTrack = async (req, res) => {
    const { track_id } = req.body;
    const user_id = req.user.id;

    const { error } = await supabase
        .from("likes")
        .insert([{ user_id, track_id }]);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Track liked" });
};
