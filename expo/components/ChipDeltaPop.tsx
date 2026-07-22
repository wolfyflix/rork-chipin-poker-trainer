import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

import colors from "@/constants/colors";
import { useGame } from "@/providers/GameProvider";

/** Animated +/- chip delta that floats up near the header on every gain/loss. */
export default function ChipDeltaPop() {
  const { delta } = useGame();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    if (!delta) return;
    opacity.setValue(0);
    translateY.setValue(6);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(translateY, { toValue: -26, duration: 1100, useNativeDriver: true }),
    ]).start();
  }, [delta, opacity, translateY]);

  if (!delta) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.pop, { opacity, transform: [{ translateY }] }]}>
      <Text style={[styles.text, { color: delta.amount > 0 ? colors.good : colors.red }]}>
        {delta.amount > 0 ? "+" : ""}
        {delta.amount}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pop: {
    position: "absolute",
    top: 64,
    right: 24,
    zIndex: 61,
  },
  text: {
    fontFamily: "Outfit_900Black",
    fontSize: 18,
  },
});
