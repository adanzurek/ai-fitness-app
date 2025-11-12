// supabase/functions/generate_week/index.ts
// Deno-compatible, no local deps needed
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async (req) => {
  try {
    const supabase = createSupabaseClient(req);
    const body = await req.json().catch(() => ({}));

    // Resolve user context
    const { data: auth } = await supabase.auth.getUser();
    const userId = body.user_id ?? auth?.user?.id;
    if (!userId) {
      return json({ error: "Missing user_id or auth" }, 401);
    }

    const startDate = toISODate(body.start_date ?? new Date());
    const start = new Date(startDate);
    const trainingDays = clamp(Number(body.training_days ?? body.days ?? 7), 1, 14);
    const planId = body.plan_id ?? null;
    const experienceLevel = String(body.experience_level ?? "intermediate").toLowerCase();

    // Goal can come from payload or DB fallback
    const goalTextRaw = body.goal ? String(body.goal) : await fetchGoalLabel(supabase, userId);
    const goalKey = normalizeGoal(goalTextRaw);

    // Look at previous week to modulate targets
    const prevStart = addDays(start, -7);
    const prevEnd = addDays(start, -1);
    const { data: prev } = await supabase
      .from("workouts")
      .select("target_volume, target_intensity, type, workout_date")
      .eq("user_id", userId)
      .gte("workout_date", toISODate(prevStart))
      .lte("workout_date", toISODate(prevEnd));

    const prevCount = prev?.length ?? 0;
    const prevAvgVol = prev && prev.length ? Math.round(prev.reduce((s, r) => s + (r.target_volume ?? 0), 0) / prev.length) : 0;

    let volFactor = 1.0;
    let intAdj = 0.0;
    if (prevCount >= 5) {
      volFactor = 1.1;
      intAdj = 0.02;
    } else if (prevCount <= 2) {
      volFactor = 0.9;
      intAdj = -0.02;
    }

    const pattern = patternFor(goalKey, trainingDays);
    const baseIntensity = baseIntensityFor(goalKey, experienceLevel);
    const baseVolume = baseVolumeFor(goalKey, experienceLevel, trainingDays);
    const blendedBase = prevAvgVol > 0 ? Math.round((baseVolume * 0.7 + prevAvgVol * 0.3) * volFactor) : Math.round(baseVolume * volFactor);

    const planned: Record<string, unknown>[] = [];

    for (let i = 0; i < trainingDays; i++) {
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

      const existing = await supabase
        .from("workouts")
        .select("id")
        .eq("user_id", userId)
        .eq("workout_date", dISO)
        .maybeSingle();

      const workoutPayload: Record<string, unknown> = {
        user_id: userId,
        workout_date: dISO,
        type,
        target_intensity,
        target_volume,
        notes: planId ? `auto-generated (plan ${planId})` : "auto-generated",
        goal_type: goalKey,
        experience_level: experienceLevel,
      };

      if (planId) {
        workoutPayload.plan_id = planId;
      }

      if (existing.data?.id) {
        await supabase.from("workouts").update(workoutPayload).eq("id", existing.data.id);
        await syncSetsForWorkout(supabase, existing.data.id, type, experienceLevel);
        planned.push({
          workout_date: dISO,
          type,
          target_intensity,
          target_volume,
          existed: true,
        });
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("workouts")
          .insert(workoutPayload)
          .select("id")
          .maybeSingle();
        if (insErr) throw insErr;
        const workoutId = inserted?.id;
        if (workoutId) {
          await syncSetsForWorkout(supabase, workoutId, type, experienceLevel);
        }
        planned.push({
          workout_date: dISO,
          type,
          target_intensity,
          target_volume,
          existed: Boolean(workoutId),
        });
      }
    }

    return json({
      user_id: userId,
      start_date: startDate,
      days: trainingDays,
      goal_type: goalKey,
      experience_level: experienceLevel,
      plan_id: planId,
      created: planned,
    });
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
/* ---------------- helpers ---------------- */
function createSupabaseClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  return createClient(url, key, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders,
    },
  });
}

async function fetchGoalLabel(supabase: ReturnType<typeof createSupabaseClient>, userId: string) {
  const { data } = await supabase.from("user_goal").select("goal_type").eq("user_id", userId).maybeSingle();
  return data?.goal_type ?? "unknown";
}

function toISODate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  const z = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  return z.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function normalizeGoal(goal: string) {
  const g = goal.toLowerCase();
  if (g.includes("strength")) return "strength";
  if (g.includes("endurance")) return "endurance";
  if (g.includes("recomp")) return "recomp";
  if (g.includes("hypertrophy") || g.includes("muscle")) return "hypertrophy";
  return "general";
}

