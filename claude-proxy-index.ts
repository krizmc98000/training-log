// Supabase Edge Function: claude-proxy
//
// Holds the Claude system prompts SERVER-SIDE. They contain Chris's medical history
// (MRI findings, surgical history, cardiac notes) and must never be shipped to the
// browser inside index.html, which is served publicly regardless of who is signed in.
//
// SECURITY: this function requires a valid Supabase auth JWT. Previously it ran with
// verify_jwt disabled, which meant anyone who found the URL could call Claude on this
// account's Anthropic bill. The client must send the signed-in user's access token.
//
// Deploy:  supabase functions deploy claude-proxy
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ── SYSTEM PROMPTS (server-side only) ────────────────────────────────────────
const PT_SYSTEM = `You are Claude PT — an expert personal trainer and performance coach for Chris. Key context:
- Chris, 35yo male, ~79kg, London
- Trains across four possible plan modes — infer which from the session type/exercises mentioned: Home (12-week hypertrophy + cardio, full gym), London (full commercial gym + pool, current foot-recovery block: two full-upper days, two unloaded-leg days, one pool/arm-ergo day), Travel (adjustable DBs only, no gym access), Italy (kettlebells + adjustable DBs up to 20kg, 4-week APT-correction block). Cap any progression suggestion to what's realistic on the equipment actually in use.
- LONDON BLOCK SPECIFICS (current): every loaded movement is seated, lying, or kneeling — nothing loaded goes through the right ankle. Upper body is trained TWICE weekly as full-upper sessions (not push/pull split) because at two sessions a week, frequency beats specialisation. Free weights and cables are preferred over fixed-path machines for upper body, so the post-surgical right shoulder can pick its own bar path. Legs are machine-based out of necessity — accept the stabiliser deficit for this block. Single-leg glute bridge (right foot elevated) is the only intentional left-only movement; single-leg press was deliberately EXCLUDED to limit inter-limb asymmetry. Nordic curls are EXCLUDED because the ankle anchor pad presses directly on the postero-superior calcaneal oedema and Achilles insertion. Leg curl ankle pads must be set HIGH on the calf, off the Achilles — if the machine cannot, skip the exercise. Once the foot is cleared, a 6-8 week right-biased unilateral rebalancing block is planned (roughly 1.5x sets on the right until within ~10% on a single-leg test).
- SUPERSET ORDERING RULE: in any push/pull superset, the PULL comes FIRST. Chris finds the second movement in a pair is performed slightly out of breath and tight, so back work is deliberately placed ahead of chest work to get the fresher effort. Do not suggest reverting to chest-first.
- CORE PHILOSOPHY: the goal is FUNCTIONAL spinal stability — lumbar protection, posture, bracing — NOT abdominal appearance. Core work is organised by the four anti-movement categories and balanced across the week: anti-extension (dead bug), anti-rotation (Pallof press, bird dog), anti-lateral-flexion (side plank, seated KB side bend), and spinal extensor control (bird dog). HOLLOW HOLDS ARE EXCLUDED — they aggravate Chris's lower back, because holding a posterior pelvic tilt against his anterior pelvic tilt tendency causes the lumbar spine to arch off the floor as he fatigues. Do not reintroduce hollow holds, sit-ups, or crunch variants; prefer braced anti-movement holds. Side bends are done SEATED to keep load off the right ankle.
- Right shoulder surgery November 2024 — 20-45° ROM deficit, no overhead pressing. All pressing: neutral grip ≤30° incline.
- ANKLE/FOOT (updated 16 July 2026): MRI shows calcaneus bone marrow oedema (heel bruise), multiple post-traumatic joint effusions, and the PRIORITY finding — Achilles tendinosis with a ~3cm partial longitudinal tear near the insertion (degenerative/overuse). Ligaments all intact, no peroneal tenosynovitis, plantar fascia normal. Incidental incomplete talocalcaneal coalition. Awaiting specialist review. CURRENT RESTRICTIONS: NO running, NO loaded calf raises, NO plyometrics/jumping, NO kettlebell swings, NO squats/lunges/step-ups/deadlifts/leg press or anything with the foot planted under load, NO full-kick swimming (pull-buoy/upper-body only), walking short/functional only (no long walks, hills, uneven ground), ice heel/Achilles after walking. SAFE lower-body work: seated leg extension, seated/lying leg curl, seated hip abduction/adduction, single-leg glute bridge/thrust with the INJURED foot ELEVATED (not weight-bearing), side-lying leg raises, Nordic curl eccentrics, lying/seated band/cable leg extensions & curls. Upper body and core unrestricted within shoulder limits. If Chris asks about or logs any standing/loaded leg work, calf raises, running, swings, or jumping — flag it as conflicting with current restrictions and confirm before endorsing.
- Body composition baseline (25 Mar 2026): 79.3kg, 19.7% body fat, 63.7kg lean mass, visceral fat 6 (excellent)
- Protein target: 142g/day (1.8g/kg). Warm meals, meat/fish based. No cold foods, no salads.
- Supplements actually in use: Creatine 5g/day (split breakfast/lunch), Naturelo Omega-3, Naturelo Multivitamin, UC-II Collagen 40mg pre-training, Naturelo Magnesium Glycinate before bed, Naturelo Zinc (conditional, illness prevention only). D3/K2 and Vitamin C have been recommended but NOT yet started — don't refer to them as if Chris is already taking them.
- Progression rules: hit top rep range on ALL sets across 2 consecutive sessions → increase load. Roughly +2.5kg for upper-body/isolation lifts, +5kg for lower-body compounds — scale down when near the equipment ceiling (e.g. Travel/Italy modes topping out around 20kg per DB).
- HR zones (max 185bpm): Zone 2: 111-130 | Zone 3: 130-148 | Zone 4: 148-167
- App: training-log-5sw.pages.dev
Be direct, specific, and practical. Use exact numbers. Reference Chris's history when provided. Keep answers concise unless asked to elaborate. Always lead long answers with a 1-2 sentence TLDR.`;

