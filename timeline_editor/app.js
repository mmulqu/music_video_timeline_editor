"use strict";

const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);
const MEDIA_RE = /\.(avif|bmp|gif|jpe?g|png|webp|mp4|mov|m4v|mkv|webm)$/i;
const VIDEO_RE = /\.(mp4|mov|m4v|mkv|webm)$/i;
const GIF_RE = /\.gif$/i;
const state = { manifest: null, selectedCaptionId: null, currentVisualId: null, replacingVisualId: null, libraryMode: "replace", mediaTab: "cue", saveHandle: null, objectUrls: new Map(), waveform: null, playbackFrame: null, musicObjectUrl: null, pendingSeek: null, gifRestart: 0, assetRefreshTimer: null, assetRefreshInFlight: false };
const song = byId("song");
const waveform = byId("waveform");
const waveformContext = waveform.getContext("2d");
const programImage = byId("program-image");
const programVideo = byId("program-video");

function clock(seconds, precision = 3) {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  const ms = Math.round((total - Math.floor(total)) * 1000);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0").slice(0, precision)}`;
}

function num(value, fallback = 0) {
  const candidate = Number.parseFloat(value);
  return Number.isFinite(candidate) ? candidate : fallback;
}

function currentCaption() {
  return state.manifest.captions.find((cue) => cue.id === state.selectedCaptionId) || state.manifest.captions[0];
}

