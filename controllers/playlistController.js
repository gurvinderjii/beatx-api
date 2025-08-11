import supabase from "../config/supabaseClient.js";

export const getPlaylists = async (req, res) => {
    const userId = req.user.id;

    try {
        const {data, error} = await supabase
            .from("playlists")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", {ascending: false});

        if (error) return res.status(400).json({
            status: 0,
            message: error.message
        });

        if (!data || data.length === 0) {
            // Explicit no playlists case
            return res.status(200).json({
                status: 0,
                message: "No data found"
            });
        }
        return res.status(200).json({
            status: 1,
            message: "Playlists retrieved successfully",
            data: data
        })
    } catch (err) {
        console.error("Error fetching playlists:", err.message);
        res.status(400).json({
            status: 0,
            message: "Failed to fetch playlists"
        })
    }
};

export const getPlaylistTracks = async (req, res) => {
    const userId = req.user.id;
    const {playlistId} = req.params;

    try {
        // Verify playlist belongs to user
        const {data: playlist, error: playlistError} = await supabase
            .from("playlists")
            .select("id, user_id")
            .eq("id", playlistId)
            .single();

        if (playlistError) return res.status(400).json({
            status: 0,
            message: playlistError.message
        });

        if (!playlist || playlist.user_id !== userId) {
            return res.status(403).json({
                status: 0,
                message: "Playlist not found"
            })
        }

        // Fetch playlist tracks
        const {data, error} = await supabase
            .from("playlist_tracks")
            .select(`
                track_id,
                tracks (*)
            `)
            .eq("playlist_id", playlistId);

        if (error) return res.status(400).json({
            status: 0,
            message: error.message
        });

        // Transform: only return the tracks object
        const formattedData = (data || []).map(item => item.tracks);

        if (formattedData.length === 0) return res.status(200).json({
            status: 0,
            message: "No tracks found in this playlist"
        })
        return res.status(200).json({
            status: 1,
            message: "Playlists retrieved successfully",
            data: formattedData
        })

    } catch (err) {
        console.error("Error fetching playlist tracks:", err.message);
        res.status(400).json({
            status: 0,
            message: "Failed to fetch playlist tracks"
        })
    }
};

export const createPlaylist = async (req, res) => {
    const userId = req.user.id;
    const {name, description = ""} = req.body;

    if (!name) return res.status(400).json({
        status: 0,
        message: "Playlist name is required"
    })

    try {
        // Check if playlist with same name exists for this user
        const {data: existing, error: existingError} = await supabase
            .from("playlists")
            .select("id")
            .eq("user_id", userId)
            .eq("name", name)
            .maybeSingle();

        if (existingError) return res.status(400).json({
            status: 0,
            message: existingError.message
        });

        if (existing) {
            return res.status(400).json({
                status: 0,
                message: "Playlist with this name already exists"
            })
        }

        // Create playlist
        const {data, error} = await supabase
            .from("playlists")
            .insert([{user_id: userId, name, description}])
            .select("*")
            .single();

        if (error) return res.status(400).json({
            status: 0,
            message: error.message
        });

        return res.status(200).json({
            status: 1,
            message: "Playlist created successfully",
        })
    } catch (err) {
        console.error("Error creating playlist:", err.message);
        return res.status(400).json({
            status: 0,
            message: "Failed to create playlist"
        })
    }
};

export const toggleTrackInPlaylist = async (req, res) => {
    const userId = req.user.id;
    const {playlistId, trackId} = req.body;

    if (!playlistId || !trackId) return res.status(400).json({
        status: 0,
        message: "playlistId and trackId are required"
    })

    try {
        // Verify playlist belongs to user
        const {data: playlist, error: playlistError} = await supabase
            .from("playlists")
            .select("id, user_id")
            .eq("id", playlistId)
            .single();

        if (playlistError) return res.status(400).json({
            status: 0,
            message: playlistError.message
        });

        if (!playlist || playlist.user_id !== userId) return res.status(403).json({
            status: 0,
            message: "Unauthorized or playlist not found"
        })

        // Check if track already exists in playlist
        const {data: existing, error: existingError} = await supabase
            .from("playlist_tracks")
            .select("id")
            .eq("playlist_id", playlistId)
            .eq("track_id", trackId)
            .maybeSingle();

        if (existingError) return res.status(400).json({
            status: 0,
            message: existingError.message
        });

        if (existing) {
            // Remove track
            const {error: deleteError} = await supabase
                .from("playlist_tracks")
                .delete()
                .eq("id", existing.id);

            if (deleteError) return res.status(400).json({
                status: 0,
                message: deleteError.message
            });

            return res.status(200).json({
                status: 1,
                message: "Track removed from playlist successfully"
            })
        } else {
            // Add track
            const {error: insertError} = await supabase
                .from("playlist_tracks")
                .insert([{playlist_id: playlistId, track_id: trackId}]);

            if (insertError) return res.status(400).json({
                status: 0,
                message: insertError.message
            });

            return res.status(200).json({
                status: 1,
                message: "Track added from playlist successfully"
            })
        }
    } catch (err) {
        console.error("Error toggling track in playlist:", err.message);
        res.status(400).json({
            status: 0,
            message: "Failed to create playlist"
        })
    }
};
