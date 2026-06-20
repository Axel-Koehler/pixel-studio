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
const transparentToggle = document.querySelector("#transparent-toggle");
const selectedColorInput = document.querySelector("#selected-color-input");
const colorToleranceInput = document.querySelector("#color-tolerance-input");
const colorToleranceOutput = document.querySelector("#color-tolerance-output");
const pickColorButton = document.querySelector("#pick-color-button");
const removeColorButton = document.querySelector("#remove-color-button");
const removeBackgroundButton = document.querySelector("#remove-background-button");
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
let imagePan = { x: 0, y: 0 };
let imageDragging = false;
let imageDragStart = null;
let imagePanStart = null;
let colorPickActive = false;
let transparentBackground = false;

function setStatus(text) {
  statusLabel.textContent = text;
}

function syncExportLabel() {
  exportSize.textContent = `${canvas.width} x ${canvas.height}`;
}

function fillCanvasBase(width, height) {
  ctx.clearRect(0, 0, width, height);
  if (transparentBackground) return;
  ctx.fillStyle = backgroundInput.value;
  ctx.fillRect(0, 0, width, height);
}

function drawPlaceholder() {
  canvas.width = Number(widthInput.value);
  canvas.height = Number(heightInput.value);
  fillCanvasBase(canvas.width, canvas.height);
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
  fillCanvasBase(targetWidth, targetHeight);

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

  ctx.drawImage(sourceImage, offsetX + imagePan.x, offsetY + imagePan.y, drawWidth, drawHeight);
  syncExportLabel();
  if (showOverlay) drawCropOverlay();
}

function updateQuality() {
  qualityOutput.textContent = `${qualityInput.value}%`;
}

function updateTolerance() {
  colorToleranceOutput.textContent = colorToleranceInput.value;
}

function setTransparentMode(active) {
  transparentBackground = active;
  transparentToggle.checked = active;
  drawImage();
}

function setColorPickMode(active) {
  colorPickActive = active && Boolean(sourceImage);
  pickColorButton.classList.toggle("is-active", colorPickActive);
  canvas.classList.toggle("is-cropping", colorPickActive || cropActive);
  canvas.classList.toggle("is-draggable", Boolean(sourceImage) && !cropActive && !colorPickActive);
  if (colorPickActive) setStatus("Farbe im Bild anklicken");
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function colorDistance(data, index, color) {
  const red = data[index] - color.r;
  const green = data[index + 1] - color.g;
  const blue = data[index + 2] - color.b;
  return Math.sqrt(red * red + green * green + blue * blue);
}

function getSourceImageData() {
  const workCanvas = document.createElement("canvas");
  workCanvas.width = sourceImage.width;
  workCanvas.height = sourceImage.height;
  const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
  workCtx.clearRect(0, 0, workCanvas.width, workCanvas.height);
  workCtx.drawImage(sourceImage, 0, 0);
  return {
    canvas: workCanvas,
    ctx: workCtx,
    imageData: workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height),
  };
}

function replaceSourceFromImageData(canvasSource, ctxSource, imageData, suffix, status) {
  ctxSource.putImageData(imageData, 0, 0);
  const image = new Image();
  image.addEventListener("load", () => {
    sourceImage = image;
    ratio = image.width / image.height;
    imagePan = { x: 0, y: 0 };
    sourceName = `${sourceName}-${suffix}`;
    originalSize.textContent = `${image.width} x ${image.height}`;
    formatSelect.value = "image/png";
    setTransparentMode(true);
    setCropMode(false);
    setColorPickMode(false);
    setStatus(status);
    drawImage();
  });
  image.src = canvasSource.toDataURL("image/png");
}

function removeSelectedColor() {
  if (!sourceImage) return;
  const targetColor = hexToRgb(selectedColorInput.value);
  const tolerance = Number(colorToleranceInput.value) * 1.73;
  const { canvas: workCanvas, ctx: workCtx, imageData } = getSourceImageData();
  const pixels = imageData.data;
  let removed = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] === 0) continue;
    if (colorDistance(pixels, index, targetColor) <= tolerance) {
      pixels[index + 3] = 0;
      removed += 1;
    }
  }

  replaceSourceFromImageData(workCanvas, workCtx, imageData, "farbe-entfernt", `${removed.toLocaleString("de-DE")} Pixel entfernt`);
}

