import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogOut, ArrowLeft, User as UserIcon } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { supabase } from "@/lib/supabase";
import { setSkipAuth } from "@/lib/authSkip";

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useSupabaseUser();
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState<boolean>(false);

  const avatarUrl = useMemo(() => {
    const metadataUrl = user?.user_metadata?.avatar_url;
    if (typeof metadataUrl === "string" && metadataUrl.length > 0) {
      return metadataUrl;
    }
    return null;
  }, [user]);

  const displayName = useMemo(() => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name as string;
    }
    if (user?.email) {
      return user.email;
    }
    return "Guest";
  }, [user]);

  useEffect(() => {
    console.log("Profile screen mounted");
  }, []);

  const handleBack = () => {
    console.log("Navigating back from profile");
    router.back();
  };

  const handleSignOut = async () => {
    if (signingOut) {
      return;
    }
    console.log("Attempting sign out");
    setSigningOut(true);
    try {
      if (user) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      }
      setSkipAuth(false);
      router.replace("/signin");
    } catch (error) {
      console.error("Sign out failed", error);
      const message =
        error instanceof Error ? error.message : "Unable to sign out. Please try again.";
      Alert.alert("Sign out", message);
    } finally {
      setSigningOut(false);
    }
  };

  const initials = useMemo(() => {
    if (!displayName) {
      return "?";
    }
    const parts = displayName.trim().split(" ");
    if (parts.length === 0) {
      return "?";
    }
    const [first, second] = parts;
    if (first && second) {
      return `${first[0]}${second[0]}`.toUpperCase();
    }
    return first[0]?.toUpperCase() ?? "?";
  }, [displayName]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          testID="profile-back-button"
        >
          <ArrowLeft color={Colors.text} size={20} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="profile-scroll"
      >
        <LinearGradient
          colors={[Colors.cardBackground, "#2B0D0D"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarWrapper}
        >
          <View style={styles.avatarCircle}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <Text style={styles.avatarInitials}>{initials}</Text>
            )}
          </View>
          {!avatarUrl && (
            <View style={styles.avatarHint}>
              <UserIcon color={Colors.textSecondary} size={20} />
              <Text style={styles.avatarHintText}>Connect Google to sync your photo</Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.identityBlock}>
          <Text style={styles.nameText}>{displayName}</Text>
          <Text style={styles.emailText}>{user?.email ?? "Signed in as guest"}</Text>
          {user?.app_metadata?.provider ? (
            <Text style={styles.providerText}>
              Provider: {String(user.app_metadata.provider).toUpperCase()}
            </Text>
          ) : (
            <Text style={styles.providerText}>Provider: GUEST</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Pressable
            onPress={handleSignOut}
            disabled={signingOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutButtonPressed,
              signingOut && styles.signOutButtonDisabled,
            ]}
            testID="sign-out-button"
          >
            {signingOut ? (
              <ActivityIndicator color={Colors.text} />
            ) : (
              <View style={styles.signOutContent}>
                <LogOut color={Colors.text} size={20} />
                <Text style={styles.signOutText}>Sign out</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Sync</Text>
          <Text style={styles.sectionBody}>
            Your profile picture will sync with your Google account once you connect. For now we display a
            default badge.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.cardBackground,
  },
  iconButtonPressed: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primary,
  },
  iconButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  content: {
    paddingBottom: 48,
    gap: 32,
  },
  avatarWrapper: {
    borderRadius: 28,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.cardBackground,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  avatarImage: {
    width: 120,
    height: 120,
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  avatarHint: {
    marginTop: 16,
    alignItems: "center",
    gap: 6,
  },
  avatarHintText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  identityBlock: {
    alignItems: "center",
    gap: 8,
  },
  nameText: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  emailText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  providerText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  section: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000000",
    shadowOpacity: Platform.OS === "ios" ? 0.2 : 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  signOutButton: {
    borderRadius: 20,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutButtonPressed: {
    backgroundColor: Colors.primaryDark,
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  signOutContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
  },
});
