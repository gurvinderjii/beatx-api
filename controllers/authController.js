import dotenv from "dotenv";
import {createClient} from "@supabase/supabase-js";
import axios from "axios";
import jwt from "jsonwebtoken";

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const COOLDOWN_SECONDS = parseInt(process.env.EMAIL_RESEND_COOLDOWN) || 300;  // default 300 seconds

export const signup = async (req, res) => {
    const {email, password, name} = req.body;

    // Check for email & password is not given
    if (!email || !password) {
        return res.status(400).json({status: 0, message: "Email and password are required"});
    }

    try {
        // Check if the user is already exist or not
        const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, {
            headers: {
                apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
        });

        if (!userRes.ok) return res.status(401).json({
            status: 0,
            message: `Failed to fetch users: ${userRes.statusText}`,
        })

        const userData = await userRes.json();

        // Find existing user by email (case insensitive)
        const existingUser = userData.users.find(
            (u) => u.email.toLowerCase() === email.toLowerCase()
        );

        if (existingUser) {
            if (existingUser.email_confirmed_at) {
                return res.status(400).json({
                    status: 0,
                    message: "Email already registered. Please login.",
                });
            }

            // User exists but not verified - check cooldown
            const {data: resendLog, error: logError} = await supabase
                .from('email_resend_log')
                .select('last_sent_at')
                .eq('email', email)
                .maybeSingle();

            // If error
            if (logError) {
                console.error('Error fetching resend log:', logError);
                return res.status(500).json({
                    status: 0,
                    message: "Internal server error.",
                });
            }

            // Cooldown for email send again
            if (resendLog) {
                const lastSent = new Date(resendLog.last_sent_at);
                const now = new Date();
                const diffSeconds = (now - lastSent) / 1000;

                if (diffSeconds < COOLDOWN_SECONDS) {
                    return res.status(429).json({
                        status: 0,
                        message: `Please wait ${Math.ceil(COOLDOWN_SECONDS - diffSeconds)} seconds before requesting another verification email.`,
                    });
                }
            }

            // Resend verification email
            const {error: resendError} = await supabase.auth.admin.generateLink({
                type: 'signup',
                email,
            });

            if (resendError) {
                console.error('Error resending verification email:', resendError);
                return res.status(400).json({
                    status: 0,
                    message: resendError.message,
                });
            }

            // Update resend cooldown log
            await supabase
                .from('email_resend_log')
                .upsert({email, last_sent_at: new Date().toISOString()});

            return res.status(200).json({
                status: 0,
                message: 'Email already registered but not verified. Verification email resent please check inbox.',
            });
        }

        const displayName = name && name.trim()
            ? name.trim()
            : email.split("@")[0]; // fallback from email

        // User not found - create new user
        const {data, error} = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: displayName
                }
            }
        });

        if (error) {
            console.error('Signup error:', error);
            return res.status(400).json({
                status: 0,
                message: error.message,
            })
        }

        // Insert cooldown timestamp for new signup
        await supabase
            .from('email_resend_log')
            .upsert({email, last_sent_at: new Date().toISOString()});

        return res.status(200).json({
            status: 1,
            message: 'Signup successful. Please check your email to verify your account.',
            data,

        })
    } catch (err) {
        console.error('Unexpected error:', err);
        return res.status(500).json({
            status: 0,
            message: err.message || "Internal server error",
        })
    }
};

export const login = async (req, res) => {
    const {email, password} = req.body;

    const {data, error} = await supabase.auth.signInWithPassword({email, password});

    if (error) {
        if (error.message.includes('Email not confirmed')) {
            // 403 with custom message
            return res.status(400).json({
                status: 0,
                message: "Please verify your email before logging in.",
            })
        }
        return res.status(400).json({
            status: 0,
            message: error.message,
        })
    }

    const {user, session} = data;

    if (!user.user_metadata.email_verified) {
        return res.status(403).json({
            status: 0,
            message: "Please verify your email before logging in."
        })
    }

    return res.status(200).json({
        status: 1,
        message: 'Logged in successfully.',
        data: {
            id: user.id,
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresIn: session.expires_in,
            name: user.user_metadata.name || "User",
            profilePic: user.user_metadata.avatar_url || "",
            email: user.email,
            phone: user.phone,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
        }
    })
};

