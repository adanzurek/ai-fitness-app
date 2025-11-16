import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    router.replace("/(tabs)/home");
  }, [router]);

  return <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