function patternFor(goal: string, days: number) {
  const base = (() => {
    switch (goal) {
      case "strength":
        return ["Push", "Pull", "Legs", "Rest", "Push", "Rest", "Legs"];
      case "hypertrophy":
        return ["Push", "Pull", "Legs", "Push", "Pull", "Legs", "Rest"];
      case "endurance":
        return ["Conditioning", "Upper", "Conditioning", "Lower", "Conditioning", "Upper", "Rest"];
      case "recomp":
        return ["Push", "Pull", "Legs", "Conditioning", "Upper", "Lower", "Rest"];
      default:
        return ["Push", "Pull", "Legs", "Push", "Pull", "Legs", "Rest"];
    }
  })();
  if (days === base.length) return base;
  const resized: string[] = [];
  for (let i = 0; i < days; i++) {
    resized.push(base[i % base.length]);
  }
  return resized;
}

function baseIntensityFor(goal: string, experience: string) {
  const base = (() => {
    switch (goal) {
      case "strength":
        return 0.8;
      case "hypertrophy":
        return 0.65;
      case "endurance":
        return 0.6;
      case "recomp":
        return 0.7;
      default:
        return 0.7;
    }
  })();
  if (experience === "beginner") return base - 0.05;
  if (experience === "advanced") return base + 0.05;
  return base;
}

function baseVolumeFor(goal: string, experience: string, trainingDays: number) {
  let base = 12;
  switch (goal) {
    case "strength":
      base = 10;
      break;
    case "hypertrophy":
      base = 14;
      break;
    case "endurance":
      base = 8;
      break;
    case "recomp":
      base = 12;
      break;
    default:
      base = 12;
  }
  if (experience === "beginner") base -= 2;
  if (experience === "advanced") base += 2;
  if (trainingDays >= 5) base += 1;
  if (trainingDays <= 3) base -= 1;
  return Math.max(6, base);
}

async function syncSetsForWorkout(
  supabase: ReturnType<typeof createSupabaseClient>,
  workoutId: string,
  block: string,
  experience: string,
) {
  const templates = setTemplatesFor(block, experience);
  if (!templates.length) return;
  await supabase.from("sets").delete().eq("workout_id", workoutId);
  const rows = templates.map((tpl) => ({
    workout_id: workoutId,
    movement: tpl.movement,
    target_sets: tpl.sets,
    target_reps: tpl.reps,
    target_rpe: tpl.rpe,
  }));
  const { error } = await supabase.from("sets").insert(rows);
  if (error) {
    console.warn("Failed to sync sets", error.message);
  }
}

function setTemplatesFor(block: string, experience: string) {
  const base = {
    Push: [
      { movement: "Barbell Bench Press", sets: experience === "advanced" ? 5 : 4, reps: 6, rpe: 8 },
      { movement: "Incline DB Press", sets: 3, reps: 10, rpe: 7 },
      { movement: "Dips", sets: 3, reps: 12, rpe: 7 },
    ],
    Pull: [
      { movement: "Deadlift", sets: experience === "beginner" ? 3 : 4, reps: 5, rpe: 8 },
      { movement: "Barbell Row", sets: 3, reps: 8, rpe: 7 },
      { movement: "Lat Pulldown", sets: 3, reps: 12, rpe: 7 },
    ],
    Legs: [
      { movement: "Back Squat", sets: 4, reps: 6, rpe: 8 },
      { movement: "Romanian Deadlift", sets: 3, reps: 10, rpe: 7 },
      { movement: "Leg Press", sets: 3, reps: 12, rpe: 7 },
    ],
    Upper: [
      { movement: "Bench Press", sets: 4, reps: 6, rpe: 8 },
      { movement: "Pull-ups", sets: 3, reps: 8, rpe: 8 },
      { movement: "Shoulder Press", sets: 3, reps: 10, rpe: 7 },
    ],
    Lower: [
      { movement: "Front Squat", sets: 4, reps: 6, rpe: 8 },
      { movement: "Lunges", sets: 3, reps: 12, rpe: 7 },
      { movement: "Calf Raises", sets: 3, reps: 15, rpe: 6 },
    ],
    Conditioning: [
      { movement: "Rowing", sets: 1, reps: 2000, rpe: 7 },
      { movement: "Bike", sets: 1, reps: 15, rpe: 7 },
    ],
    Rest: [],
  };
  return base[block] ?? [];
}
