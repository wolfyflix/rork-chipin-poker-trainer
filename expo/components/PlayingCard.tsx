import React from "react";
import { StyleSheet, Text, View } from "react-native";

import colors from "@/constants/colors";
import { Card, isRedSuit, RANK_NAMES, SUITS } from "@/lib/poker";

export type CardSize = "tiny" | "mini" | "small" | "big";

interface PlayingCardProps {
  card: Card;
  size?: CardSize;
  highlighted?: boolean;
}

const DIMS: Record<CardSize, { w: number; h: number; r: number; rank: number; suit: number; radius: number }> = {
  tiny: { w: 30, h: 42, r: 6, rank: 13, suit: 11, radius: 6 },
  mini: { w: 52, h: 74, r: 8, rank: 19, suit: 17, radius: 8 },
  small: { w: 50, h: 70, r: 8, rank: 18, suit: 16, radius: 8 },
  big: { w: 62, h: 86, r: 10, rank: 22, suit: 20, radius: 10 },
};

/** A face-up playing card. */
export default function PlayingCard({ card, size = "mini", highlighted = false }: PlayingCardProps) {
  const d = DIMS[size];
  const color = isRedSuit(card.s) ? colors.cardRed : colors.cardBlack;
  return (
    <View
      style={[
        styles.face,
        { width: d.w, height: d.h, borderRadius: d.radius },
        highlighted && styles.highlight,
      ]}
    >
      <Text style={[styles.rank, { fontSize: d.rank, color }]}>{RANK_NAMES[card.r]}</Text>
      <Text style={[styles.suit, { fontSize: d.suit, color }]}>{SUITS[card.s]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    backgroundColor: colors.cardFace,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  highlight: {
    borderWidth: 2,
    borderColor: colors.mint,
  },
  rank: {
    fontFamily: "Outfit_900Black",
    lineHeight: undefined,
  },
  suit: {
    fontFamily: "Outfit_900Black",
    marginTop: -2,
  },
});
