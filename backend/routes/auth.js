import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = Router();

function signToken(user, isAdmin = false) {
  return jwt.sign(
    {
      userId: user?._id?.toString() || "admin",
      isAdmin,
    },
    process.env.JWT_SECRET || "dev-secret-change-me",
    {
      expiresIn: "30d",
    }
  );
}

// POST /api/auth/register
// { username, password, businessName }

router.post("/register", async (req, res) => {
  try {
    const { username, password, businessName } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        error: "Username and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    const existing = await User.findOne({
      username: cleanUsername,
    });

    if (existing) {
      return res.status(409).json({
        error: "That username is already taken",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: cleanUsername,
      passwordHash,
      businessName: businessName || "",
    });

    const token = signToken(user);

    res.json({
      token,
      username: user.username,
      isAdmin: false,
    });
  } catch (err) {
    console.error("Registration error:", err);

    res.status(500).json({
      error: "Registration failed",
    });
  }
});

// POST /api/auth/login
// { username, password }

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        error: "Username and password are required",
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    // =========================
    // ADMIN LOGIN
    // =========================

    const adminUsername = process.env.ADMIN_USERNAME?.trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (
      adminUsername &&
      adminPassword &&
      cleanUsername === adminUsername &&
      password === adminPassword
    ) {
      const token = signToken(null, true);

      return res.json({
        token,
        username: cleanUsername,
        isAdmin: true,
      });
    }

    // =========================
    // NORMAL USER LOGIN
    // =========================

    const user = await User.findOne({
      username: cleanUsername,
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid username or password",
      });
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordValid) {
      return res.status(401).json({
        error: "Invalid username or password",
      });
    }

    const token = signToken(user);

    res.json({
      token,
      username: user.username,
      isAdmin: false,
    });
  } catch (err) {
    console.error("Login error:", err);

    res.status(500).json({
      error: "Login failed",
    });
  }
});

export default router;