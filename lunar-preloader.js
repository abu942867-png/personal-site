(function () {
  "use strict";

  var preloader = document.getElementById("preloader");
  var system = preloader && preloader.querySelector(".parallel-gears");
  var moon = system && system.querySelector(".parallel-moon");
  var digits = document.getElementById("preloader-percent-digits");
  if (!preloader || !system || !moon || !digits) return;

  /* Reuse the recovered runtime's eased percentage wheels so this layer reads
     the same real progress without forking or duplicating the asset loader. */
  if (!digits.children.length) {
    for (var digitIndex = 0; digitIndex < 3; digitIndex++) {
      var digit = document.createElement("span");
      digit.className = "preloader-percent-digit";
      digit.innerHTML = '<span class="preloader-percent-digit-num">0</span>' +
        '<span class="preloader-percent-digit-num">0</span>';
      digits.appendChild(digit);
    }
  }

  var shell = document.createElement("div");
  shell.className = "parallel-moon-shell";
  moon.parentNode.insertBefore(shell, moon);
  shell.appendChild(moon);

  var aura = document.createElement("span");
  aura.className = "parallel-moon-aura";
  shell.insertBefore(aura, moon);

  var canvas = document.createElement("canvas");
  canvas.className = "parallel-moon-phase";
  canvas.width = 900;
  canvas.height = 900;
  canvas.setAttribute("aria-hidden", "true");
  shell.appendChild(canvas);

  var progress = document.createElement("div");
  progress.className = "parallel-progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", "Loading");
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  progress.innerHTML = '<span class="parallel-progress-phase">NEW MOON</span>';
  system.appendChild(progress);

  var phaseLabel = progress.querySelector(".parallel-progress-phase");
  var context = canvas.getContext("2d");
  var latestProgress = 0;
  var paintedProgress = -1;

  function phaseName(value) {
    if (value >= .985) return "FULL MOON";
    if (value >= .58) return "WAXING GIBBOUS";
    if (value >= .43) return "FIRST QUARTER";
    if (value >= .04) return "WAXING CRESCENT";
    return "NEW MOON";
  }

  /* Project a spherical terminator onto the moon texture. At 0 the terminator
     hugs the right limb; at 50 it is vertical; at 100 it reaches the left. */
  function drawMoonPhase(value) {
    if (!moon.complete || !moon.naturalWidth || !context) return;
    var size = canvas.width;
    var center = size / 2;
    var radius = size * .452;
    var theta = Math.PI * (1 - value);
    var terminator = Math.cos(theta);
    var steps = 180;

    context.clearRect(0, 0, size, size);
    if (value <= .0001) return;
    context.save();
    context.beginPath();
    context.moveTo(center, center - radius);
    context.arc(center, center, radius, -Math.PI / 2, Math.PI / 2, false);
    for (var step = 0; step <= steps; step++) {
      var y = radius - (2 * radius * step / steps);
      var x = center - terminator * Math.sqrt(Math.max(0, radius * radius - y * y));
      context.lineTo(x, center + y);
    }
    context.closePath();
    context.clip();
    context.drawImage(moon, 0, 0, size, size);
    context.restore();
  }

  function setProgress(value) {
    value = Math.max(0, Math.min(1, Number(value) || 0));
    latestProgress = value;
    if (Math.abs(value - paintedProgress) < .00035) return;
    paintedProgress = value;

    var percent = Math.min(100, Math.round(value * 100));
    var label = phaseName(value);
    phaseLabel.textContent = label;
    progress.setAttribute("aria-valuenow", String(percent));
    progress.setAttribute("aria-valuetext", label + ", " + percent + " percent");
    shell.style.setProperty("--phase-glow", (.08 + value * .84).toFixed(3));
    shell.style.setProperty("--phase-scale", (value * .12).toFixed(3));
    drawMoonPhase(value);
  }

  var digitNodes = digits.querySelectorAll(".preloader-percent-digit");
  var progressDigit = digitNodes[digitNodes.length - 1];
  /* Time-based floor: the moon starts waxing immediately and evenly from the
     first frame instead of sitting dark while the runtime bundle boots.
     Real progress takes over as soon as it exceeds the floor. */
  var bootTime = performance.now();
  function timeFloor() {
    return 0.45 * Math.min(1, (performance.now() - bootTime) / 6000);
  }
  function syncFromRuntime() {
    var real = typeof progressDigit._easedVal === "number" ? progressDigit._easedVal / 100 : 0;
    setProgress(Math.max(real, timeFloor()));
    if (!preloader.classList.contains("parallel-preloader-done")) {
      window.requestAnimationFrame(syncFromRuntime);
    }
  }

  if (!moon.complete) {
    moon.addEventListener("load", function () {
      drawMoonPhase(latestProgress);
    }, { once: true });
  }
  window.addEventListener("lusion-started", function () {
    setProgress(1);
  });
  setProgress(0);
  window.requestAnimationFrame(syncFromRuntime);
})();
