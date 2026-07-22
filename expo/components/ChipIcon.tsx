import React from "react";
import { StyleSheet, View } from "react-native";

import colors from "@/constants/colors";

interface ChipIconProps {
  size?: number;
}

/** The red poker chip currency icon — dashed cream border on red. */
export default function ChipIcon({ size = 15 }: ChipIconProps) {
  const borderWidth = Math.max(2, size * 0.17);
  return (
    <View
      style={[
        styles.chip,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
        },
      ]}
      testID="chip-icon"
    />
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.chipRed,
    borderColor: colors.chipBorder,
    borderStyle: "dashed",
  },
});
