import React, { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import PressButton from "@/components/PressButton";
import colors from "@/constants/colors";
import { Card, isRedSuit, RANK_NAMES, SUITS } from "@/lib/poker";

interface CardPickerProps {
  visible: boolean;
  title: string;
  usedKeys: Set<number>;
  onPick: (card: Card) => void;
  onClose: () => void;
}

const RANKS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

/** Bottom-sheet card picker: rank grid + suit row; used cards disabled. */
export default function CardPicker({ visible, title, usedKeys, onPick, onClose }: CardPickerProps) {
  const [rank, setRank] = useState<number | null>(null);

  const handlePickSuit = useCallback(
    (s: number) => {
      if (rank == null) return;
      onPick({ r: rank, s });
      setRank(null);
    },
    [rank, onPick],
  );

  const handleClose = useCallback(() => {
    setRank(null);
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.rankGrid}>
          {RANKS.map((r) => {
            const allUsed = [0, 1, 2, 3].every((s) => usedKeys.has(r * 4 + s));
            const on = rank === r;
            return (
              <Pressable
                key={r}
                disabled={allUsed}
                onPress={() => setRank(r)}
                style={[styles.rankBtn, on && styles.rankOn, allUsed && styles.disabled]}
                testID={`rank-${r}`}
              >
                <Text style={[styles.rankText, on && styles.rankTextOn]}>{RANK_NAMES[r]}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.suitRow}>
          {[0, 1, 2, 3].map((s) => {
            const dis = rank == null || usedKeys.has(rank * 4 + s);
            return (
              <Pressable
                key={s}
                disabled={dis}
                onPress={() => handlePickSuit(s)}
                style={[styles.suitBtn, dis && styles.disabled]}
                testID={`suit-${s}`}
              >
                <Text style={[styles.suitText, { color: isRedSuit(s) ? "#FF6A50" : colors.cream }]}>
                  {SUITS[s]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <PressButton label="Cancel" variant="ghost" onPress={handleClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(3,8,5,0.6)" },
  sheet: {
    backgroundColor: "#101A13",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: colors.lineStrong,
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontFamily: "Outfit_900Black",
    fontSize: 16,
    marginBottom: 12,
    textAlign: "center",
    color: colors.mint2,
  },
  rankGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 12,
    justifyContent: "center",
  },
  rankBtn: {
    width: "12.5%",
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  rankOn: { backgroundColor: colors.mint, borderColor: colors.mint },
  rankText: { fontFamily: "Outfit_900Black", fontSize: 15, color: colors.cream },
  rankTextOn: { color: colors.mintInk },
  suitRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  suitBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  suitText: { fontFamily: "Outfit_900Black", fontSize: 21 },
  disabled: { opacity: 0.2 },
});
