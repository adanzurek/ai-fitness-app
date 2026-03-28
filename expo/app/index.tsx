import { Redirect, useRootNavigationState } from "expo-router";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Index() {
  const navigationState = useRootNavigationState();
  const insets = useSafeAreaInsets();

  if (!navigationState?.key) {
    return <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]} />;
  }

  return <Redirect href="/(tabs)/home" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
