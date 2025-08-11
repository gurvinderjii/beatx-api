import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import supabase from "../config/supabaseClient.js";

dotenv.config();

export const authenticate = async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        return res.status(401).json({status: 0, message: "No token provided"});
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({status: 0, message: "Invalid token format"});
    }

    // 1. Check blacklist
    const {data: blacklisted} = await supabase
        .from("token_blacklist")
        .select("token")
        .eq("token", token)
        .single();

    if (blacklisted) {
        return res.status(401).json({status: 0, message: "Token has been revoked"});
    }

    try {
        req.user = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({status: 0, message: "Invalid or expired token"});
    }
};