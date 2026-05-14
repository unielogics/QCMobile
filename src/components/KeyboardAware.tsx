// Single source of truth for keyboard-avoiding behavior. Wraps the
// stock RN KeyboardAvoidingView and computes the right vertical
// offset for the tab bar + status bar so composers don't get hidden
// behind the on-screen keyboard.
//
// Before this, callers passed `keyboardVerticalOffset={0}` or
// nothing at all, which left the agent message composer covered by
// the 64px tab bar. Replace every raw `<KeyboardAvoidingView>` with
// `<KeyboardAware>` so we have ONE bug to fix if RN's behavior ever
// changes again.

import { type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  // Override the computed offset. Use when the wrapping screen is
  // outside the tab navigator (e.g. modal sheet, sign-in route).
  // Default = tab bar (64) + safe-area top inset on iOS.
  offset?: number;
  // Skip the tab bar offset (e.g. when the wrapping screen sits
  // ABOVE the tab navigator like /agent/loan/[id]).
  excludeTabBar?: boolean;
}

const TAB_BAR_HEIGHT = 64;

export function KeyboardAware({ children, style, offset, excludeTabBar = false }: Props) {
  const insets = useSafeAreaInsets();
  // iOS counts header + safe area in `padding` behavior; Android
  // counts everything in `height` behavior, so we feed it the tab
  // bar height directly. Without the tab-bar add-on the composer
  // sits behind the tab bar on Android even with `behavior=height`.
  const computed =
    offset !== undefined
      ? offset
      : Platform.OS === "ios"
        ? insets.top + (excludeTabBar ? 0 : 0)
        : excludeTabBar
          ? 0
          : TAB_BAR_HEIGHT;
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={computed}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
