import 'react-native-url-polyfill/auto';
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import Colors from "@/constants/colors";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ArrowLeft } from "lucide-react-native";
import { FitnessContext } from "@/contexts/FitnessContext";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { getSkipAuth, subscribeSkipAuth } from "@/lib/authSkip";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Profile } from "@/types/supabase";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type BackButtonProps = {
  tintColor?: string;
  canGoBack: boolean;
};

const BackButtonBase: React.FC<BackButtonProps> = ({ tintColor = "#FFFFFF", canGoBack }) => {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1));

  const handlePressIn = useCallback(() => {
    Animated.spring(scale.current, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 18,
      bounciness: 0,
    }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale.current, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, []);

  const handlePress = useCallback(() => {
    if (!canGoBack) {
      return;
    }
    router.back();
  }, [canGoBack, router]);

  if (!canGoBack) {
    return null;
  }

  return (
    <AnimatedPressable
      testID="header-back-button"
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[styles.backButton, { transform: [{ scale: scale.current }] }]}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <ArrowLeft color={tintColor} size={22} />
    </AnimatedPressable>
  );
};

const BackButton = React.memo(BackButtonBase);
BackButton.displayName = "HeaderBackButton";

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackVisible: false,
        headerLeft: (props) => (
          <BackButton tintColor={props.tintColor ?? "#FFFFFF"} canGoBack={Boolean(props.canGoBack)} />
        ),
        contentStyle: { backgroundColor: Colors.background },
        animation: "fade",
      }}
    >
      <Stack.Screen name="signin" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="day-view" options={{ headerShown: true }} />
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

  const profileQuery = useQuery<Profile | null>({
    queryKey: ["profile", user?.id ?? null],
    enabled: Boolean(user) && !skipAuth && isSupabaseConfigured,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ queryKey }) => {
      const [, userId] = queryKey as [string, string | null];
      if (!userId) {
        console.log('SessionGate profile query skipped: no user');
        return null;
      }

      console.log('SessionGate fetching profile for user', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('SessionGate profile query error', error);
        throw error;
      }

      console.log('SessionGate profile query completed', data ? 'profile found' : 'no profile');
      return (data as Profile | null) ?? null;
    },
  });

  const profileReady = useMemo(() => {
    if (!isSupabaseConfigured) {
      return true;
    }
    return profileQuery.isFetched || profileQuery.isError;
  }, [profileQuery.isError, profileQuery.isFetched]);

  const hasProfile = useMemo(() => {
    if (!isSupabaseConfigured) {
      return true;
    }
    return Boolean(profileQuery.data);
  }, [profileQuery.data]);

  useEffect(() => {
    if (loading) {
      console.log('SessionGate waiting for auth state...');
      return;
    }

    const currentSegment = segments[0] ?? '';
    const authRoutes = new Set(['signin', 'signup']);
    const isAuthRoute = authRoutes.has(currentSegment);
    const isOnboardingRoute = currentSegment === 'onboarding';
    const hasAccess = Boolean(user) || skipAuth;

    console.log('SessionGate navigation evaluation', {
      currentSegment,
      isAuthRoute,
      isOnboardingRoute,
      hasAccess,
      skipAuth,
      profileReady,
      profileStatus: {
        enabled: profileQuery.isEnabled,
        isFetched: profileQuery.isFetched,
        isFetching: profileQuery.isFetching,
        isError: profileQuery.isError,
        hasProfile,
      },
    });

    if (!hasAccess && !isAuthRoute) {
      console.log('SessionGate redirecting to signin');
      router.replace('/signin');
      return;
    }

    if (skipAuth) {
      if (isAuthRoute || isOnboardingRoute) {
        console.log('SessionGate skip auth redirecting to tabs');
        router.replace('/(tabs)');
      }
      return;
    }

    if (user) {
      if (!profileReady) {
        console.log('SessionGate waiting for profile readiness');
        return;
      }

      if (profileQuery.isError) {
        console.error('SessionGate profile error detected', profileQuery.error);
        if (!isOnboardingRoute && !isAuthRoute) {
          router.replace('/(tabs)');
        }
        return;
      }

      if (!hasProfile && !isOnboardingRoute) {
        console.log('SessionGate redirecting to onboarding');
        router.replace('/onboarding');
        return;
      }

      if (hasProfile && isAuthRoute) {
        console.log('SessionGate profile exists redirecting to tabs from auth route');
        router.replace('/(tabs)');
        return;
      }
    }

    if (hasAccess && isAuthRoute) {
      console.log('SessionGate auth route redirecting to tabs');
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, skipAuth, router, profileReady, hasProfile, profileQuery.isError, profileQuery.error, profileQuery.isFetched, profileQuery.isEnabled, profileQuery.isFetching]);

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

const styles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginLeft: 8,
  },
});
