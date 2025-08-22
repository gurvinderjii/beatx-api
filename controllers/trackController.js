import supabase from "../config/supabaseClient.js";

const SIGNED_URL_EXPIRY = parseInt(process.env.SIGNED_URL_EXPIRY) || 120;

export const getTracks = async (req, res) => {
    try {
        const {data, error} = await supabase
            .from('tracks')
            .select('id, title, artist, album, album_art_url, duration')
            .order('title', {ascending: true});

        if (error)
            return res.status(400).json({
                status: 0,
                message: error.message,
            });

        if (data == null || data.length === 0) {
            return res.status(200).json({
                status: 0,
                message: "No tracks found",
                data: []
            })
        }

        return res.status(200).json({
            status: 1,
            message: "Tracks fetched successfully",
            data: data
        })
    } catch (error) {
        console.error('Error fetching tracks:', error.message);
        return res.status(400).json({
            status: 0,
            message: "Failed to fetch Tracks",
        });
    }
};

export const toggleLikeTrack = async (req, res) => {
    const userId = req.user.sub;
    const {trackId} = req.body;

    if (!trackId) {
        return res.status(400).json({
            status: 0,
            message: "Track id not found"
        })
    }

    try {
        // Check if already liked
        const {data: existing, error: checkError} = await supabase
            .from('likes')
            .select('*')
            .eq('user_id', userId)
            .eq('track_id', trackId)
            .single();

        // PGRST116 means no rows found — ignore this error here
        if (checkError && checkError.code !== 'PGRST116') {
            return res.status(400).json({
                status: 0,
                message: checkError.message,
            })
        }

        if (existing) {
            // If liked, then unlike (delete)
            const {error: deleteError} = await supabase
                .from('likes')
                .delete()
                .eq('user_id', userId)
                .eq('track_id', trackId);

            if (deleteError) return res.status(400).json({
                status: 0,
                message: deleteError.message,
            });

            return res.status(200).json({
                status: 1,
                message: 'Track unliked successfully',
            })
        } else {
            // If not liked, then like (insert)
            const {error: insertError} = await supabase
                .from('likes')
                .insert([{user_id: userId, track_id: trackId}]);

            if (insertError) return res.status(400).json({
                status: 0,
                message: insertError.message,
            });

            return res.status(200).json({
                status: 1,
                message: 'Track liked successfully',
            })
        }
    } catch (error) {
        console.error('Error toggling like:', error.message);
        return res.status(400).json({
            status: 0,
            message: 'Failed to toggle like',
        });
    }
};

export const getLikedTracks = async (req, res) => {
    const userId = req.user.sub;
    console.log("User in request:", req.user);

    try {
        const {data, error} = await supabase
            .from('likes')
            .select(`
        track_id:tracks (
          id, title, artist, album, album_art_url, duration
        )
      `)
            .eq('user_id', userId);

        if (error) return res.status(400).json({
            status: 0,
            message: error.message,
        })

        // Extract track objects or return empty array if no likes
        const likedTracks = data?.map(item => item.track_id) || [];

        if (likedTracks.length === 0) {
            return res.status(200).json({
                status: 0,
                message: 'No data found',
            })
        }

        return res.status(200).json({
            status: 1,
            message: 'Tracks fetched successfully',
            data: likedTracks,
        })
    } catch (error) {
        console.error('Error fetching liked tracks:', error.message);
        return res.status(400).json({
            status: 0,
            message: 'Failed to fetch liked tracks',
        })
    }
};

export const getTrackStream = async (req, res) => {
    const {id: trackId} = req.params;

    if (!trackId) {
        return res.status(400).json({status: 0, message: 'track id is required'});
    }

    try {
        // 1) fetch track metadata
        const {data: track, error: trackError} = await supabase
            .from('tracks')
            .select('id, file_key')
            .eq('id', trackId)
            .maybeSingle();

        if (trackError) {
            console.error('Supabase error fetching track:', trackError);
            return res.status(500).json({status: 0, message: 'Failed to fetch track'});
        }

        if (!track) {
            return res.status(404).json({status: 0, message: 'Track not found'});
        }

        const fileKey = track.file_key;
        if (!fileKey) {
            return res.status(400).json({status: 0, message: 'Track file path not available'});
        }

        // 2) extract bucket and path
        const info = extractBucketAndPath(fileKey);
        if (!info) {
            // If extraction fails, return the fileKey directly if it already is a public URL
            // If it's a public URL you might want to just return it (but not recommended for private files)
            // Here we prefer to error out so you can fix storage paths consistently.
            console.warn('Could not extract bucket/path from file_key:', fileKey);
            return res.status(400).json({status: 0, message: 'Invalid file_key format'});
        }
        const {bucket, path} = info;

        // 3) create signed URL with service role client
        const expiry = Number(SIGNED_URL_EXPIRY);
        const {data, error} = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, expiry);

        if (error || !data || !data.signedUrl) {
            console.error('Error creating signed URL:', error || data);
            return res.status(500).json({status: 0, message: 'Failed to create signed url'});
        }

        const expiresAt = new Date(Date.now() + expiry * 1000).toISOString();

        return res.status(200).json({
            status: 1,
            message: 'Signed url created successfully',
            data: {
                url: data.signedUrl,
                expires_at: expiresAt,
                expires_in: expiry
            }
        });
    } catch (err) {
        console.error('Unexpected error in getTrackStream:', err);
        return res.status(500).json({status: 0, message: 'Server error'});
    }
};

function extractBucketAndPath(fileKey) {
    // If fileKey is already in format "bucket/path/to/file.ext"
    if (!fileKey) return null;

    // If it looks like a full URL from Supabase storage, parse it:
    // e.g. https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path...>
    try {
        const url = new URL(fileKey);
        const parts = url.pathname.split('/').filter(Boolean); // remove empty
        const objIndex = parts.indexOf('object');
        if (objIndex !== -1) {
            // Next segment is probably 'public' or 'private', then bucket, then path...
            // Typical: /storage/v1/object/public/bucket/path/to/file
            const afterObject = parts.slice(objIndex + 1); // ['public', 'bucket', 'path', ...]
            if (afterObject.length >= 2) {
                const bucket = afterObject[1];
                const path = afterObject.slice(2).join('/');
                return {bucket, path};
            }
        }
    } catch (e) {
        // not a valid URL, treat it as path-like below
    }

    // otherwise if fileKey contains bucket at start (bucket/...), split first segment
    const segments = fileKey.split('/').filter(Boolean);
    if (segments.length >= 2) {
        const bucket = segments[0];
        const path = segments.slice(1).join('/');
        return {bucket, path};
    }

    return null;
}