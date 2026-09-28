import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import storageRoutes from "./routes/storage.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://phoenixcrackers-billingsoftware.netlify.app",
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without Origin
    // (Postman, server-to-server, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("CORS blocked:", origin);
    return callback(new Error(`CORS blocked: ${origin}`));
  },

  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],

  credentials: true,

  optionsSuccessStatus: 204,
};

// CORS MUST come before routes
app.use(cors(corsOptions));

// Explicitly handle preflight requests
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "5mb" }));

// Health check
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Spark Billing API is running. Try /api/health.",
  });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/storage", storageRoutes);

// Unknown API route
app.use("/api", (req, res) => {
  res.status(404).json({
    error: `No API route for ${req.method} ${req.originalUrl}`,
  });
});

const PORT = process.env.PORT || 4000;

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/spark-billing";

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });
