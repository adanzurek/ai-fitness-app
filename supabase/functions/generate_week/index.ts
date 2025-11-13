// @ts-nocheck
// supabase/functions/generate_week/index.ts
// Deno-compatible. When type-checking locally (tsc --noEmit) we rely on @ts-nocheck
// and the npm supabase client to avoid missing-module errors. During deploy the
// Deno runtime will resolve `jsr:@supabase/supabase-js@2` automatically.
import { createClient } from "@supabase/supabase-js";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
Deno.serve(async (req)=>{
  try {
    const supabase = createSupabaseClient(req);
    // Parse input
    const body = await req.json().catch(()=>({}));
    const days = Math.max(1, Math.min(14, body.days ?? 7));
    // Resolve user
    const { data: auth } = await supabase.auth.getUser();
    const userId = body.user_id ?? auth?.user?.id;
    if (!userId) return json({
      error: "Missing user_id or auth"
    }, 401);
    // Dates
    const startDate = toISODate(body.start_date ?? new Date());
    const start = new Date(startDate);
    // 1) Goal
    const { data: goalRow } = await supabase.from("user_goal").select("goal_type").eq("user_id", userId).maybeSingle();
    const goal = goalRow?.goal_type ?? "unknown";
    // 2) Previous week volume to modulate this week
    const prevStart = addDays(start, -7);
    const prevEnd = addDays(start, -1);
    const { data: prev } = await supabase.from("workouts").select("target_volume, target_intensity, type, workout_date").eq("user_id", userId).gte("workout_date", toISODate(prevStart)).lte("workout_date", toISODate(prevEnd));
    const prevCount = prev?.length ?? 0;
    const prevAvgVol = prev && prev.length ? Math.round(prev.reduce((s, r)=>s + (r.target_volume ?? 0), 0) / prev.length) : 0;
    // Progressive modulation based on completion proxy (how many days logged last week)
    // You can refine once you add a completion/outcomes table.
    // Heuristic:
    // - 5–7 sessions logged -> +10% volume, +0.02 intensity (cap 0.85)
    // - 3–4 sessions -> keep
    // - 0–2 sessions -> -10% volume, -0.02 intensity (floor 0.55)
    let volFactor = 1.0;
    let intAdj = 0.0;
    if (prevCount >= 5) {
      volFactor = 1.1;
      intAdj = +0.02;
    } else if (prevCount <= 2) {
      volFactor = 0.9;
      intAdj = -0.02;
    }
    // 3) Weekly template by goal
    const pattern = patternFor(goal); // array of 7 "types" e.g., ["Push","Pull","Legs","Rest",...]
    const baseIntensity = baseIntensityFor(goal); // 0.65 hypertrophy, 0.8 strength, etc.
    const baseVolume = baseVolumeFor(goal); // target hard-set count per session
    // If we have historical average volume, blend a little
    const blendedBase = prevAvgVol > 0 ? Math.round((baseVolume * 0.7 + prevAvgVol * 0.3) * volFactor) : Math.round(baseVolume * volFactor);
    const planned = [];
    for(let i = 0; i < days; i++){
      const d = addDays(start, i);
      const dISO = toISODate(d);
      const type = pattern[i % pattern.length];
      // Skip inserting "Rest" by default; or store it with volume 0 if you want to show on calendar
      if (type === "Rest") {
        planned.push({
          workout_date: dISO,
          type,
          target_intensity: null,
          target_volume: 0,
          existed: true
        });
        continue;
      }
      const target_intensity = clamp(baseIntensity + intAdj, 0.55, 0.85);
      const target_volume = Math.max(6, Math.min(24, blendedBase));
      // Upsert: if a workout already exists for this day, don't create a duplicate
      const { data: existing, error: exErr } = await supabase.from("workouts").select("id").eq("user_id", userId).eq("workout_date", dISO).maybeSingle();
      if (exErr) throw exErr;
      if (existing?.id) {
        // Optional: update targets if you want to refresh the plan
        await supabase.from("workouts").update({
          type,
          target_intensity,
          target_volume,
          notes: "auto-generated (refresh)"
        }).eq("id", existing.id);
        planned.push({
          workout_date: dISO,
          type,
          target_intensity,
          target_volume,
          existed: true
        });
      } else {
        const { error: insErr } = await supabase.from("workouts").insert({
          user_id: userId,
          workout_date: dISO,
          type,
          target_intensity,
          target_volume,
          notes: "auto-generated"
        });
        if (insErr) throw insErr;
        planned.push({
          workout_date: dISO,
          type,
          target_intensity,
          target_volume,
          existed: false
        });
      }
    }
    const out = {
      user_id: userId,
      start_date: startDate,
      days,
      goal_type: goal,
      created: planned
    };
    return json(out);
  } catch (e) {
    console.error(e);
    return json({
      error: String(e?.message ?? e)
    }, 500);
  }
});
/* ---------------- helpers ---------------- */ function createSupabaseClient(req) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  return createClient(url, key, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? ""
      }
    }
  });
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
function toISODate(d) {
  const date = typeof d === "string" ? new Date(d) : d;
  const z = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  return z.toISOString().slice(0, 10);
}
function addDays(d, days) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function patternFor(goal) {
  switch(goal){
    case "strength":
      // lower frequency, more recovery
      return [
        "Push",
        "Pull",
        "Legs",
        "Rest",
        "Push",
        "Rest",
        "Legs"
      ];
    case "hypertrophy":
      // higher frequency PPLPPL + rest
      return [
        "Push",
        "Pull",
        "Legs",
        "Push",
        "Pull",
        "Legs",
        "Rest"
      ];
    case "endurance":
      // two strength days + conditioning focus
      return [
        "Conditioning",
        "Upper",
        "Conditioning",
        "Lower",
        "Conditioning",
        "Upper",
        "Rest"
      ];
    case "recomp":
      return [
        "Push",
        "Pull",
        "Legs",
        "Conditioning",
        "Upper",
        "Lower",
        "Rest"
      ];
    default:
      // safe default
      return [
        "Push",
        "Pull",
        "Legs",
        "Push",
        "Pull",
        "Legs",
        "Rest"
      ];
  }
}
function baseIntensityFor(goal) {
  switch(goal){
    case "strength":
      return 0.80;
    case "hypertrophy":
      return 0.65;
    case "endurance":
      return 0.60;
    case "recomp":
      return 0.70;
    default:
      return 0.70;
  }
}
function baseVolumeFor(goal) {
  switch(goal){
    case "strength":
      return 10; // hard sets per session
    case "hypertrophy":
      return 14;
    case "endurance":
      return 8;
    case "recomp":
      return 12;
    default:
      return 12;
  }
}
