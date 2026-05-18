// Pricing engine cho tất cả modality (TEXT / IMAGE / VIDEO / AUDIO_TTS / AUDIO_STT / EMBEDDING).
// Giá trong DB lưu VND. Discount theo tier (%).

export type Modality = "TEXT" | "IMAGE" | "VIDEO" | "AUDIO_TTS" | "AUDIO_STT" | "EMBEDDING";

// === TEXT ===
export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function computeCost(
  inputTokens: number,
  outputTokens: number,
  inputPricePerMillion: number,
  outputPricePerMillion: number,
  discountPercent: number = 0,
) {
  const inputCost = (inputTokens / 1_000_000) * inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * outputPricePerMillion;
  const factor = 1 - discountPercent / 100;
  return (inputCost + outputCost) * factor;
}

// === IMAGE ===
export const IMAGE_SIZES = [
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1024x1792",
  "1792x1024",
  "768x1024",
  "1024x768",
  "576x1024",
  "1024x576",
] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

export const IMAGE_QUALITIES = ["low", "medium", "high", "auto", "1k", "2k", "3k"] as const;
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];

export type ImageMatrixRow = { size: string; quality: string; price: number };
export type ImagePricing = { matrix: ImageMatrixRow[] };

export function computeImageCost(
  data: ImagePricing,
  params: { size: string; quality: string; count: number },
  discountPercent = 0,
): { cost: number; matched: ImageMatrixRow | null } {
  const matched = data.matrix.find(
    (r) => r.size === params.size && r.quality === params.quality,
  );
  const unit = matched?.price ?? 0;
  const cost = unit * params.count * (1 - discountPercent / 100);
  return { cost, matched: matched ?? null };
}

// === VIDEO ===
export const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p", "4k"] as const;
export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number];

export const VIDEO_DURATIONS = ["6s", "8s", "10s", "12s", "15s", "25s"] as const;
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

export type VideoMatrixRow = { resolution: string; duration: string; price: number };
export type VideoPricing = { matrix: VideoMatrixRow[] };

export function computeVideoCost(
  data: VideoPricing,
  params: { resolution: string; duration: string },
  discountPercent = 0,
): { cost: number; matched: VideoMatrixRow | null } {
  const matched = data.matrix.find(
    (r) => r.resolution === params.resolution && r.duration === params.duration,
  );
  const unit = matched?.price ?? 0;
  const cost = unit * (1 - discountPercent / 100);
  return { cost, matched: matched ?? null };
}

// === AUDIO_TTS ===
export type TtsVoice = { id: string; name: string; gender?: string; preview?: string };
export type TtsPricing = { charRate: number; voices: TtsVoice[] };

export function computeTtsCost(
  data: { charRate: number },
  params: { chars: number },
  discountPercent = 0,
): number {
  return (params.chars / 1_000_000) * data.charRate * (1 - discountPercent / 100);
}

// === AUDIO_STT ===
export type SttPricing = { minuteRate: number; languages: string[] };

export function computeSttCost(
  data: { minuteRate: number },
  params: { seconds: number },
  discountPercent = 0,
): number {
  const minutes = params.seconds / 60;
  return minutes * data.minuteRate * (1 - discountPercent / 100);
}

// === Modality helpers ===
export const MODALITIES = ["TEXT", "EMBEDDING", "IMAGE", "VIDEO", "AUDIO_TTS", "AUDIO_STT"] as const;

export function isTextModality(m: string | null | undefined): boolean {
  return !m || m === "TEXT" || m === "EMBEDDING";
}