function removeBackground() {
  if (!sourceImage) return;
  const tolerance = Number(colorToleranceInput.value) * 1.73;
  const { canvas: workCanvas, ctx: workCtx, imageData } = getSourceImageData();
  const { width, height } = workCanvas;
  const pixels = imageData.data;
  const visited = new Uint8Array(width * height);
  const queue = [];
  const cornerIndexes = [0, width - 1, (height - 1) * width, height * width - 1];
  const cornerColors = cornerIndexes.map((pixelIndex) => {
    const index = pixelIndex * 4;
    return { r: pixels[index], g: pixels[index + 1], b: pixels[index + 2] };
  });
  let removed = 0;

  function matchesBackground(pixelIndex) {
    const index = pixelIndex * 4;
    if (pixels[index + 3] === 0) return true;
    return cornerColors.some((color) => colorDistance(pixels, index, color) <= tolerance);
  }

  function enqueue(pixelIndex) {
    if (visited[pixelIndex] || !matchesBackground(pixelIndex)) return;
    visited[pixelIndex] = 1;
    queue.push(pixelIndex);
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }

  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const pixelIndex = queue[cursor];
    const index = pixelIndex * 4;
    if (pixels[index + 3] !== 0) {
      pixels[index + 3] = 0;
      removed += 1;
    }

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) enqueue(pixelIndex - 1);
    if (x < width - 1) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - width);
    if (y < height - 1) enqueue(pixelIndex + width);
  }

  replaceSourceFromImageData(workCanvas, workCtx, imageData, "hintergrund-entfernt", `${removed.toLocaleString("de-DE")} Hintergrund-Pixel entfernt`);
}

function setCropMode(active) {
  cropActive = active && Boolean(sourceImage);
  cropDragging = false;
  cropStart = null;
  cropRect = null;
  imageDragging = false;
  cropPanel.hidden = !cropActive;
  canvas.classList.toggle("is-cropping", cropActive);
  canvas.classList.toggle("is-draggable", Boolean(sourceImage) && !cropActive && !colorPickActive);
  canvas.classList.remove("is-panning");
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
    imagePan = { x: 0, y: 0 };
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
      imagePan = { x: 0, y: 0 };
      originalSize.textContent = `${image.width} x ${image.height}`;
      if (lockRatio.checked) {
        widthInput.value = image.width;
        heightInput.value = image.height;
      }
      downloadButton.disabled = false;
      cropModeButton.disabled = false;
      pickColorButton.disabled = false;
      removeColorButton.disabled = false;
      removeBackgroundButton.disabled = false;
      canvas.classList.add("is-draggable");
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
colorToleranceInput.addEventListener("input", updateTolerance);
transparentToggle.addEventListener("change", () => setTransparentMode(transparentToggle.checked));
pickColorButton.addEventListener("click", () => setColorPickMode(!colorPickActive));
removeColorButton.addEventListener("click", removeSelectedColor);
removeBackgroundButton.addEventListener("click", removeBackground);
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
  if (!sourceImage) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  const point = getCanvasPoint(event);

  if (colorPickActive) {
    drawImage(false);
    const pixel = ctx.getImageData(Math.round(point.x), Math.round(point.y), 1, 1).data;
    selectedColorInput.value = rgbToHex(pixel[0], pixel[1], pixel[2]);
    setColorPickMode(false);
    setStatus(`Farbe ${selectedColorInput.value} gewählt`);
    drawImage();
    return;
  }

  if (cropActive) {
    cropDragging = true;
    cropStart = point;
    cropRect = { x: cropStart.x, y: cropStart.y, width: 0, height: 0 };
    refreshCropStatus();
    drawImage();
    return;
  }

  imageDragging = true;
  imageDragStart = point;
  imagePanStart = { ...imagePan };
  canvas.classList.add("is-panning");
});

canvas.addEventListener("pointermove", (event) => {
  if (!sourceImage) return;
  event.preventDefault();
  const point = getCanvasPoint(event);

  if (imageDragging && imageDragStart && imagePanStart) {
    imagePan = {
      x: imagePanStart.x + point.x - imageDragStart.x,
      y: imagePanStart.y + point.y - imageDragStart.y,
    };
    drawImage();
    return;
  }

  if (!cropActive || !cropDragging || !cropStart) return;
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
  if (!sourceImage) return;
  if (imageDragging) {
    imageDragging = false;
    imageDragStart = null;
    imagePanStart = null;
    canvas.classList.remove("is-panning");
  }
  if (cropActive && cropDragging) {
    cropDragging = false;
    refreshCropStatus();
    drawImage();
  }
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener("pointercancel", () => {
  imageDragging = false;
  cropDragging = false;
  imageDragStart = null;
  imagePanStart = null;
  canvas.classList.remove("is-panning");
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
  imagePan = { x: 0, y: 0 };
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
updateTolerance();
drawPlaceholder();