function assetById(id) { return state.manifest.assets.find((asset) => asset.id === id); }
function assetUrl(asset) {
  const objectUrl = state.objectUrls.get(asset.id);
  if (objectUrl) return objectUrl;
  const url = `../${asset.relative_path}`;
  if (!asset.source_modified_ms) return url;
  return `${url}${url.includes("?") ? "&" : "?"}media_mtime=${asset.source_modified_ms}`;
}
function assetTypeLabel(asset) { return asset?.type === "gif" ? "ANIMATED GIF" : asset?.type === "video" ? "VIDEO" : "IMAGE"; }
function inferAssetType(name, currentType = "image") {
  if (GIF_RE.test(name || "")) return "gif";
  if (currentType === "video" || VIDEO_RE.test(name || "")) return "video";
  return "image";
}
function normalizeAssetTypes(manifest) {
  for (const asset of manifest.assets || []) {
    asset.type = inferAssetType(`${asset.name || ""} ${asset.relative_path || ""}`, asset.type);
    if (asset.type === "gif") asset.animation_policy ||= "loop_to_timeline";
  }
}
function programAssetUrl(asset, restart = false) {
  const url = assetUrl(asset);
  if (asset.type !== "gif" || !restart || url.startsWith("blob:")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}timeline_gif_restart=${++state.gifRestart}`;
}
function visualsForCaption(captionId) {
  const cue = state.manifest.captions.find((caption) => caption.id === captionId);
  return state.manifest.visuals.filter((visual) => visual.caption_id === captionId || (
    cue && visual.caption_id == null && visual.start < cue.end && visual.end > cue.start
  ));
}
function visualAssetName(captionId) {
  const visual = visualsForCaption(captionId).at(-1);
  return visual ? (assetById(visual.asset_id)?.name || "Missing asset") : "—";
}
function clamp(value, low, high) { return Math.min(high, Math.max(low, value)); }
function duration() { return state.manifest.soundtrack.duration_seconds; }
function activeCaptionAt(time) { return state.manifest.captions.filter((cue) => time >= cue.start && time < cue.end).sort((a, b) => a.start - b.start).at(-1) || null; }
function activeVisualAt(time) { return state.manifest.visuals.filter((visual) => time >= visual.start && time < visual.end).sort((a, b) => a.start - b.start).at(-1) || null; }
function sortTimeline() { state.manifest.captions.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)); state.manifest.visuals.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)); }

function dirty(message = "Unsaved changes") {
  state.manifest.editor = { ...state.manifest.editor, last_edited_at: new Date().toISOString() };
  byId("save-status").textContent = message;
}

function setStatus(message, isError = false) {
  const status = byId("save-status");
  status.textContent = message;
  status.style.color = isError ? "var(--danger)" : "";
}

function selectCaption(id, seek = false) {
  state.selectedCaptionId = id;
  const cue = currentCaption();
  if (seek) seekTo(cue.start);
  renderInspector();
  renderCaptionTable();
  renderLinkedVisuals();
  renderCueMediaManager();
  updatePlayhead();
}

function renderInspector() {
  const cue = currentCaption();
  if (!cue) return;
  byId("selected-id").textContent = cue.id;
  byId("selected-section").textContent = cue.section || "Unsectioned";
  byId("caption-text").value = cue.text;
  byId("caption-start").value = cue.start.toFixed(3);
  byId("caption-end").value = cue.end.toFixed(3);
  byId("caption-notes").value = cue.notes || "";
  byId("selected-duration").textContent = `${(cue.end - cue.start).toFixed(3)} seconds • confidence ${(cue.confidence ?? 0).toFixed(2)}`;
}

function renderLinkedVisuals() {
  const container = byId("linked-visual-list");
  const visuals = visualsForCaption(currentCaption().id);
  container.replaceChildren();
  if (!visuals.length) {
    container.innerHTML = '<p class="empty-note">No visual beat attached yet. Select an asset and use it at this cue.</p>';
    return;
  }
  for (const visual of visuals) {
    const asset = assetById(visual.asset_id);
    const row = document.createElement("div");
    row.className = "linked-visual";
    const preview = asset?.type === "video" ? document.createElement("video") : document.createElement("img");
    if (preview.tagName === "VIDEO") { preview.muted = true; preview.preload = "metadata"; preview.controls = true; }
    preview.src = asset ? assetUrl(asset) : "";
    preview.alt = "";
    const info = document.createElement("div");
    const sourceControls = asset?.type === "video" ? `<div class="source-time-label">SOURCE IN / OUT</div><div class="visual-time-inputs source-time-inputs"><input aria-label="Video source in" type="number" min="0" step="0.01" value="${Number(visual.source_in || 0).toFixed(3)}"><input aria-label="Video source out" type="number" min="0" step="0.01" placeholder="full" value="${visual.source_out == null ? "" : Number(visual.source_out).toFixed(3)}"></div>` : "";
    info.innerHTML = `<strong>${asset?.name || "Missing asset"}</strong><div class="source-time-label">TIMELINE IN / OUT</div><div class="visual-time-inputs timeline-time-inputs"><input aria-label="Visual beat in" type="number" min="0" step="0.01" value="${visual.start.toFixed(3)}"><input aria-label="Visual beat out" type="number" min="0" step="0.01" value="${visual.end.toFixed(3)}"></div>${sourceControls}`;
    const timeInputs = info.querySelectorAll("input");
    timeInputs[0].addEventListener("change", (event) => updateVisualTiming(visual.id, "start", event.target.value));
    timeInputs[1].addEventListener("change", (event) => updateVisualTiming(visual.id, "end", event.target.value));
    if (asset?.type === "video") {
      timeInputs[2].addEventListener("change", (event) => updateVisualSource(visual.id, "source_in", event.target.value));
      timeInputs[3].addEventListener("change", (event) => updateVisualSource(visual.id, "source_out", event.target.value));
    }
    const remove = document.createElement("button");
    remove.className = "remove-visual"; remove.textContent = "×"; remove.title = "Remove visual beat";
    remove.addEventListener("click", () => removeVisual(visual.id));
    row.append(preview, info, remove); container.append(row);
  }
}

function removeVisual(id) {
  state.manifest.visuals = state.manifest.visuals.filter((item) => item.id !== id);
  if (state.replacingVisualId === id) state.replacingVisualId = null;
  dirty("Visual beat removed"); renderLinkedVisuals(); renderCueMediaManager(); renderCaptionTable(); updateProgramMonitor(song.currentTime, activeCaptionAt(song.currentTime), true);
}

function switchMediaTab(tab) {
  state.mediaTab = tab;
  const cueActive = tab === "cue";
  byId("cue-media-tab").classList.toggle("active", cueActive);
  byId("cue-media-tab").setAttribute("aria-selected", String(cueActive));
  byId("library-media-tab").classList.toggle("active", !cueActive);
  byId("library-media-tab").setAttribute("aria-selected", String(!cueActive));
  byId("cue-media-panel").hidden = !cueActive;
  byId("library-media-panel").hidden = cueActive;
  if (cueActive) renderCueMediaManager();
  else { renderAssets(); refreshProjectAssets(); }
}

function beginReplaceVisual(id) {
  state.libraryMode = "replace";
  state.replacingVisualId = id;
  switchMediaTab("library");
}

function replacementTargetForContext() {
  return activeVisualAt(song.currentTime);
}

function openLibraryForReplacement() {
  state.libraryMode = "replace";
  state.replacingVisualId = replacementTargetForContext()?.id || null;
  switchMediaTab("library");
}

function openLibraryForNewBeat() {
  state.libraryMode = "add";
  state.replacingVisualId = null;
  switchMediaTab("library");
}

function renderCueMediaManager() {
  if (!state.manifest) return;
  const cue = currentCaption();
  const visuals = visualsForCaption(cue.id);
  byId("cue-media-title").textContent = `${cue.id} — ${cue.section || "Unsectioned"}`;
  byId("cue-media-count").textContent = `${visuals.length} visual${visuals.length === 1 ? "" : "s"}`;
  const list = byId("cue-media-list");
  list.replaceChildren();
  if (!visuals.length) {
    list.innerHTML = '<p class="empty-note">This lyric has no visual attached. Use “Add visual from Library.”</p>';
    return;
  }
  for (const visual of visuals) {
    const asset = assetById(visual.asset_id);
    const card = document.createElement("article"); card.className = "cue-media-card";
    const previewWrap = document.createElement("div"); previewWrap.className = "cue-media-preview";
    const preview = asset?.type === "video" ? document.createElement("video") : document.createElement("img");
    if (asset?.type === "video") { preview.controls = true; preview.muted = true; preview.preload = "metadata"; }
    preview.src = asset ? assetUrl(asset) : ""; preview.alt = asset?.name || "Missing visual"; previewWrap.append(preview);
    const meta = document.createElement("div"); meta.className = "cue-media-meta";
    meta.innerHTML = `<strong>${escapeHtml(asset?.name || "Missing visual")}</strong><span>${assetTypeLabel(asset)} • ${clock(visual.start)}–${clock(visual.end)}</span>`;
    const actions = document.createElement("div"); actions.className = "cue-media-actions";
    const seekButton = document.createElement("button"); seekButton.className = "secondary"; seekButton.textContent = "Seek"; seekButton.addEventListener("click", () => seekTo(visual.start));
    const replaceButton = document.createElement("button"); replaceButton.className = "primary"; replaceButton.textContent = "Replace"; replaceButton.addEventListener("click", () => beginReplaceVisual(visual.id));
    const removeButton = document.createElement("button"); removeButton.className = "secondary"; removeButton.textContent = "×"; removeButton.title = "Remove visual"; removeButton.addEventListener("click", () => removeVisual(visual.id));
    actions.append(seekButton, replaceButton, removeButton); card.append(previewWrap, meta, actions); list.append(card);
  }
}

function renderCaptionTable() {
  const query = byId("caption-filter").value.trim().toLowerCase();
  const playTime = song.currentTime;
  const body = byId("caption-list");
  body.replaceChildren();
  for (const cue of state.manifest.captions) {
    const haystack = `${cue.id} ${cue.section} ${cue.text}`.toLowerCase();
    if (query && !haystack.includes(query)) continue;
    const row = document.createElement("tr");
    row.classList.toggle("selected", cue.id === state.selectedCaptionId);
    row.classList.toggle("at-playhead", playTime >= cue.start && playTime <= cue.end);
    row.dataset.cueId = cue.id;
    row.innerHTML = `<td class="cue-id">${cue.id}</td><td class="cue-time">${clock(cue.start)}</td><td class="cue-time">${clock(cue.end)}</td><td class="cue-line" title="${escapeHtml(cue.text)}">${escapeHtml(cue.text)}</td><td class="cue-visual" title="${escapeHtml(visualAssetName(cue.id))}">${escapeHtml(visualAssetName(cue.id))}</td><td><button class="row-action" title="Seek to cue">↗</button></td>`;
    row.addEventListener("click", () => selectCaption(cue.id, true));
    body.append(row);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

function renderAssets() {
  const filter = byId("asset-filter").value.trim().toLowerCase();
  const grid = byId("asset-grid");
  grid.replaceChildren();
  const replacing = state.libraryMode === "replace";
  const target = replacing ? state.manifest.visuals.find((visual) => visual.id === state.replacingVisualId) : null;
  const targetAsset = target ? assetById(target.asset_id) : null;
  const modePanel = byId("replace-mode");
  modePanel.classList.toggle("add-mode", !replacing);
  modePanel.classList.toggle("blocked-mode", replacing && !target);
  if (replacing && target) {
    byId("library-mode-label").textContent = `Replacing ${target.id} • ${clock(target.start)}–${clock(target.end)} • ${targetAsset?.name || "missing asset"}`;
  } else if (replacing) {
    byId("library-mode-label").textContent = "No visual under the playhead. Seek to a visual before replacing it.";
  } else {
    byId("library-mode-label").textContent = `Adding a new visual beat to ${currentCaption().id}`;
  }
  byId("toggle-library-mode").textContent = replacing ? "+ Add new beat" : "Replace current instead";
  const assets = state.manifest.assets.filter((asset) => !filter || `${asset.name} ${asset.relative_path}`.toLowerCase().includes(filter));
  for (const asset of assets) {
    const card = byId("asset-template").content.firstElementChild.cloneNode(true);
    if (!asset.relative_path) card.classList.add("session-only");
    const thumb = card.querySelector(".asset-thumb");
    const preview = asset.type === "video" ? document.createElement("video") : document.createElement("img");
    if (asset.type === "video") { preview.muted = true; preview.loop = true; preview.preload = "metadata"; preview.addEventListener("mouseenter", () => preview.play().catch(() => {})); preview.addEventListener("mouseleave", () => { preview.pause(); preview.currentTime = 0; }); }
    preview.src = assetUrl(asset); preview.alt = asset.name;
    thumb.append(preview);
    card.querySelector("strong").textContent = asset.name;
    card.querySelector("span").textContent = `${assetTypeLabel(asset)} • ${asset.relative_path || "session only"}`;
    const useButton = card.querySelector(".use-asset");
    useButton.textContent = replacing ? (target ? `Replace ${target.id}` : "Seek to a visual first") : `Add new beat to ${currentCaption().id}`;
    useButton.disabled = replacing && !target;
    if (!useButton.disabled) useButton.addEventListener("click", () => useAssetForCue(asset.id));
    grid.append(card);
  }
  byId("asset-count").textContent = `${state.manifest.assets.length} assets`;
}

function useAssetForCue(assetId) {
  if (state.libraryMode === "replace") {
    const visual = state.manifest.visuals.find((item) => item.id === state.replacingVisualId);
    if (!visual) { setStatus("Nothing was replaced. Seek to the visual you want to change, then reopen Library.", true); return; }
    const originalStart = visual.start;
    const originalEnd = visual.end;
    visual.asset_id = assetId; visual.source_in = 0; visual.source_out = null; visual.playback_rate = 1;
    visual.start = originalStart;
    visual.end = originalEnd;
    dirty(`Replaced ${visual.id} • timing kept ${clock(originalStart)}–${clock(originalEnd)}`);
    state.replacingVisualId = null;
    renderLinkedVisuals(); renderCaptionTable(); updateProgramMonitor(song.currentTime, activeCaptionAt(song.currentTime), true);
    switchMediaTab("cue");
    return;
  }
  addVisualAtCue(assetId);
  switchMediaTab("cue");
}

function nextVisualId() {
  let highest = 0;
  for (const visual of state.manifest.visuals) highest = Math.max(highest, Number.parseInt(String(visual.id).replace(/\D/g, ""), 10) || 0);
  return `V${String(highest + 1).padStart(4, "0")}`;
}

function addVisualAtCue(assetId) {
  const cue = currentCaption();
  if (!cue) return;
  const overlaps = state.manifest.visuals.filter((visual) => visual.start < cue.end && visual.end > cue.start).length;
  state.manifest.visuals.push({ id: nextVisualId(), caption_id: cue.id, asset_id: assetId, start: cue.start, end: cue.end, source_in: 0, source_out: null, motion: "static", transition: "hard", notes: "Added in Timeline Desk." });
  dirty(overlaps
    ? `Added new beat to ${cue.id} • overlaps ${overlaps} existing beat${overlaps === 1 ? "" : "s"}; review In/Out`
    : `Added new beat to ${cue.id}`);
  renderLinkedVisuals(); renderCueMediaManager(); renderCaptionTable();
}

function updateVisualTiming(id, field, value) {
  const visual = state.manifest.visuals.find((item) => item.id === id);
  if (!visual) return;
  const bounded = clamp(num(value, visual[field]), 0, duration());
  if (field === "start") visual.start = Math.min(bounded, visual.end - 0.01);
  if (field === "end") visual.end = Math.max(bounded, visual.start + 0.01);
  sortTimeline(); dirty("Visual beat retimed"); renderLinkedVisuals(); renderCueMediaManager(); updateProgramMonitor(song.currentTime, activeCaptionAt(song.currentTime));
}

function updateVisualSource(id, field, value) {
  const visual = state.manifest.visuals.find((item) => item.id === id);
  if (!visual) return;
  if (field === "source_out" && String(value).trim() === "") visual.source_out = null;
  else {
    const parsed = Math.max(0, num(value, visual[field] || 0));
    if (field === "source_in") visual.source_in = Math.min(parsed, visual.source_out == null ? parsed : Math.max(0, visual.source_out - .01));
    if (field === "source_out") visual.source_out = Math.max(parsed, Number(visual.source_in || 0) + .01);
  }
  dirty("Video source range updated"); renderLinkedVisuals(); renderCueMediaManager(); updateProgramMonitor(song.currentTime, activeCaptionAt(song.currentTime), true);
}

function updateCaption(field, value) {
  const cue = currentCaption();
  if (!cue) return;
  if (field === "text" || field === "notes") cue[field] = value;
  else {
    const bounded = clamp(num(value, cue[field]), 0, duration());
    if (field === "start") cue.start = Math.min(bounded, cue.end - 0.01);
    if (field === "end") cue.end = Math.max(bounded, cue.start + 0.01);
    sortTimeline();
  }
  dirty(); renderInspector(); renderCaptionTable(); updatePlayhead();
}

function setBoundary(kind) { updateCaption(kind, song.currentTime); const applied = currentCaption()[kind]; setStatus(`${kind === "start" ? "In" : "Out"} set at ${clock(applied)}`); }
function playableDuration() {
  return Number.isFinite(song.duration) && song.duration > 0 ? song.duration : duration();
}

function applySeek(target) {
  const bounded = clamp(target, 0, playableDuration());
  state.pendingSeek = null;
  try {
    song.currentTime = bounded;
    updatePlayhead(true);
    setStatus(`Seeking to ${clock(bounded)}`);
  } catch (error) {
    state.pendingSeek = bounded;
    setStatus(`Could not seek yet: ${error.message}`, true);
  }
}

function seekTo(seconds) {
  const target = clamp(num(seconds, 0), 0, playableDuration());
  if (song.readyState < HTMLMediaElement.HAVE_METADATA || !Number.isFinite(song.duration)) {
    state.pendingSeek = target;
    setStatus(`Loading soundtrack to seek to ${clock(target)}â€¦`);
    song.load();
    return;
  }
  applySeek(target);
}

function syncProgramVideo(visual) {
  const sourceIn = Number(visual.source_in || 0);
  const sourceOut = visual.source_out == null ? Number.POSITIVE_INFINITY : Number(visual.source_out);
  const playbackRate = clamp(num(visual.playback_rate, 1), .1, 16);
  const desired = clamp(sourceIn + Math.max(0, song.currentTime - visual.start) * playbackRate, sourceIn, sourceOut);
  if (programVideo.playbackRate !== playbackRate) programVideo.playbackRate = playbackRate;
  if (Number.isFinite(programVideo.duration)) {
    const bounded = Math.min(desired, Math.max(0, programVideo.duration - .02));
    if (Math.abs(programVideo.currentTime - bounded) > .16) programVideo.currentTime = bounded;
  } else {
    if (programVideo.dataset.pendingSync !== visual.id) {
      programVideo.dataset.pendingSync = visual.id;
      programVideo.addEventListener("loadedmetadata", () => { delete programVideo.dataset.pendingSync; if (state.currentVisualId === visual.id) syncProgramVideo(visual); }, { once: true });
    }
  }
  if (song.paused) programVideo.pause();
  else programVideo.play().catch(() => {});
}

function updateProgramMonitor(time, cue, force = false) {
  const visual = activeVisualAt(time);
  const captionOverlay = byId("program-caption");
  captionOverlay.hidden = !cue;
  captionOverlay.textContent = cue?.text || "";
  if (!visual) {
    state.currentVisualId = null;
    programImage.hidden = true; programVideo.hidden = true; programVideo.pause();
    byId("current-visual-label").value = "—";
    byId("replace-program-visual").hidden = true;
    return;
  }
  const asset = assetById(visual.asset_id);
  if (!asset) { byId("replace-program-visual").hidden = true; return; }
  const changed = force || state.currentVisualId !== visual.id;
  state.currentVisualId = visual.id;
  byId("current-visual-label").value = asset.name;
  byId("current-visual-label").title = `${visual.id} • ${clock(visual.start)}–${clock(visual.end)}`;
  byId("replace-program-visual").hidden = false;
  if (asset.type === "video") {
    programImage.hidden = true; programVideo.hidden = false;
    if (changed || programVideo.dataset.assetId !== asset.id) { programVideo.src = assetUrl(asset); programVideo.dataset.assetId = asset.id; }
    syncProgramVideo(visual);
  } else {
    programVideo.pause(); programVideo.hidden = true; programImage.hidden = false;
    if (changed || programImage.dataset.assetId !== asset.id) {
      if (asset.type === "gif" && state.objectUrls.has(asset.id)) programImage.removeAttribute("src");
      programImage.src = programAssetUrl(asset, changed);
      programImage.alt = asset.name;
      programImage.dataset.assetId = asset.id;
    }
  }
}

function scrollSelectedCaption() {
  const row = byId("caption-list").querySelector(`[data-cue-id="${state.selectedCaptionId}"]`);
  const scroller = row?.closest(".table-wrap");
  if (!row || !scroller) return;
  const target = row.offsetTop - (scroller.clientHeight - row.offsetHeight) / 2;
  scroller.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
}

function updatePlayhead(forceProgram = false) {
  if (!state.manifest) return;
  const percent = clamp(song.currentTime / duration(), 0, 1) * 100;
  byId("playhead").style.left = `${percent}%`;
  byId("current-clock").value = clock(song.currentTime);
  const cue = activeCaptionAt(song.currentTime);
  byId("caption-at-playhead").textContent = cue ? `${cue.id} — ${cue.text}` : "No caption at playhead";
  if (cue && byId("follow-playhead").checked && cue.id !== state.selectedCaptionId) {
    state.selectedCaptionId = cue.id;
    renderInspector(); renderLinkedVisuals(); renderCueMediaManager(); renderCaptionTable();
    requestAnimationFrame(scrollSelectedCaption);
  } else {
    for (const row of byId("caption-list").querySelectorAll("tr")) {
      const rowCue = state.manifest.captions.find((item) => item.id === row.dataset.cueId);
      row.classList.toggle("at-playhead", Boolean(rowCue && song.currentTime >= rowCue.start && song.currentTime < rowCue.end));
      row.classList.toggle("selected", row.dataset.cueId === state.selectedCaptionId);
    }
  }
  const window = byId("cue-window");
  if (cue) { window.hidden = false; window.style.left = `${(cue.start / duration()) * 100}%`; window.style.width = `${((cue.end - cue.start) / duration()) * 100}%`; }
  else window.hidden = true;
  updateProgramMonitor(song.currentTime, cue, forceProgram);
}

function playbackLoop() {
  updatePlayhead();
  if (!song.paused) state.playbackFrame = requestAnimationFrame(playbackLoop);
}

function resizeWaveform() {
  const rect = waveform.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  waveform.width = Math.max(1, Math.floor(rect.width * ratio));
  waveform.height = Math.max(1, Math.floor(rect.height * ratio));
  waveformContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawWaveform();
}

function drawWaveform() {
  const width = waveform.clientWidth, height = waveform.clientHeight;
  waveformContext.clearRect(0, 0, width, height);
  waveformContext.fillStyle = "#0b0f20"; waveformContext.fillRect(0, 0, width, height);
  waveformContext.strokeStyle = "#242d4a"; waveformContext.lineWidth = 1;
  for (let second = 0; second <= duration(); second += 30) { const x = width * second / duration(); waveformContext.beginPath(); waveformContext.moveTo(x, 0); waveformContext.lineTo(x, height); waveformContext.stroke(); }
  const values = state.waveform;
  if (!values) {
    waveformContext.fillStyle = "#8992ad"; waveformContext.font = "12px system-ui"; waveformContext.fillText("Loading waveform…", 14, height / 2); return;
  }
  const step = Math.max(1, Math.floor(values.length / width));
  waveformContext.strokeStyle = "#b6d47a"; waveformContext.globalAlpha = .78; waveformContext.lineWidth = 1;
  waveformContext.beginPath();
  for (let x = 0; x < width; x++) {
    const index = Math.min(values.length - 1, x * step);
    const amplitude = values[index] * height * .43;
    waveformContext.moveTo(x + .5, height / 2 - amplitude); waveformContext.lineTo(x + .5, height / 2 + amplitude);
  }
  waveformContext.stroke(); waveformContext.globalAlpha = 1;
}

async function loadWaveform(file = null) {
  try {
    const context = new AudioContext();
    const audioBytes = file ? await file.arrayBuffer() : await (await fetch(song.src)).arrayBuffer();
    const buffer = await context.decodeAudioData(audioBytes);
    const channel = buffer.getChannelData(0);
    const bins = 2500, block = Math.max(1, Math.floor(channel.length / bins));
    state.waveform = Array.from({ length: bins }, (_, index) => {
      let peak = 0; const start = index * block;
      for (let cursor = start; cursor < Math.min(channel.length, start + block); cursor++) peak = Math.max(peak, Math.abs(channel[cursor]));
      return peak;
    });
    context.close(); drawWaveform();
  } catch (error) {
    console.warn("Waveform unavailable", error); state.waveform = null; drawWaveform();
  }
}

function relativeFromFolder(file, rootName) {
  const raw = file.webkitRelativePath || "";
  if (!raw) return "";
  const parts = raw.split("/");
  if (!rootName || parts[0] !== rootName) return null;
  return parts.length > 1 ? parts.slice(1).join("/") : "";
}

function importFiles(files, useFolderPaths) {
  const selectedFiles = [...files];
  const folderRoot = useFolderPaths ? (selectedFiles[0]?.webkitRelativePath || "").split("/")[0] : "";
  if (useFolderPaths && selectedFiles.some((file) => relativeFromFolder(file, folderRoot) === null)) {
    setStatus("Choose one project folder so every saved media path has the same root.", true);
    return;
  }
  let count = 0;
  for (const file of selectedFiles) {
    if (!MEDIA_RE.test(file.name)) continue;
    const path = useFolderPaths ? relativeFromFolder(file, folderRoot) : "";
    const existing = path && state.manifest.assets.find((asset) => (asset.relative_path || "").toLowerCase() === path.toLowerCase());
    if (existing) { state.objectUrls.set(existing.id, URL.createObjectURL(file)); continue; }
    const id = `A-local-${crypto.randomUUID().slice(0, 8)}`;
    const type = inferAssetType(file.name);
    state.manifest.assets.push({ id, name: file.name, relative_path: path, type, ...(type === "gif" ? { animation_policy: "loop_to_timeline" } : {}), origin: path ? "project-folder-import" : "session-file-import" });
    state.objectUrls.set(id, URL.createObjectURL(file)); count++;
  }
  dirty(`${count} asset${count === 1 ? "" : "s"} imported`); renderAssets();
}

function setAssetRefreshStatus(message, isError = false) {
  const status = byId("asset-refresh-status");
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function uniqueScannedAssetId(preferredId) {
  if (!state.manifest.assets.some((asset) => asset.id === preferredId)) return preferredId;
  return `${preferredId}-${crypto.randomUUID().slice(0, 5)}`;
}

async function refreshProjectAssets({ manual = false } = {}) {
  if (!state.manifest || state.assetRefreshInFlight) return;
  state.assetRefreshInFlight = true;
  const button = byId("refresh-assets");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Checking…";
  if (manual) setAssetRefreshStatus("Scanning the project images folder…");

  try {
    const response = await fetch("/api/media", { cache: "no-store" });
    if (!response.ok) throw new Error(`Media scan returned ${response.status}`);
    const payload = await response.json();
    const existingByPath = new Map(state.manifest.assets
      .filter((asset) => asset.relative_path)
      .map((asset) => [asset.relative_path.toLowerCase(), asset]));
    const existingByName = new Map(state.manifest.assets
      .filter((asset) => asset.relative_path)
      .map((asset) => [asset.name.toLowerCase(), asset]));
    const discovered = [];
    let updated = 0;

    for (const item of payload.assets || []) {
      const key = item.relative_path.toLowerCase();
      const existing = existingByPath.get(key);
      if (existing) {
        const changed = existing.source_modified_ms !== item.modified_ms;
        existing.source_modified_ms = item.modified_ms;
        existing.source_size_bytes = item.size_bytes;
        existing.type = item.type;
        if (item.type === "gif") existing.animation_policy ||= "loop_to_timeline";
        if (changed) {
          const objectUrl = state.objectUrls.get(existing.id);
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          state.objectUrls.delete(existing.id);
          updated++;
        }
        continue;
      }
      if (existingByName.has(item.name.toLowerCase())) continue;

      const asset = {
        id: uniqueScannedAssetId(item.id),
        name: item.name,
        relative_path: item.relative_path,
        type: item.type,
        source_modified_ms: item.modified_ms,
        source_size_bytes: item.size_bytes,
        origin: "server-scan",
        ...(item.type === "gif" ? { animation_policy: "loop_to_timeline" } : {}),
      };
      discovered.push(asset);
      existingByPath.set(key, asset);
      existingByName.set(item.name.toLowerCase(), asset);
    }

    if (discovered.length) state.manifest.assets.unshift(...discovered);
    if (discovered.length || updated) {
      renderAssets();
      updateProgramMonitor(song.currentTime, activeCaptionAt(song.currentTime), updated > 0);
    }
    if (discovered.length) dirty(`${discovered.length} new image${discovered.length === 1 ? "" : "s"} discovered`);

    const checkedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (discovered.length || updated || manual) {
      const changes = [
        discovered.length ? `${discovered.length} new` : "",
        updated ? `${updated} updated` : "",
      ].filter(Boolean).join(" • ") || "Up to date";
      setAssetRefreshStatus(`${changes} • checked ${checkedAt}`);
    }
  } catch (error) {
    console.warn("Project media refresh unavailable", error);
    setAssetRefreshStatus("Could not scan images. Restart with start-editor.ps1 or use + project folder.", true);
  } finally {
    state.assetRefreshInFlight = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = "↻ Refresh";
  }
}

function startAssetRefresh() {
  if (state.assetRefreshTimer) window.clearInterval(state.assetRefreshTimer);
  state.assetRefreshTimer = window.setInterval(() => {
    if (document.visibilityState === "visible" && state.mediaTab === "library") refreshProjectAssets();
  }, 15000);
}

async function sha256(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadMusicFile(file) {
  if (!file) return;
  setStatus(`Loading ${file.name}…`);
  if (state.musicObjectUrl) URL.revokeObjectURL(state.musicObjectUrl);
  state.musicObjectUrl = URL.createObjectURL(file);
  song.pause(); song.src = state.musicObjectUrl; song.load();
  try {
    await new Promise((resolve, reject) => {
      song.addEventListener("loadedmetadata", resolve, { once: true });
      song.addEventListener("error", () => reject(new Error("The selected music file could not be decoded by this browser.")), { once: true });
    });
    const digest = await sha256(file);
    state.manifest.soundtrack = {
      ...state.manifest.soundtrack,
      relative_path: file.name,
      source_name: file.name,
      duration_seconds: song.duration,
      sha256: digest,
      locked: true,
      audio_policy: "stream-copy-only",
      loaded_in_editor: true,
    };
    state.waveform = null; state.currentVisualId = null; song.currentTime = 0;
    byId("music-file-label").textContent = file.name;
    byId("total-clock").value = clock(duration());
    dirty(`Loaded ${file.name} • keep it in the project root for assembly`);
    renderAll(); await loadWaveform(file);
  } catch (error) { setStatus(error.message, true); }
}

function serializableManifest() {
  const copy = structuredClone(state.manifest);
  copy.captions.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  copy.visuals.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  copy.editor = { ...copy.editor, last_saved_at: new Date().toISOString(), saved_by: "Music Video Timeline Desk" };
  return copy;
}

function manifestFilename() {
  const slug = String(state.manifest.project_id || "music-video")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "music-video";
  return `${slug}-timeline.json`;
}

function validateForSave(payload) {
  const errors = [];
  const assetIds = new Set(payload.assets.map((asset) => asset.id));
  const captionIds = new Set(payload.captions.map((cue) => cue.id));
  if (!payload.soundtrack.locked || payload.soundtrack.audio_policy !== "stream-copy-only" || !payload.soundtrack.sha256) errors.push("The soundtrack lock or fingerprint is missing");
  for (const asset of payload.assets) {
    if (!["image", "gif", "video"].includes(asset.type)) errors.push(`${asset.id} has an unsupported media type`);
    if (asset.type === "gif" && asset.animation_policy !== "loop_to_timeline") errors.push(`${asset.id} is missing its GIF loop policy`);
  }
  let previousStart = -1;
  for (const cue of payload.captions) {
    if (!cue.text.trim() || cue.start < 0 || cue.end <= cue.start || cue.end > payload.soundtrack.duration_seconds) errors.push(`${cue.id} has invalid text or timing`);
    if (cue.start < previousStart) errors.push(`${cue.id} is out of chronological order`);
    previousStart = cue.start;
  }
  for (const visual of payload.visuals) {
    const asset = payload.assets.find((item) => item.id === visual.asset_id);
    if (!assetIds.has(visual.asset_id)) errors.push(`${visual.id} has no asset`);
    else if (!asset.relative_path) errors.push(`${visual.id} uses ${asset.name}, which has no saved project-relative path`);
    if (visual.caption_id != null && !captionIds.has(visual.caption_id)) errors.push(`${visual.id} references missing caption ${visual.caption_id}`);
    if (visual.start < 0 || visual.end <= visual.start || visual.end > payload.soundtrack.duration_seconds + .001) errors.push(`${visual.id} has invalid timing`);
    if (asset?.type === "video" && visual.source_out != null && visual.source_out <= Number(visual.source_in || 0)) errors.push(`${visual.id} has an invalid video source range`);
  }
  return errors;
}

async function saveManifest() {
  const payload = serializableManifest();
  const errors = validateForSave(payload);
  if (errors.length) { setStatus(`Cannot save: ${errors[0]}`, true); return; }
  const text = JSON.stringify(payload, null, 2) + "\n";
  const filename = manifestFilename();
  try {
    if ("showSaveFilePicker" in window) {
      state.saveHandle ||= await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: "Timeline JSON", accept: { "application/json": [".json"] } }] });
      const writable = await state.saveHandle.createWritable(); await writable.write(text); await writable.close();
      setStatus("Saved editable timeline manifest");
    } else throw new Error("File System Access API unavailable");
  } catch (error) {
    if (error.name === "AbortError") return;
    const blob = new Blob([text], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href);
    setStatus("Downloaded timeline JSON — move it into this project before assembly");
  }
}

async function openManifest(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (payload.schema !== "music-video-timeline/v1" || !payload.soundtrack?.locked) throw new Error("This is not a locked music-video-timeline/v1 file.");
    normalizeAssetTypes(payload);
    payload.visuals = payload.visuals.map((visual) => ({ source_in: 0, source_out: null, ...visual }));
    const errors = validateForSave(payload);
    if (errors.length) throw new Error(errors[0]);
    state.manifest = payload; sortTimeline(); state.selectedCaptionId = payload.captions[0]?.id || null; state.saveHandle = null; state.currentVisualId = null; state.replacingVisualId = null; state.libraryMode = "replace";
    if (state.musicObjectUrl) { URL.revokeObjectURL(state.musicObjectUrl); state.musicObjectUrl = null; }
    song.src = `../${payload.soundtrack.relative_path}`; byId("total-clock").value = clock(duration());
    byId("music-file-label").textContent = payload.soundtrack.source_name || payload.soundtrack.relative_path.split("/").at(-1);
    renderAll(); setStatus(`Opened ${file.name}`); loadWaveform();
  } catch (error) { setStatus(error.message, true); }
}

function renderAll() { renderInspector(); renderCaptionTable(); renderAssets(); renderLinkedVisuals(); renderCueMediaManager(); switchMediaTab(state.mediaTab); resizeWaveform(); updatePlayhead(); }

function addCaption() {
  const start = clamp(song.currentTime, 0, duration() - .5);
  const highest = state.manifest.captions.reduce((value, cue) => Math.max(value, Number.parseInt(cue.id.replace(/\D/g, ""), 10) || 0), 0);
  const cue = { id: `C${String(highest + 1).padStart(3, "0")}`, section: "New cue", text: "New caption", start, end: Math.min(duration(), start + 1), confidence: 1, notes: "Added in Timeline Desk." };
  state.manifest.captions.push(cue); state.manifest.captions.sort((a, b) => a.start - b.start); dirty("Caption added"); selectCaption(cue.id, true);
}

function bindEvents() {
  byId("play-toggle").addEventListener("click", () => song.paused ? song.play() : song.pause());
  song.addEventListener("play", () => { byId("play-toggle").textContent = "❚❚"; byId("play-toggle").setAttribute("aria-label", "Pause"); cancelAnimationFrame(state.playbackFrame); playbackLoop(); });
  song.addEventListener("pause", () => { byId("play-toggle").textContent = "▶"; byId("play-toggle").setAttribute("aria-label", "Play"); cancelAnimationFrame(state.playbackFrame); programVideo.pause(); updatePlayhead(); });
  song.addEventListener("timeupdate", updatePlayhead);
  song.addEventListener("loadedmetadata", () => {
    byId("total-clock").value = clock(duration());
    if (state.pendingSeek !== null) applySeek(state.pendingSeek);
  });
  song.addEventListener("seeked", () => { updatePlayhead(); setStatus(`Positioned at ${clock(song.currentTime)}`); });
  song.addEventListener("error", () => setStatus("The soundtrack could not be loaded. Reopen the editor with start-editor.ps1 or choose Load Music.", true));
  programVideo.addEventListener("error", () => {
    const active = activeVisualAt(song.currentTime);
    const asset = active && assetById(active.asset_id);
    setStatus(`Could not preview ${asset?.name || "the current video"}. Confirm that the file still exists in the project folder.`, true);
  });
  byId("rewind").addEventListener("click", () => seekTo(song.currentTime - 5)); byId("forward").addEventListener("click", () => seekTo(song.currentTime + 5));
  waveform.addEventListener("click", (event) => { const rect = waveform.getBoundingClientRect(); seekTo((event.clientX - rect.left) / rect.width * duration()); });
  byId("caption-text").addEventListener("input", (event) => updateCaption("text", event.target.value));
  byId("caption-notes").addEventListener("input", (event) => updateCaption("notes", event.target.value));
  byId("caption-start").addEventListener("change", (event) => updateCaption("start", event.target.value));
  byId("caption-end").addEventListener("change", (event) => updateCaption("end", event.target.value));
  byId("set-in").addEventListener("click", () => setBoundary("start")); byId("set-out").addEventListener("click", () => setBoundary("end"));
  byId("jump-in").addEventListener("click", () => seekTo(currentCaption().start)); byId("jump-out").addEventListener("click", () => seekTo(currentCaption().end));
  byId("caption-filter").addEventListener("input", renderCaptionTable); byId("asset-filter").addEventListener("input", renderAssets);
  byId("add-caption").addEventListener("click", addCaption);
  byId("import-files").addEventListener("click", () => byId("asset-files-input").click()); byId("import-folder").addEventListener("click", () => byId("asset-folder-input").click());
  byId("asset-files-input").addEventListener("change", (event) => importFiles(event.target.files, false)); byId("asset-folder-input").addEventListener("change", (event) => importFiles(event.target.files, true));
  byId("cue-media-tab").addEventListener("click", () => switchMediaTab("cue"));
  byId("library-media-tab").addEventListener("click", openLibraryForReplacement);
  byId("refresh-assets").addEventListener("click", () => refreshProjectAssets({ manual: true }));
  byId("replace-program-visual").addEventListener("click", () => {
    const visual = activeVisualAt(song.currentTime);
    if (!visual) { setStatus("There is no visual under the playhead to replace.", true); return; }
    beginReplaceVisual(visual.id);
  });
  byId("add-from-library").addEventListener("click", openLibraryForNewBeat);
  byId("toggle-library-mode").addEventListener("click", () => {
    if (state.libraryMode === "replace") openLibraryForNewBeat();
    else openLibraryForReplacement();
  });
  byId("cancel-replace").addEventListener("click", () => switchMediaTab("cue"));
  byId("load-music").addEventListener("click", () => byId("music-input").click()); byId("music-input").addEventListener("change", (event) => loadMusicFile(event.target.files[0]));
  byId("save-manifest").addEventListener("click", saveManifest); byId("open-manifest").addEventListener("click", () => byId("manifest-input").click()); byId("manifest-input").addEventListener("change", (event) => event.target.files[0] && openManifest(event.target.files[0]));
  byId("follow-playhead").addEventListener("change", () => { if (byId("follow-playhead").checked) updatePlayhead(); });
  window.addEventListener("resize", resizeWaveform);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.mediaTab === "library") refreshProjectAssets();
  });
  window.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea")) return;
    if (event.code === "Space") { event.preventDefault(); song.paused ? song.play() : song.pause(); }
    if (event.key === "ArrowLeft") { event.preventDefault(); seekTo(song.currentTime - (event.shiftKey ? 1 : .1)); }
    if (event.key === "ArrowRight") { event.preventDefault(); seekTo(song.currentTime + (event.shiftKey ? 1 : .1)); }
    if (event.key === "[") { event.preventDefault(); setBoundary("start"); }
    if (event.key === "]") { event.preventDefault(); setBoundary("end"); }
  });
  startAssetRefresh();
}

async function init() {
  try {
    const response = await fetch("seed-manifest.json");
    if (!response.ok) throw new Error("Seed manifest could not be loaded.");
    state.manifest = await response.json(); state.selectedCaptionId = state.manifest.captions[0]?.id || null;
    normalizeAssetTypes(state.manifest);
    state.manifest.visuals = state.manifest.visuals.map((visual) => ({ source_in: 0, source_out: null, ...visual }));
    sortTimeline();
    const soundtrackPath = state.manifest.soundtrack.relative_path || "";
    if (soundtrackPath) song.src = `../${soundtrackPath}`;
    else song.removeAttribute("src");
    byId("music-file-label").textContent = state.manifest.soundtrack.source_name || soundtrackPath.split("/").at(-1) || "No song loaded";
    byId("total-clock").value = clock(soundtrackPath ? duration() : 0); bindEvents(); renderAll();
    if (soundtrackPath) loadWaveform(); else drawWaveform();
  } catch (error) {
    setStatus(`${error.message} Start the editor through the included local server.`, true);
  }
}

init();
