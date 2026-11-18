import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Message } from '../types';
import { REACTIONS } from '../services/chatService';

/** Long-press menu: reactions, Trả lời, Sao chép, Thu hồi (my messages only). */
export default function MessageMenu({
  message,
  myReaction,
  onReact,
  onReply,
  onCopy,
  onRecall,
  onClose,
}: {
  message: Message | null;
  myReaction?: string;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onRecall: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={!!message}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Đóng menu"
      >
        <Pressable style={styles.sheet}>
          <View style={styles.emojis}>
            {REACTIONS.map(emoji => (
              <Pressable
                key={emoji}
                onPress={() => onReact(emoji)}
                accessibilityRole="button"
                accessibilityLabel={`Thả cảm xúc ${emoji}`}
                style={[styles.emoji, myReaction === emoji && styles.selected]}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={styles.action}
            onPress={onReply}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>Trả lời</Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={onCopy}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>Sao chép</Text>
          </Pressable>
          {message?.mine && (
            <Pressable
              style={styles.action}
              onPress={onRecall}
              accessibilityRole="button"
            >
              <Text style={[styles.actionText, styles.danger]}>Thu hồi</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.action}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={[styles.actionText, styles.cancel]}>Hủy</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 40, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  emojis: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  emoji: { padding: 8, borderRadius: 24 },
  selected: { backgroundColor: '#EFEDFF' },
  emojiText: { fontSize: 30 },
  action: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F2F7',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#242439',
    textAlign: 'center',
  },
  danger: { color: '#C53950' },
  cancel: { color: '#7E8297' },
});
