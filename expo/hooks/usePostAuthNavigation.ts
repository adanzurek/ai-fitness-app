import { useCallback } from "react";
import { useRouter } from "expo-router";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export function usePostAuthNavigation() {
  const router = useRouter();

  return useCallback(async (userId: string | null | undefined) => {
    console.log("Post auth navigation invoked", { userId, isSupabaseConfigured });

    router.replace("/onboarding");

    if (!userId || !isSupabaseConfigured) {
      if (!userId) {
        console.log("Post auth navigation missing userId, showing onboarding as fallback");
      } else {
        console.log("Post auth onboarding without Supabase configuration");
      }
      return;
    }

    try {
      console.log("Post auth preloading profile for user", userId);
      await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
    } catch (lookupError) {
      console.error("Post auth profile preload error", lookupError);
    }
  }, [router]);
}
