import supabase from "../config/supabaseClient.js";

export const createPlaylist = async (req, res) => {
    const { name } = req.body;
    const user_id = req.user.id;

    const { data, error } = await supabase
        .from("playlists")
        .insert([{ name, user_id }])
        .select();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data[0]);
};

export const getPlaylists = async (req, res) => {
    const user_id = req.user.id;

    const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .eq("user_id", user_id);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
};