export const refreshToken = async (req, res) => {
    const {refresh_token} = req.body;

    if (!refresh_token) {
        return res.status(403).json({
            status: 0,
            message: "Refresh token is required"
        })
    }

    try {
        const {data} = await axios.post(
            `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
            {refresh_token},
            {
                headers: {
                    apikey: process.env.SUPABASE_ANON_KEY,
                    "Content-Type": "application/json",
                },
            }
        );
        return res.status(200).json({
            status: 1,
            message: 'Token refreshed successfully.',
            data: {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_in: data.expires_in,
            }
        })
    } catch (err) {
        console.error("Error refreshing token:", err.response?.data || err.message);
        return res.status(401).json({
            status: 0,
            message: "Failed to refresh token"
        })
    }
}

export const verifyEmail = (req, res) => {
    // Supabase sends some URL params in query string on redirect, e.g. error, access_token, etc.
    // You can check for success or error and show messages accordingly

    const {error, error_description} = req.query;

    if (error) {
        // Verification failed or expired
        return res.render("verify-email", {success: false, message: error_description || "Email verification failed."});
    }

    // If no error param, assume success
    res.render("verify-email", {success: true, message: "Email verified successfully! You can now login."});
}

export const getProfile = async (req, res) => {
    try {
        const {data: {user}, error} = await supabase.auth.getUser(req.headers.authorization?.split(' ')[1]);

        if (error) return res.status(400).json({
            status: 0,
            message: error.message,
        });

        return res.status(200).json({
            status: 1,
            message: 'Profile successfully verified',
            data: {
                id: user.id,
                name: user.user_metadata.name || "User",
                profilePic: user.user_metadata.avatar_url || "",
                email: user.email,
                phone: user.phone,
                createdAt: user.created_at,
                updatedAt: user.updated_at,
            }
        })
    } catch (err) {
        console.error("Error fetching profile:", err.message);
        return res.status(400).json({
            status: 0,
            message: "Failed to fetch profile:",
        })
    }
};

export const updateProfile = async (req, res) => {
    const userId = req.user.sub; // extracted from your JWT middleware
    const {name, avatar_url} = req.body;

    if (!name && !avatar_url) {
        return res.status(400).json({status: 0, message: "No fields to update"});
    }

    try {
        const {user, error} = await supabase.auth.admin.updateUserById(
            userId,
            {
                user_metadata: {
                    ...(name && {name}),
                    ...(avatar_url && {avatar_url})
                }
            }
        );

        if (error) return res.status(400).json({
            status: 0,
            message: error.message,
        });

        return res.status(200).json({
            status: 1,
            message: "Profile updated successfully",
            data: {
                id: user.id,
                name: user.user_metadata.name || "User",
                profilePic: user.user_metadata.avatar_url || "",
                email: user.email,
                phone: user.phone,
                createdAt: user.created_at,
                updatedAt: user.updated_at,
            }
        });
    } catch (err) {
        console.error("Error updating profile:", err.message);
        return res.status(400).json({status: 0, message: "Failed to update profile"});
    }
};

export const logout = async (req, res) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        return res.status(400).json({status: 0, message: "Authorization token is required"});
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(400).json({status: 0, message: "Invalid token format"});
    }

    try {
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.exp) {
            return res.status(400).json({status: 0, message: "Invalid token"});
        }

        const expiresAt = new Date(decoded.exp * 1000);

        // Save in blacklist
        const {error} = await supabase
            .from("token_blacklist")
            .insert([{token, expires_at: expiresAt}]);

        if (error) return res.status(400).json({
            status: 0,
            message: error.message,
        });

        return res.status(200).json({status: 1, message: "Logged out successfully"});
    } catch (err) {
        return res.status(500).json({status: 0, message: "Logout failed"});
    }
};