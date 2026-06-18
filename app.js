const fileInput = document.querySelector("#file-input");
const dropZone = document.querySelector("#drop-zone");
const canvas = document.querySelector("#preview-canvas");
const ctx = canvas.getContext("2d");
const widthInput = document.querySelector("#width-input");
const heightInput = document.querySelector("#height-input");
const lockRatio = document.querySelector("#lock-ratio");
const formatSelect = document.querySelector("#format-select");
const qualityInput = document.querySelector("#quality-input");
const qualityOutput = document.querySelector("#quality-output");
const backgroundInput = document.querySelector("#background-input");
const downloadButton = document.querySelector("#download-button");
const resetButton = document.querySelector("#reset-button");
const cropModeButton = document.querySelector("#crop-mode-button");
const cropPanel = document.querySelector("#crop-panel");
const cropStatus = document.querySelector("#crop-status");
const applyCropButton = document.querySelector("#apply-crop-button");
const cancelCropButton = document.querySelector("#cancel-crop-button");
const originalSize = document.querySelector("#original-size");
const exportSize = document.querySelector("#export-size");
const statusLabel = document.querySelector("#status-label");
const fitButtons = document.querySelectorAll("[data-fit]");
const presetButtons = document.querySelectorAll("[data-preset]");

let sourceImage = null;
let sourceName = "pixel-studio";
let ratio = 1200 / 800;
let fitMode = "contain";
let cropActive = false;
let cropDragging = false;
let cropStart = null;
let cropRect = null;

function setStatus(text) {
  statusLabel.textContent = text;
}

function syncExportLabel() {
  exportSize.textContent = `${canvas.width} x ${canvas.height}`;
}

function drawPlaceholder() {
  canvas.width = Number(widthInput.value);
  canvas.height = Number(heightInput.value);
  ctx.fillStyle = backgroundInput.value;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  syncExportLabel();
}

function drawCropOverlay() {
  if (!cropActive || !cropRect) return;

  const x = Math.min(cropRect.x, cropRect.x + cropRect.width);
  const y = Math.min(cropRect.y, cropRect.y + cropRect.height);
  const width = Math.abs(cropRect.width);
  const height = Math.abs(cropRect.height);

  ctx.save();
  ctx.fillStyle = "rgba(2, 4, 16, 0.56)";
  ctx.fillRect(0, 0, canvas.width, y);
  ctx.fillRect(0, y + height, canvas.width, canvas.height - y - height);
  ctx.fillRect(0, y, x, height);
  ctx.fillRect(x + width, y, canvas.width - x - width, height);
  ctx.strokeStyle = "#f8ff13";
  ctx.lineWidth = Math.max(2, Math.round(canvas.width / 600));
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "rgba(248, 255, 19, 0.95)";
  ctx.fillRect(x - 4, y - 4, 8, 8);
  ctx.fillRect(x + width - 4, y - 4, 8, 8);
  ctx.fillRect(x - 4, y + height - 4, 8, 8);
  ctx.fillRect(x + width - 4, y + height - 4, 8, 8);
  ctx.restore();
}

function drawImage(showOverlay = true) {
  const targetWidth = Math.max(1, Number(widthInput.value) || 1200);
  const targetHeight = Math.max(1, Number(heightInput.value) || 800);
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = backgroundInput.value;
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  if (!sourceImage) {
    drawPlaceholder();
    return;
  }

  const sourceRatio = sourceImage.width / sourceImage.height;
  const targetRatio = targetWidth / targetHeight;
  let drawWidth = targetWidth;
  let drawHeight = targetHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (fitMode === "contain") {
    if (sourceRatio > targetRatio) {
      drawHeight = targetWidth / sourceRatio;
      offsetY = (targetHeight - drawHeight) / 2;
    } else {
      drawWidth = targetHeight * sourceRatio;
      offsetX = (targetWidth - drawWidth) / 2;
    }
  }

  if (fitMode === "cover") {
    if (sourceRatio > targetRatio) {
      drawWidth = targetHeight * sourceRatio;
      offsetX = (targetWidth - drawWidth) / 2;
    } else {
      drawHeight = targetWidth / sourceRatio;
      offsetY = (targetHeight - drawHeight) / 2;
    }
  }

  ctx.drawImage(sourceImage, offsetX, offsetY, drawWidth, drawHeight);
  syncExportLabel();
  if (showOverlay) drawCropOverlay();
}

function updateQuality() {
  qualityOutput.textContent = `${qualityInput.value}%`;
}

function setCropMode(active) {
  cropActive = active && Boolean(sourceImage);
  cropDragging = false;
  cropStart = null;
  cropRect = null;
  cropPanel.hidden = !cropActive;
  canvas.classList.toggle("is-cropping", cropActive);
  cropModeButton.classList.toggle("is-active", cropActive);
  applyCropButton.disabled = true;
  cropStatus.textContent = "Rahmen im Bild aufziehen";
  if (cropActive) {
    setStatus("Manueller Zuschnitt aktiv");
  } else if (sourceImage) {
    setStatus("Zuschnitt beendet");
  }
  drawImage();
}

