import { useCallback } from "react";
import { useRouter } from "expo-router";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export function usePostAuthNavigation() {
  const router = useRouter();

  return useCallback(async (userId: string | null | undefined) => {
    console.log("Post auth navigation invoked", { userId, isSupabaseConfigured });

    if (!userId) {
      console.log("Post auth navigation missing userId, routing to tabs");
      router.replace("/(tabs)");
      return;
    }

    if (isSupabaseConfigured) {
      try {
        console.log("Post auth checking profile existence", { userId });
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle();

        if (profileError) {
          console.error("Post auth profile lookup error", profileError);
          throw profileError;
        }

        if (!profileData) {
          console.log("Post auth no profile found, redirecting to onboarding");
          router.replace("/onboarding");
          return;
        }

        console.log("Post auth profile found, redirecting to tabs");
        router.replace("/(tabs)");
        return;
      } catch (lookupError) {
        console.error("Post auth navigation failed during profile check", lookupError);
      }
    }

    console.log("Post auth fallback routing to tabs");
    router.replace("/(tabs)");
  }, [router]);
}
