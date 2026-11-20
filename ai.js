// On-device AI for Iron Log.
// Coach: Qwen 2.5 via WebLLM (WebGPU). Photos: SmolVLM via Transformers.js.
// Both download open model weights from public Hugging Face repos once, then run offline from the browser cache.

const WEBLLM_URL = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm";
const TJS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1";

export const COACH_MODELS = {
  "3b":   { label: "Qwen 2.5 3B — smarter, about 2 GB", f16: "Qwen2.5-3B-Instruct-q4f16_1-MLC",   f32: "Qwen2.5-3B-Instruct-q4f32_1-MLC" },
  "1.5b": { label: "Qwen 2.5 1.5B — faster, about 1 GB", f16: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", f32: "Qwen2.5-1.5B-Instruct-q4f32_1-MLC" },
};
export const VISION_MODELS = {
  "500m": { label: "SmolVLM 500M — better, about 0.5 GB", id: "HuggingFaceTB/SmolVLM-500M-Instruct" },
  "256m": { label: "SmolVLM 256M — lighter, about 0.25 GB", id: "HuggingFaceTB/SmolVLM-256M-Instruct" },
};

let gpu = null;
export async function gpuInfo() {
  if (gpu) return gpu;
  try {
    if (!navigator.gpu) return (gpu = { ok: false });
    const a = await navigator.gpu.requestAdapter();
    gpu = a ? { ok: true, f16: a.features.has("shader-f16") } : { ok: false };
  } catch { gpu = { ok: false }; }
  return gpu;
}

let webllm = null;
async function lib() { return webllm || (webllm = await import(WEBLLM_URL)); }

function coachId(size, g) { const m = COACH_MODELS[size] || COACH_MODELS["3b"]; return g.f16 ? m.f16 : m.f32; }

let engine = null, engineId = null, enginePromise = null;
export function coachReady() { return !!engine; }

export async function isCoachCached(size) {
  try { const g = await gpuInfo(); if (!g.ok) return false; const w = await lib(); return await w.hasModelInCache(coachId(size, g)); }
  catch { return false; }
}

export async function loadCoach(size, onProgress) {
  const g = await gpuInfo();
  if (!g.ok) throw Object.assign(new Error("This phone's browser doesn't support WebGPU, which the coach needs."), { code: "no-webgpu" });
  const id = coachId(size, g);
  if (engine && engineId === id) return engine;
  if (enginePromise && engineId === id) return enginePromise;
  engineId = id;
  enginePromise = (async () => {
    const w = await lib();
    if (engine) { try { await engine.unload(); } catch {} engine = null; }
    const e = await w.CreateMLCEngine(id, {
      initProgressCallback: (p) => onProgress && onProgress(p.progress ?? 0, p.text || ""),
    });
    engine = e;
    return e;
  })();
  try { return await enginePromise; }
  catch (e) { enginePromise = null; engineId = null; throw e; }
}

export async function deleteCoach(size) {
  const g = await gpuInfo(); if (!g.ok) return;
  const w = await lib(); const id = coachId(size, g);
  if (engine && engineId === id) { try { await engine.unload(); } catch {} engine = null; engineId = null; enginePromise = null; }
  await w.deleteModelAllInfoInCache(id);
}

// Stream a chat completion. Returns the full text.
export async function chat(messages, { onText, signal, maxTokens = 600, temperature = 0.6 } = {}) {
  if (!engine) throw Object.assign(new Error("Coach not loaded"), { code: "not-loaded" });
  const stream = await engine.chat.completions.create({ messages, stream: true, temperature, max_tokens: maxTokens });
  let text = "";
  for await (const c of stream) {
    if (signal && signal.aborted) { try { engine.interruptGenerate(); } catch {} break; }
    const d = (c.choices && c.choices[0] && c.choices[0].delta && c.choices[0].delta.content) || "";
    if (d) { text += d; onText && onText(text); }
  }
  return text;
}

export function parseJson(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// ---------- vision ----------
let vis = null, visId = null, visPromise = null;
export function visionReady() { return !!vis; }

export async function loadVision(size, onProgress) {
  const m = VISION_MODELS[size] || VISION_MODELS["500m"];
  if (vis && visId === m.id) return vis;
  if (visPromise && visId === m.id) return visPromise;
  visId = m.id;
  visPromise = (async () => {
    const T = await import(TJS_URL);
    const g = await gpuInfo();
    const files = {};
    const progress_callback = (p) => {
      if (p.status === "progress" && p.total) {
        files[p.file] = [p.loaded, p.total];
        let l = 0, t = 0; for (const k in files) { l += files[k][0]; t += files[k][1]; }
        onProgress && onProgress(t ? l / t : 0, "Downloading photo model");
      }
    };
    const processor = await T.AutoProcessor.from_pretrained(m.id, { progress_callback });
    const model = await T.AutoModelForVision2Seq.from_pretrained(m.id, {
      dtype: { embed_tokens: g.ok && g.f16 ? "fp16" : "fp32", vision_encoder: "q4", decoder_model_merged: "q4" },
      device: g.ok ? "webgpu" : "wasm",
      progress_callback,
    });
    vis = { T, processor, model };
    return vis;
  })();
  try { return await visPromise; }
  catch (e) { visPromise = null; visId = null; throw e; }
}

async function shrink(blob, max = 1024) {
  try {
    const bmp = await createImageBitmap(blob);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(bmp, 0, 0, w, h);
    return await new Promise((r) => c.toBlob((b) => r(b || blob), "image/jpeg", 0.9));
  } catch { return blob; }
}

// Returns a plain-text list of foods and portions seen in the photo.
export async function describePhoto(blob) {
  if (!vis) throw Object.assign(new Error("Photo model not loaded"), { code: "not-loaded" });
  const { T, processor, model } = vis;
  const small = await shrink(blob);
  const url = URL.createObjectURL(small);
  try {
    const image = await T.load_image(url);
    const messages = [{ role: "user", content: [
      { type: "image" },
      { type: "text", text: "List every food and drink on this plate with an estimated portion size in grams. One item per line, like: grilled chicken breast - 180 g. Mention visible oil, butter or sauce." },
    ] }];
    const prompt = processor.apply_chat_template(messages, { add_generation_prompt: true });
    const inputs = await processor(prompt, [image], { do_image_splitting: false });
    const ids = await model.generate({ ...inputs, max_new_tokens: 220, do_sample: false, repetition_penalty: 1.15 });
    const out = processor.batch_decode(ids.slice(null, [inputs.input_ids.dims.at(-1), null]), { skip_special_tokens: true });
    return String(out[0] || "").replace(/^\s*Assistant:\s*/i, "").trim();
  } finally { URL.revokeObjectURL(url); }
}

export async function storageUsage() {
  try { const e = await navigator.storage.estimate(); return e; } catch { return null; }
}
export async function persistStorage() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch {}
  return false;
}