// Validate + normalize pricingData shape theo modality.
// Trả { ok: true, data } hoặc { ok: false, error }.
export function validatePricingData(
  modality: string,
  raw: any,
): { ok: true; data: any | null } | { ok: false; error: string } {
  if (modality === "TEXT" || modality === "EMBEDDING") {
    return { ok: true, data: null };
  }

  if (modality === "IMAGE") {
    if (!raw || !Array.isArray(raw.matrix)) {
      return { ok: false, error: "IMAGE pricingData cần { matrix: [...] }" };
    }
    const seen = new Set<string>();
    const matrix: ImageMatrixRow[] = [];
    for (const r of raw.matrix) {
      if (!r || typeof r.size !== "string" || typeof r.quality !== "string") {
        return { ok: false, error: "IMAGE matrix row cần size + quality (string)" };
      }
      const price = Number(r.price);
      if (!Number.isFinite(price) || price < 0) {
        return { ok: false, error: `IMAGE matrix row [${r.size} × ${r.quality}] giá không hợp lệ` };
      }
      const key = `${r.size}|${r.quality}`;
      if (seen.has(key)) {
        return { ok: false, error: `IMAGE matrix có row trùng (${r.size} × ${r.quality})` };
      }
      seen.add(key);
      matrix.push({ size: r.size, quality: r.quality, price });
    }
    return { ok: true, data: { matrix } };
  }

  if (modality === "VIDEO") {
    if (!raw || !Array.isArray(raw.matrix)) {
      return { ok: false, error: "VIDEO pricingData cần { matrix: [...] }" };
    }
    const seen = new Set<string>();
    const matrix: VideoMatrixRow[] = [];
    for (const r of raw.matrix) {
      if (!r || typeof r.resolution !== "string" || typeof r.duration !== "string") {
        return { ok: false, error: "VIDEO matrix row cần resolution + duration (string)" };
      }
      const price = Number(r.price);
      if (!Number.isFinite(price) || price < 0) {
        return { ok: false, error: `VIDEO matrix row [${r.resolution} × ${r.duration}] giá không hợp lệ` };
      }
      const key = `${r.resolution}|${r.duration}`;
      if (seen.has(key)) {
        return { ok: false, error: `VIDEO matrix có row trùng (${r.resolution} × ${r.duration})` };
      }
      seen.add(key);
      matrix.push({ resolution: r.resolution, duration: r.duration, price });
    }
    return { ok: true, data: { matrix } };
  }

  if (modality === "AUDIO_TTS") {
    if (!raw) return { ok: false, error: "AUDIO_TTS pricingData rỗng" };
    const charRate = Number(raw.charRate);
    if (!Number.isFinite(charRate) || charRate < 0) {
      return { ok: false, error: "AUDIO_TTS charRate không hợp lệ" };
    }
    const voicesRaw = Array.isArray(raw.voices) ? raw.voices : [];
    const seen = new Set<string>();
    const voices: TtsVoice[] = [];
    for (const v of voicesRaw) {
      if (!v || typeof v.id !== "string" || !v.id.trim()) {
        return { ok: false, error: "Voice cần id (string)" };
      }
      if (seen.has(v.id)) {
        return { ok: false, error: `Voice id trùng: ${v.id}` };
      }
      seen.add(v.id);
      const voice: TtsVoice = {
        id: String(v.id).trim(),
        name: typeof v.name === "string" && v.name.trim() ? v.name.trim() : v.id,
      };
      if (typeof v.gender === "string" && v.gender.trim()) voice.gender = v.gender.trim();
      if (typeof v.preview === "string" && v.preview.trim()) voice.preview = v.preview.trim();
      voices.push(voice);
    }
    return { ok: true, data: { charRate, voices } };
  }

  if (modality === "AUDIO_STT") {
    if (!raw) return { ok: false, error: "AUDIO_STT pricingData rỗng" };
    const minuteRate = Number(raw.minuteRate);
    if (!Number.isFinite(minuteRate) || minuteRate < 0) {
      return { ok: false, error: "AUDIO_STT minuteRate không hợp lệ" };
    }
    const langsRaw = Array.isArray(raw.languages) ? raw.languages : [];
    const languages: string[] = [];
    const seen = new Set<string>();
    for (const l of langsRaw) {
      if (typeof l !== "string") continue;
      const code = l.trim().toLowerCase();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      languages.push(code);
    }
    return { ok: true, data: { minuteRate, languages } };
  }

  return { ok: false, error: `Modality không hỗ trợ: ${modality}` };
}

// Preset voices OpenAI TTS
export const OPENAI_TTS_VOICES: TtsVoice[] = [
  { id: "alloy", name: "Alloy" },
  { id: "echo", name: "Echo" },
  { id: "fable", name: "Fable" },
  { id: "onyx", name: "Onyx" },
  { id: "nova", name: "Nova" },
  { id: "shimmer", name: "Shimmer" },
];

// Preset Whisper 99 langs (ISO 639-1)
export const WHISPER_LANGUAGES = [
  "af","ar","hy","az","be","bs","bg","ca","zh","hr","cs","da","nl","en","et","fi","fr","gl",
  "de","el","he","hi","hu","is","id","it","ja","kn","kk","ko","lv","lt","mk","ms","mr","mi",
  "ne","no","fa","pl","pt","ro","ru","sr","sk","sl","es","sw","sv","tl","ta","th","tr","uk",
  "ur","vi","cy","yi","yo","am","my","sn","gu","sd","su","ta","tt","tg","te","tk","uz","ba",
  "br","hr","fa","ka","si","sa","si","sm","ha","ht","la","lb","jw","mg","ml","mn","oc","ps",
  "lo","mt","so","ss","tn","ts","nso","ng",
] as const;