function getCanvasPoint(event) {
  const box = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width, ((event.clientX - box.left) / box.width) * canvas.width)),
    y: Math.max(0, Math.min(canvas.height, ((event.clientY - box.top) / box.height) * canvas.height)),
  };
}

function normalizedCropRect() {
  if (!cropRect) return null;
  const x = Math.round(Math.min(cropRect.x, cropRect.x + cropRect.width));
  const y = Math.round(Math.min(cropRect.y, cropRect.y + cropRect.height));
  const width = Math.round(Math.abs(cropRect.width));
  const height = Math.round(Math.abs(cropRect.height));
  if (width < 8 || height < 8) return null;
  return { x, y, width, height };
}

function refreshCropStatus() {
  const rect = normalizedCropRect();
  applyCropButton.disabled = !rect;
  cropStatus.textContent = rect
    ? `Auswahl ${rect.width} x ${rect.height}`
    : "Rahmen im Bild aufziehen";
}

function applyCrop() {
  const rect = normalizedCropRect();
  if (!rect) return;

  drawImage(false);
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = rect.width;
  cropCanvas.height = rect.height;
  const cropCtx = cropCanvas.getContext("2d");
  cropCtx.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);

  const image = new Image();
  image.addEventListener("load", () => {
    sourceImage = image;
    ratio = image.width / image.height;
    widthInput.value = image.width;
    heightInput.value = image.height;
    originalSize.textContent = `${image.width} x ${image.height}`;
    sourceName = `${sourceName}-crop`;
    setCropMode(false);
    setStatus("Zuschnitt angewendet");
    drawImage();
  });
  image.src = cropCanvas.toDataURL("image/png");
}

function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    setStatus("Bitte eine Bilddatei auswählen");
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const image = new Image();
    image.addEventListener("load", () => {
      sourceImage = image;
      sourceName = file.name.replace(/\.[^.]+$/, "") || "pixel-studio";
      ratio = image.width / image.height;
      originalSize.textContent = `${image.width} x ${image.height}`;
      if (lockRatio.checked) {
        widthInput.value = image.width;
        heightInput.value = image.height;
      }
      downloadButton.disabled = false;
      cropModeButton.disabled = false;
      setCropMode(false);
      setStatus(`${file.name} geladen`);
      drawImage();
    });
    image.src = reader.result;
  });
  reader.readAsDataURL(file);
}

function handleDimensionInput(changed) {
  if (lockRatio.checked && sourceImage) {
    if (changed === "width") {
      heightInput.value = Math.round(Number(widthInput.value) / ratio);
    } else {
      widthInput.value = Math.round(Number(heightInput.value) * ratio);
    }
  }
  drawImage();
}

fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));
widthInput.addEventListener("input", () => handleDimensionInput("width"));
heightInput.addEventListener("input", () => handleDimensionInput("height"));
backgroundInput.addEventListener("input", drawImage);
formatSelect.addEventListener("change", drawImage);
qualityInput.addEventListener("input", updateQuality);
cropModeButton.addEventListener("click", () => setCropMode(!cropActive));
cancelCropButton.addEventListener("click", () => setCropMode(false));
applyCropButton.addEventListener("click", applyCrop);

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  loadFile(event.dataTransfer.files[0]);
});

canvas.addEventListener("pointerdown", (event) => {
  if (!cropActive || !sourceImage) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  cropDragging = true;
  cropStart = getCanvasPoint(event);
  cropRect = { x: cropStart.x, y: cropStart.y, width: 0, height: 0 };
  refreshCropStatus();
  drawImage();
});

canvas.addEventListener("pointermove", (event) => {
  if (!cropActive || !cropDragging || !cropStart) return;
  event.preventDefault();
  const point = getCanvasPoint(event);
  cropRect = {
    x: cropStart.x,
    y: cropStart.y,
    width: point.x - cropStart.x,
    height: point.y - cropStart.y,
  };
  refreshCropStatus();
  drawImage();
});

canvas.addEventListener("pointerup", (event) => {
  if (!cropActive || !cropDragging) return;
  cropDragging = false;
  canvas.releasePointerCapture(event.pointerId);
  refreshCropStatus();
  drawImage();
});

fitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    fitMode = button.dataset.fit;
    fitButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    drawImage();
  });
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const [width, height] = button.dataset.preset.split("x").map(Number);
    widthInput.value = width;
    heightInput.value = height;
    drawImage();
  });
});

resetButton.addEventListener("click", () => {
  setCropMode(false);
  widthInput.value = sourceImage ? sourceImage.width : 1200;
  heightInput.value = sourceImage ? sourceImage.height : 800;
  backgroundInput.value = "#070812";
  qualityInput.value = 92;
  updateQuality();
  drawImage();
});

downloadButton.addEventListener("click", () => {
  drawImage(false);
  const mime = formatSelect.value;
  const extension = mime.split("/")[1].replace("jpeg", "jpg");
  const quality = Number(qualityInput.value) / 100;
  const link = document.createElement("a");
  link.download = `${sourceName}-${canvas.width}x${canvas.height}.${extension}`;
  link.href = canvas.toDataURL(mime, quality);
  link.click();
  drawImage();
});

updateQuality();
drawPlaceholder();
