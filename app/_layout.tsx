import 'react-native-url-polyfill/auto';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FitnessContext } from "@/contexts/FitnessContext";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { getSkipAuth, subscribeSkipAuth } from "@/lib/authSkip";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="signin" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
    </Stack>
  );
}

function SessionGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSupabaseUser();
  const segments = useSegments();
  const router = useRouter();
  const [skipAuth, setSkipAuthState] = useState<boolean>(getSkipAuth());

  useEffect(() => {
    const unsubscribe = subscribeSkipAuth(setSkipAuthState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (loading) return;

    const inTabsGroup = segments[0] === '(tabs)';

    if (!user && !skipAuth && inTabsGroup) {
      router.replace('/signin');
    } else if ((user || skipAuth) && !inTabsGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, skipAuth, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <FitnessContext>
        <GestureHandlerRootView>
          <SessionGate>
            <RootLayoutNav />
          </SessionGate>
        </GestureHandlerRootView>
      </FitnessContext>
    </QueryClientProvider>
  );
}
