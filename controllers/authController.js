import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import {createClient} from "@supabase/supabase-js";

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const COOLDOWN_SECONDS = parseInt(process.env.EMAIL_RESEND_COOLDOWN) || 300;  // default 300 seconds

export const signup = async (req, res) => {
    const {email, password} = req.body;

    try {
        const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, {
            headers: {
                apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
        });

        if (!userRes.ok) {
            throw new Error(`Failed to fetch users: ${userRes.statusText}`);
        }

        const userData = await userRes.json();

// Manually find user by exact email match (case insensitive)
        const existingUser = userData.users.find(
            (u) => u.email.toLowerCase() === email.toLowerCase()
        );

        if (existingUser) {
            if (existingUser.email_confirmed_at) {
                return res.status(400).json({message: 'Email already registered. Please login.'});
            }

            // User exists but not verified - check cooldown
            const {data: resendLog, error: logError} = await supabase
                .from('email_resend_log')
                .select('last_sent_at')
                .eq('email', email)
                .maybeSingle();

            if (logError) {
                console.error('Error fetching resend log:', logError);
                return res.status(500).json({error: 'Internal server error'});
            }

            if (resendLog) {
                const lastSent = new Date(resendLog.last_sent_at);
                const now = new Date();
                const diffSeconds = (now - lastSent) / 1000;

                if (diffSeconds < COOLDOWN_SECONDS) {
                    return res.status(429).json({
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
                return res.status(400).json({error: resendError.message});
            }

            // Update resend cooldown log
            await supabase
                .from('email_resend_log')
                .upsert({email, last_sent_at: new Date().toISOString()});

            return res.status(200).json({
                message: 'Email already registered but not verified. Verification email resent.',
            });
        }

        // User not found - create new user
        const {data, error} = await supabase.auth.signUp({email, password});

        if (error) {
            console.error('Signup error:', error);
            return res.status(400).json({error: error.message});
        }

        // Insert cooldown timestamp for new signup
        await supabase
            .from('email_resend_log')
            .upsert({email, last_sent_at: new Date().toISOString()});

        return res.status(201).json({
            message: 'Signup successful. Please check your email to verify your account.',
            data,
        });
    } catch (err) {
        console.error('Unexpected error:', err);
        return res.status(500).json({error: 'Internal server error'});
    }
};

export const login = async (req, res) => {
    const {email, password} = req.body;

    const {data, error} = await supabase.auth.signInWithPassword({email, password});

    if (error) {
        // Check if the error is email not confirmed
        if (error.message.includes('Email not confirmed')) {
            return res.status(403).json({message: "Please verify your email before logging in."});
        }
        return res.status(400).json({error: error.message});
    }

    const {user, session} = data;

    // Extra safety: check email_verified flag, though Supabase error usually catches it
    if (!user.user_metadata.email_verified) {
        return res.status(403).json({message: "Please verify your email before logging in."});
    }

    const token = jwt.sign(
        {id: user.id, email: user.email},
        process.env.JWT_SECRET,
        {expiresIn: "7d"}
    );

    res.json({token, user});
};

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