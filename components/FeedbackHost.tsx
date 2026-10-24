import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFocusColors } from '../constants/design';
import { useThemeCustom } from '../hooks/theme-context';
import { feedbackStore } from '../services/AppFeedback';

export default function FeedbackHost() {
  const item = useSyncExternalStore(feedbackStore.subscribe, feedbackStore.current, () => null);
  const { theme } = useThemeCustom();
  const colors = getFocusColors(theme === 'dark');
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));
  const requiresAction = !!item?.buttons.some(button => button.onPress || button.style === 'cancel' || button.style === 'destructive') || (item?.buttons.length ?? 0) > 1;
  useEffect(() => {
    if (!item) return;
    AccessibilityInfo.announceForAccessibility([item.title, item.message].filter(Boolean).join('. '));
    opacity.setValue(0);
    let disposed = false;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!disposed) Animated.timing(opacity, { toValue: 1, duration: reduced ? 0 : 200, useNativeDriver: true }).start();
    });
    const timer = !requiresAction ? setTimeout(() => feedbackStore.dismiss(item.id), Math.min(12000, Math.max(4500, (item.title.length + (item.message?.length ?? 0)) * 55))) : undefined;
    return () => { disposed = true; clearTimeout(timer); opacity.stopAnimation(); };
  }, [item, requiresAction, opacity]);
  if (!item) return null;
  const dismiss = () => {
    if (requiresAction && !item.options?.cancelable) return;
    feedbackStore.dismiss(item.id);
    item.options?.onDismiss?.();
  };
  const danger = /erro|falha|não foi possível/i.test(item.title);
  const success = /sucesso|salvo|parabéns|concluíd/i.test(item.title);
  const accent = danger ? (theme === 'dark' ? '#ff9290' : '#B5221F') : success ? (theme === 'dark' ? '#65d995' : '#19733D') : (theme === 'dark' ? colors.blueDark : '#076B9D');
  const content = <Animated.View style={[styles.panel, { backgroundColor: colors.surface, opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
    <View style={styles.row}>
      <Ionicons name={danger ? 'alert-circle-outline' : success ? 'checkmark-circle-outline' : 'information-circle-outline'} size={25} color={accent} />
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        {!!item.message && <Text style={[styles.message, { color: colors.muted }]}>{item.message}</Text>}
      </View>
      {!requiresAction && <Pressable accessibilityRole="button" accessibilityLabel="Fechar mensagem" onPress={dismiss} style={styles.close}><Ionicons name="close" size={20} color={colors.muted} /></Pressable>}
    </View>
    {requiresAction && <View style={[styles.actions, { borderTopColor: colors.line }]}>{item.buttons.map((button, index) => <Pressable key={index} accessibilityRole="button" style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]} onPress={() => { feedbackStore.dismiss(item.id); button.onPress?.(); }}><Text style={[styles.actionText, { color: button.style === 'destructive' ? (theme === 'dark' ? '#ff9290' : '#B5221F') : button.style === 'cancel' ? colors.muted : theme === 'dark' ? colors.blueDark : '#076B9D' }]}>{button.text || 'OK'}</Text></Pressable>)}</View>}
  </Animated.View>;
  return requiresAction ? <Modal transparent visible animationType="fade" onRequestClose={dismiss} statusBarTranslucent><View style={styles.backdrop}><View style={styles.dialog}>{content}</View></View></Modal> : <View pointerEvents="box-none" style={[styles.overlay, { top: insets.top + 96 }]} accessibilityLiveRegion="polite">{content}</View>;
}
const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 10000, elevation: 20 },
  panel: { padding: 16, borderRadius: 16, width: '100%', maxWidth: 520, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  copy: { flex: 1, minWidth: 0 }, title: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  message: { fontSize: 14, lineHeight: 21, marginTop: 4 }, close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: -10, marginRight: -10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  action: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center' }, actionText: { fontSize: 15, fontWeight: '600' },
});
