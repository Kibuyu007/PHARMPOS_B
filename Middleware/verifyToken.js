import jwt from "jsonwebtoken";

export const verifyUser = (req, res, next) => {
    const token = req.cookies.accessToken;

    if (!token) {
        return res.status(401).json({ message: "You are not authorized to Perform this Action, Or Your Session Might have been expired." });
    }

    if (!process.env.MYCODE) {
        return res.status(500).json({ message: "JWT secret is not set in environment." });
    }

    jwt.verify(token, process.env.MYCODE, (err, payload) => {
        if (err) {
            return res.status(401).json({ error: "Invalid token or expired token." }); 
        }

        console.log("Token payload:", payload);
        req.userId = payload.id;
        next();
    });
};

export const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
        status: statusCode, 
        message: err.message,
        errorStack: process.env.NODE_ENV === "development" ? err.stack : ""
    });
};
