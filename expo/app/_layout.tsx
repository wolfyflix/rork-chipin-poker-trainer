import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
  useFonts,
} from "@expo-google-fonts/outfit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import ChipDeltaPop from "@/components/ChipDeltaPop";
import PaywallSheet from "@/components/PaywallSheet";
import colors from "@/constants/colors";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { GameProvider } from "@/providers/GameProvider";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="lesson" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
      <Stack.Screen name="cheats" options={{ presentation: "modal" }} />
      <Stack.Screen name="auth" options={{ presentation: "fullScreenModal", gestureEnabled: false, animation: "slide_from_bottom" }} />
    </Stack>
  );
}

/** Shows a spinner while the auth session loads, then renders the app. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.mint} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <GameProvider>
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
              <StatusBar style="light" />
              <RootLayoutNav />
              <ChipDeltaPop />
              <PaywallSheet />
            </GestureHandlerRootView>
          </GameProvider>
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}
