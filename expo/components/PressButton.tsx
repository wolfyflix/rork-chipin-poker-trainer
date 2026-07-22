import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";

import colors from "@/constants/colors";

export type ButtonVariant = "primary" | "gold" | "ghost" | "fold" | "danger";

interface PressButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
  small?: boolean;
  testID?: string;
}

const VARIANTS: Record<ButtonVariant, { bg: string; text: string; shadow: string; border?: string }> = {
  primary: { bg: colors.mint, text: colors.mintInk, shadow: colors.mintDeep },
  gold: { bg: colors.gold, text: "#3B2A05", shadow: colors.goldDeep },
  ghost: { bg: "transparent", text: colors.muted, shadow: "transparent" },
  fold: { bg: "#352522", text: colors.red, shadow: "#1D110E", border: "rgba(228,87,61,0.3)" },
  danger: { bg: colors.red, text: "#FFF", shadow: "#8A2E1E" },
};

/** Duolingo-style "3D press" button — solid shadow underneath, depresses on tap. */
export default function PressButton({ label, onPress, variant = "primary", disabled = false, style, small = false, testID }: PressButtonProps) {
  const [pressed, setPressed] = useState<boolean>(false);
  const v = VARIANTS[variant];
  const isGhost = variant === "ghost";

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  }, [disabled, onPress]);

  const shadowHeight = isGhost ? 0 : pressed ? 1 : 5;

  const containerStyle = useMemo<ViewStyle>(
    () => ({
      backgroundColor: v.bg,
      borderRadius: 18,
      paddingVertical: small ? 12 : 16,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      transform: [{ translateY: pressed && !isGhost ? 4 : 0 }],
      borderWidth: v.border ? 1 : 0,
      borderColor: v.border,
      opacity: disabled ? 0.45 : 1,
    }),
    [v, pressed, isGhost, disabled, small],
  );

  const textStyle = useMemo<TextStyle>(
    () => ({
      color: v.text,
      fontSize: small ? 13.5 : 15.5,
      fontFamily: isGhost ? "Outfit_700Bold" : "Outfit_900Black",
      letterSpacing: 0.4,
      textTransform: isGhost ? "none" : "uppercase",
    }),
    [v, isGhost, small],
  );

  return (
    <View style={[!isGhost && { paddingBottom: 5 }, style]}>
      {!isGhost && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              top: shadowHeight === 1 ? 4 : 0,
              backgroundColor: disabled ? "#0A120D" : v.shadow,
              borderRadius: 18,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        />
      )}
      <Pressable
        testID={testID}
        onPress={handlePress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={disabled}
        style={containerStyle}
      >
        <Text style={textStyle}>{label}</Text>
      </Pressable>
    </View>
  );
}
