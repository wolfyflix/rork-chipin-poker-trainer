import { Tabs } from "expo-router";
import { BookOpen, Spade, Target, User, Users, Zap } from "lucide-react-native";
import React from "react";

import colors from "@/constants/colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.mint,
        tabBarInactiveTintColor: colors.dim,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.line,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: "Outfit_800ExtraBold",
          fontSize: 10,
          letterSpacing: 0.5,
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "LEARN",
          tabBarIcon: ({ color }) => <BookOpen color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="arena"
        options={{
          title: "ARENA",
          tabBarIcon: ({ color }) => <Zap color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="table"
        options={{
          title: "TABLE",
          tabBarIcon: ({ color }) => <Spade color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "TOOLS",
          tabBarIcon: ({ color }) => <Target color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="squad"
        options={{
          title: "SQUAD",
          tabBarIcon: ({ color }) => <Users color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "ME",
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