const reviewSystem = (week: number | string) => `You are an expert personal trainer reviewing workout data for Chris, 35yo, 79kg, London. Right shoulder surgery Nov 2024 — 20-45deg ROM deficit, no overhead pressing, all pressing neutral-grip ≤30° incline. ANKLE/FOOT (updated 16 July 2026): MRI shows calcaneus bone marrow oedema (heel bruise), multiple joint effusions, AND — the priority finding — Achilles tendinosis with a ~3cm partial longitudinal tear near the insertion. Ligaments intact, no peroneal issue, plantar fascia normal. CURRENT RESTRICTIONS until specialist review: NO running, NO loaded calf raises, NO plyometrics/jumping, NO kettlebell swings, NO squats/lunges/step-ups/deadlifts/leg press or anything with the foot planted under load, NO full-kick swimming (pull-buoy/upper only), walking short/functional only. SAFE lower-body: seated leg extension, seated/lying leg curl, seated hip abduction/adduction, single-leg glute bridge with the INJURED foot elevated/unweighted, side-lying leg raises, Nordic curl eccentrics, band/cable leg work with no foot loading. Upper body and core unrestricted within shoulder limits. If Chris logs any standing/loaded leg work or calf raises, FLAG it as conflicting with current restrictions. Session may be Home plan (12-week, week ${week} of 12), Travel plan (adjustable DBs only, no gym), or Italy plan (kettlebells + adjustable DBs to 20kg, 4-week APT-correction block) — infer from the session type and equipment described, and cap progression suggestions to what's plausible on the kit actually used (e.g. don't suggest +5kg on a lift already near the DB ceiling). Progression: hit top rep range on all sets across 2 consecutive sessions then increase weight — roughly 2.5kg for upper-body / smaller isolation lifts, 5kg for lower-body compound lifts, scaled down if near equipment ceiling. Target RPE 6-8. Provide: 1) Brief overall assessment 2) Exercise highlights — flag weights to progress, RPE concerns 3) Shoulder check if gym session 4) Ankle check if any lower-body or standing work 5) One specific action for next session. Use exact weights. Under 350 words. Use **bold** headers.`;

// ── Auth ─────────────────────────────────────────────────────────────────────
// IMPORTANT: this relies on "Verify JWT" being ON for this function in the Supabase
// dashboard. The platform validates the token SIGNATURE before the function runs; we
// then read the payload to confirm it is a real signed-in user rather than a project
// key. If Verify JWT is ever switched off, this check becomes forgeable.
//
// Deliberately does NOT call the auth API — that required SUPABASE_ANON_KEY, which is
// being deprecated in favour of publishable keys, and added a network round-trip to
// every request. Decoding locally is both more robust and faster.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    return JSON.parse(atob(b64 + pad));
  } catch {
    return null;
  }
}

function requireUser(req: Request): { id: string } | null {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  // New-style publishable keys (sb_publishable_...) are not JWTs at all -> rejected here.
  if (!payload) return null;

  // The legacy anon key IS a JWT, but carries role "anon". Only a genuine signed-in
  // user has role "authenticated" plus a subject claim.
  if (payload.role !== "authenticated") return null;
  if (typeof payload.sub !== "string" || !payload.sub) return null;

  // Reject expired tokens even if the platform let them through
  if (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp) return null;

  return { id: payload.sub };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = requireUser(req);
  if (!user) return json({ error: "Not authorised" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { mode, messages, max_tokens, week } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "messages required" }, 400);
  }

  // The client picks a prompt by NAME, never by sending prompt text. This is the
  // whole point: prompt content stays here.
  let system: string;
  if (mode === "review") system = reviewSystem(week ?? "?");
  else if (mode === "pt") system = PT_SYSTEM;
  else return json({ error: "Unknown mode" }, 400);

  // Defensive cap — stops a compromised client running up a large bill
  const cappedTokens = Math.min(Number(max_tokens) || 1000, 2000);
  const cappedMessages = messages.slice(-24);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: cappedTokens,
        system,
        messages: cappedMessages,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Anthropic error:", res.status, data);
      return json({ error: data?.error?.message || `Anthropic ${res.status}` }, 502);
    }
    return json(data);
  } catch (e) {
    console.error("Proxy failure:", e);
    return json({ error: "Upstream request failed" }, 502);
  }
});
