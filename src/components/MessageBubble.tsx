import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Message } from '../types';
import { s } from '../screens/styles';
import { formatTime } from '../services/summaries';
import { countReactions, RECALLED_TEXT } from '../services/chatService';

export default function MessageBubble({
  message,
  senderName,
  quote,
  highlighted,
  onPressQuote,
  myReaction,
  receipt,
  onLongPress,
  onToggleReaction,
  onOpenImage,
  onRetry,
}: {
  message: Message;
  /** Group chat: shown above other people's messages. */
  senderName?: string;
  /** Reply: who and what is quoted. */
  quote?: { name: string; text: string };
  /** Briefly tinted after jumping here from a quote. */
  highlighted?: boolean;
  onPressQuote?: (message: Message) => void;
  myReaction?: string;
  /** "Đã gửi" / "Đã xem", only for my newest message. */
  receipt?: string;
  onLongPress: (message: Message) => void;
  onToggleReaction: (message: Message, emoji: string) => void;
  onOpenImage: (uri: string) => void;
  onRetry: (message: Message) => void;
}) {
  const { mine } = message;
  const reactions = message.recalled ? [] : countReactions(message.reactions);
  let content: React.ReactNode;
  if (message.recalled) {
    content = (
      <Text
        style={[s.messageText, styles.recalled, mine && styles.recalledMine]}
      >
        {RECALLED_TEXT}
      </Text>
    );
  } else if (
    message.type === 'location' &&
    message.lat !== undefined &&
    message.lng !== undefined
  ) {
    const { lat, lng } = message;
    content = (
      <Pressable
        accessibilityRole="link"
        onLongPress={() => onLongPress(message)}
        onPress={() => {
          Linking.openURL(
            `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
          ).catch(() => Alert.alert('Lỗi', 'Không mở được Google Maps.'));
        }}
      >
        <Text style={[s.messageText, mine && s.white]}>📍 Vị trí hiện tại</Text>
        <Text style={[s.messageTime, mine && s.mineTime]}>
          {lat.toFixed(5)}, {lng.toFixed(5)} · Mở Google Maps ↗
        </Text>
      </Pressable>
    );
  } else if (message.type === 'image') {
    const uri = message.imageUrl || message.localUri;
    content = (
      <Pressable
        disabled={!uri || !!message.pending}
        onPress={() => uri && onOpenImage(uri)}
        onLongPress={() => onLongPress(message)}
        accessibilityRole="imagebutton"
        accessibilityLabel="Ảnh. Nhấn để xem toàn màn hình"
      >
        {!!uri && (
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        )}
        {message.pending === 'uploading' && (
          <View style={styles.overlay} accessibilityLabel="Đang tải ảnh lên">
            <ActivityIndicator color="#FFF" size="large" />
          </View>
        )}
        {message.pending === 'error' && (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>Tải ảnh lên thất bại</Text>
            <Pressable
              style={styles.retry}
              onPress={() => onRetry(message)}
              accessibilityRole="button"
              accessibilityLabel="Thử lại tải ảnh"
            >
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  } else {
    content = (
      <Text style={[s.messageText, mine && s.white]}>{message.text}</Text>
    );
  }
  return (
    <View
      style={[
        mine ? styles.rowMine : styles.rowTheirs,
        highlighted && styles.highlighted,
      ]}
    >
      {!!senderName && <Text style={styles.sender}>{senderName}</Text>}
      <Pressable
        disabled={message.recalled || !!message.pending}
        onLongPress={() => onLongPress(message)}
        delayLongPress={300}
        accessibilityHint="Nhấn giữ để sao chép, thu hồi hoặc thả cảm xúc"
        style={[
          s.message,
          mine ? s.mine : s.theirs,
          message.recalled && styles.recalledBubble,
          message.type === 'image' && !message.recalled && styles.imageBubble,
          reactions.length > 0 && styles.withReactions,
        ]}
      >
        {!!quote && !message.recalled && (
          <Pressable
            onPress={() => onPressQuote?.(message)}
            style={[styles.quote, mine && styles.quoteMine]}
            accessibilityRole="button"
            accessibilityLabel={`Trả lời ${quote.name}: ${quote.text}. Nhấn để xem tin gốc`}
          >
            <Text style={[styles.quoteName, mine && s.white]} numberOfLines={1}>
              ↩ {quote.name}
            </Text>
            <Text
              style={[styles.quoteText, mine && styles.quoteTextMine]}
              numberOfLines={2}
            >
              {quote.text}
            </Text>
          </Pressable>
        )}
        {content}
        <Text style={[s.messageTime, mine && !message.recalled && s.mineTime]}>
          {formatTime(message.createdAt)}
        </Text>
      </Pressable>
      {reactions.length > 0 && (
        <View style={[styles.reactions, mine && styles.reactionsMine]}>
          {reactions.map(({ emoji, count }) => (
            <Pressable
              key={emoji}
              onPress={() => onToggleReaction(message, emoji)}
              accessibilityRole="button"
              accessibilityLabel={`${emoji} ${count} người`}
              style={[styles.chip, myReaction === emoji && styles.chipMine]}
            >
              <Text style={styles.chipText}>
                {emoji}
                {count > 1 ? ` ${count}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {!!receipt && <Text style={s.receipt}>{receipt}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  imageBubble: { padding: 4 },
  highlighted: { backgroundColor: '#E5E1FF', borderRadius: 18 },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: '#6658E8',
    backgroundColor: '#F1F0FA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  quoteMine: {
    borderLeftColor: '#FFF',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  quoteName: { fontSize: 12, fontWeight: '700', color: '#6658E8' },
  quoteText: { fontSize: 13, color: '#60647B', marginTop: 2 },
  quoteTextMine: { color: '#E8E6FF' },
  sender: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6658E8',
    marginLeft: 12,
    marginTop: 8,
    marginBottom: -2,
  },
  image: {
    width: 220,
    height: 220,
    borderRadius: 14,
    backgroundColor: '#ECEEF5',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    backgroundColor: 'rgba(20, 20, 40, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  overlayText: { color: '#FFF', fontWeight: '600' },
  retry: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { color: '#6658E8', fontWeight: '700' },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  recalledBubble: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D9DCE8',
  },
  recalled: { color: '#9297A7', fontStyle: 'italic' },
  recalledMine: { color: '#9297A7' },
  withReactions: { marginBottom: 0 },
  reactions: {
    flexDirection: 'row',
    gap: 4,
    marginTop: -8,
    marginLeft: 10,
    marginBottom: 6,
  },
  reactionsMine: { marginLeft: 0, marginRight: 10 },
  chip: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#EAEBF2',
  },
  chipMine: { borderColor: '#6658E8', backgroundColor: '#EFEDFF' },
  chipText: { fontSize: 13, color: '#44465C' },
});
