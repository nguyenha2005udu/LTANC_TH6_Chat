import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootRoutes } from '../navigation/types';
import type { Message, ReplyRef, WireMessage } from '../types';
import { useChat } from '../ChatContext';
import Clipboard from '@react-native-clipboard/clipboard';
import Avatar from '../components/Avatar';
import MessageBubble from '../components/MessageBubble';
import MessageMenu from '../components/MessageMenu';
import ImageViewer from '../components/ImageViewer';
import {
  pickImage,
  uploadImage,
  type PickedImage,
} from '../services/uploadService';
type PendingImage = {
  image: PickedImage;
  replyTo?: ReplyRef;
  status: 'uploading' | 'error';
  createdAt: number;
};
import { s } from './styles';
import {
  ensureDirect,
  markRead,
  newMessageKey,
  react,
  recallMessage,
  replyRefOf,
  RECALLED_TEXT,
  sendMessage,
  subscribeMessages,
  subscribeReadStatus,
  type MessageFeed,
  type OutgoingMessage,
} from '../services/chatService';
import { formatTime, lastSeenText } from '../services/summaries';
import { searchMessages, type SearchHit } from '../services/searchService';
import {
  createTypingController,
  setViewing as markViewing,
  subscribeLastSeen,
  subscribeTyping,
  subscribeViewers,
} from '../services/presenceService';
import { errorMessage } from '../services/firebase';
import { currentLocation } from '../services/location';
function copyText(message: Message) {
  if (message.type === 'location') {
    return `https://www.google.com/maps/search/?api=1&query=${message.lat},${message.lng}`;
  }
  return message.type === 'image' ? message.imageUrl || '' : message.text || '';
}
export default function DetailScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootRoutes, 'Detail'>) {
  const { uid, users, conversations, userChats, isOnline } = useChat();
  const { convId, peerId } = route.params;
  const conversation = conversations[convId];
  const group = conversation?.type === 'group';
  // Removed from (or left) a group: its data is no longer readable.
  const wasGroup = useRef(false);
  const removed =
    wasGroup.current && (!conversation || !conversation.members?.[uid]);
  if (group) {
    wasGroup.current = true;
  }
  useEffect(() => {
    if (removed) {
      Alert.alert('Thông báo', 'Bạn không còn là thành viên của nhóm này.');
      navigation.popToTop();
    }
  }, [removed, navigation]);
  const members = useMemo(
    () =>
      conversation
        ? Object.keys(conversation.members || {})
        : [uid, peerId || ''].filter(Boolean),
    [conversation, uid, peerId],
  );
  const peer = group ? undefined : peerId || members.find(m => m !== uid);
  const title = group
    ? conversation?.name || 'Nhóm'
    : users[peer || '']?.name || 'Người dùng';

  // A 1-1 chat opened from Contacts may not exist yet: create it first.
  const [ready, setReady] = useState(!!conversation);
  useEffect(() => {
    if (ready) {
      return;
    }
    if (conversation) {
      setReady(true);
      return;
    }
    if (!peerId) {
      return;
    }
    let active = true;
    ensureDirect(peerId)
      .then(() => active && setReady(true))
      .catch(e => active && Alert.alert('Lỗi', errorMessage(e)));
    return () => {
      active = false;
    };
  }, [ready, conversation, peerId]);

  const [raw, setRaw] = useState<Record<string, WireMessage>>({});
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const feed = useRef<MessageFeed | null>(null);
  useEffect(() => {
    if (!ready) {
      return;
    }
    setRaw({});
    const current = subscribeMessages(
      convId,
      (messages, more) => {
        setRaw(messages);
        setHasMore(more);
      },
      e => {
        if (!wasGroup.current) {
          Alert.alert('Lỗi', errorMessage(e));
        }
      },
    );
    feed.current = current;
    return () => {
      current.stop();
      feed.current = null;
    };
  }, [ready, convId]);

  // Typing indicator, read receipts and "last active" for the header.
  const [typingUids, setTypingUids] = useState<string[]>([]);
  const [reads, setReads] = useState<Record<string, number>>({});
  const [peerLastSeen, setPeerLastSeen] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const typing = useRef<ReturnType<typeof createTypingController> | null>(null);
  useEffect(() => {
    if (!ready) {
      return;
    }
    const fail = (e: Error) => {
      if (!wasGroup.current) {
        Alert.alert('Lỗi', errorMessage(e));
      }
    };
    // A failed typing write is not worth interrupting the user for.
    const controller = createTypingController(convId, uid, () => {});
    typing.current = controller;
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        controller.stop();
      }
    });
    const stops = [
      subscribeViewers(
        convId,
        uid,
        viewers => {
          viewersRef.current = viewers;
        },
        fail,
      ),
      subscribeTyping(convId, uid, setTypingUids, fail),
      subscribeReadStatus(convId, setReads, fail),
    ];
    return () => {
      controller.stop();
      typing.current = null;
      appState.remove();
      stops.forEach(stop => stop());
      setTypingUids([]);
      viewersRef.current = [];
    };
  }, [ready, convId, uid]);
  useEffect(() => {
    if (!peer || group) {
      return;
    }
    return subscribeLastSeen(peer, setPeerLastSeen, () => {});
  }, [peer, group]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  // Leaving the screen (back or another tab) clears my typing flag.
  useFocusEffect(useCallback(() => () => typing.current?.stop(), []));
  // While this chat is on screen (and the app is active) I am a "viewer":
  // others then do not send me a notification for new messages here.
  const viewersRef = useRef<string[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!ready) {
        return;
      }
      const sync = () => {
        markViewing(convId, uid, AppState.currentState === 'active').catch(
          () => {},
        );
      };
      sync();
      const listener = AppState.addEventListener('change', sync);
      return () => {
        listener.remove();
        markViewing(convId, uid, false).catch(() => {});
      };
    }, [ready, convId, uid]),
  );

  // Newest first: the list is inverted, so older pages are added at the top
  // without moving what the user is looking at.
  // Images being uploaded: shown as temporary bubbles under their reserved
  // message key, so the real message replaces them in place once sent.
  const [pending, setPending] = useState<Record<string, PendingImage>>({});
  const messages: Message[] = useMemo(() => {
    const local: Array<[string, Message]> = Object.entries(pending)
      .filter(([id]) => !raw[id])
      .map(([id, item]) => [
        id,
        {
          id,
          senderId: uid,
          type: 'image',
          createdAt: item.createdAt,
          mine: true,
          localUri: item.image.uri,
          pending: item.status,
        },
      ]);
    return [
      ...Object.entries(raw).map(([id, m]): [string, Message] => [
        id,
        { ...m, id, mine: m.senderId === uid },
      ]),
      ...local,
    ]
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .map(([, m]) => m);
  }, [raw, pending, uid]);
  const loadOlder = async () => {
    if (!hasMore || loadingOlder || !feed.current) {
      return;
    }
    setLoadingOlder(true);
    try {
      await feed.current.loadOlder();
    } finally {
      setLoadingOlder(false);
    }
  };

  const latestIncoming = messages.find(m => !m.mine)?.id;
  const unread = userChats[convId]?.unread || 0;
  useFocusEffect(
    useCallback(() => {
      const read = () => {
        if (
          ready &&
          AppState.currentState === 'active' &&
          (latestIncoming || unread > 0)
        ) {
          markRead(convId, unread > 0).catch(e =>
            Alert.alert('Lỗi', errorMessage(e)),
          );
        }
      };
      read();
      const listener = AppState.addEventListener('change', read);
      return () => listener.remove();
    }, [ready, latestIncoming, unread, convId]),
  );

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  // Reply/quote: the message chosen with "Trả lời" in the long-press menu.
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const send = async (body: OutgoingMessage) => {
    const replyTo = replyingTo ? replyRefOf(replyingTo) : undefined;
    await sendMessage(
      convId,
      members,
      body,
      undefined,
      viewersRef.current,
      replyTo,
    );
    setReplyingTo(current => (current?.id === replyTo?.id ? null : current));
  };
  const submit = async () => {
    if (!draft.trim() || busy || !ready) {
      return;
    }
    const text = draft;
    typing.current?.stop();
    setBusy(true);
    try {
      await send({ type: 'text', text });
      setDraft(current => (current === text ? '' : current));
    } catch (e) {
      Alert.alert('Không gửi được tin', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const upload = async (
    key: string,
    image: PickedImage,
    replyTo?: ReplyRef,
  ) => {
    setPending(old => ({
      ...old,
      [key]: {
        image,
        replyTo,
        status: 'uploading',
        createdAt: old[key]?.createdAt ?? Date.now(),
      },
    }));
    try {
      const imageUrl = await uploadImage(image);
      await sendMessage(
        convId,
        members,
        { type: 'image', imageUrl },
        key,
        viewersRef.current,
        replyTo,
      );
      setPending(old => {
        const next = { ...old };
        delete next[key];
        return next;
      });
    } catch (e) {
      setPending(old =>
        old[key] ? { ...old, [key]: { ...old[key], status: 'error' } } : old,
      );
      Alert.alert('Không gửi được ảnh', (e as Error).message);
    }
  };
  const choosePhoto = (source: 'camera' | 'library') => {
    const reply = replyingTo ? replyRefOf(replyingTo) : undefined;
    setReplyingTo(null);
    pickImage(source)
      .then(image => {
        if (image) {
          upload(newMessageKey(convId), image, reply);
        }
      })
      .catch(e =>
        Alert.alert(
          source === 'camera' ? 'Không mở được camera' : 'Không chọn được ảnh',
          (e as Error).message,
        ),
      );
  };
  const askPhoto = () => {
    if (!ready) {
      return;
    }
    Alert.alert('Gửi ảnh', undefined, [
      { text: 'Chụp ảnh', onPress: () => choosePhoto('camera') },
      { text: 'Chọn từ thư viện', onPress: () => choosePhoto('library') },
      { text: 'Hủy', style: 'cancel' },
    ]);
  };
  const retry = (message: Message) => {
    const item = pending[message.id];
    if (item) {
      upload(message.id, item.image, item.replyTo);
    }
  };
  const [viewing, setViewing] = useState<string | null>(null);

  const sendLocation = async () => {
    if (busy || !ready) {
      return;
    }
    setBusy(true);
    try {
      const { latitude, longitude } = await currentLocation();
      await send({ type: 'location', lat: latitude, lng: longitude });
    } catch (e) {
      Alert.alert('Không gửi được vị trí', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Tapping a quote scrolls to the original, loading older pages if needed.
  const list = useRef<FlatList<Message>>(null);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;
  const hasMoreRef = useRef(false);
  hasMoreRef.current = hasMore;
  const [highlight, setHighlight] = useState<string | null>(null);
  const jumpTo = async (id: string) => {
    const find = () => messagesRef.current.findIndex(m => m.id === id);
    let index = find();
    for (let page = 0; index < 0 && hasMoreRef.current && page < 15; page++) {
      if (!feed.current) {
        break;
      }
      setLoadingOlder(true);
      await feed.current.loadOlder();
      setLoadingOlder(false);
      // Let React render the new page before searching again.
      await new Promise<void>(resolve => setTimeout(resolve, 60));
      index = find();
    }
    if (index < 0) {
      Alert.alert('Không tìm thấy', 'Không tìm thấy tin nhắn gốc.');
      return;
    }
    list.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    setHighlight(id);
    setTimeout(
      () => setHighlight(current => (current === id ? null : current)),
      1600,
    );
  };
  const quoteOf = (message: Message) => {
    if (!message.replyTo) {
      return undefined;
    }
    const original = raw[message.replyTo.id];
    return {
      name:
        message.replyTo.senderId === uid
          ? 'Bạn'
          : users[message.replyTo.senderId]?.name || 'Thành viên',
      text: original?.recalled ? RECALLED_TEXT : message.replyTo.text,
    };
  };

  // Search message content in this conversation (🔍 in the header).
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!searchOpen || !ready || !term.trim()) {
      setHits([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchMessages(convId, term)
        .then(found => active && setHits(found))
        .catch(e => active && Alert.alert('Lỗi', errorMessage(e)))
        .finally(() => active && setSearching(false));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchOpen, ready, term, convId]);
  const closeSearch = () => {
    setSearchOpen(false);
    setTerm('');
  };

  const onlineOthers = members.filter(m => m !== uid && isOnline(m)).length;
  const typingNames = typingUids
    .filter(id => members.includes(id))
    .map(id => users[id]?.name || 'Ai đó');
  const status = typingNames.length
    ? group
      ? `${typingNames.join(', ')} đang soạn tin…`
      : 'đang soạn tin…'
    : group
    ? `${members.length} thành viên · ${onlineOthers} đang online`
    : isOnline(peer || '')
    ? 'Đang hoạt động'
    : lastSeenText(peerLastSeen, now);

  // Long-press menu: copy, recall (mine only) and reactions.
  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const toggleReaction = (message: Message, emoji: string) => {
    react(convId, message, emoji, message.reactions?.[uid]).catch(e =>
      Alert.alert('Không thả được cảm xúc', errorMessage(e)),
    );
  };
  const confirmRecall = (message: Message) => {
    Alert.alert('Thu hồi tin nhắn?', 'Tin nhắn sẽ được thu hồi ở mọi máy.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Thu hồi',
        style: 'destructive',
        onPress: () => {
          recallMessage(
            convId,
            message.id,
            members,
            userChats[convId]?.lastMessageId === message.id,
          ).catch(e => Alert.alert('Không thu hồi được', errorMessage(e)));
        },
      },
    ]);
  };

  // "Đã gửi" / "Đã xem" under my newest message, from readStatus in realtime.
  const lastMine = messages.find(m => m.mine && m.type !== 'system');
  let receipt = '';
  if (lastMine) {
    const seen = members.filter(
      m => m !== uid && (reads[m] || 0) >= lastMine.createdAt,
    );
    receipt = !seen.length
      ? 'Đã gửi'
      : group
      ? `Đã xem bởi ${seen.map(m => users[m]?.name || 'Thành viên').join(', ')}`
      : `Đã xem lúc ${formatTime(reads[seen[0]])}`;
  }

  return (
    <SafeAreaView style={s.page}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.detailHeader}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Text style={s.back}>‹</Text>
          </Pressable>
          <Pressable
            style={[s.flex, s.headerInfo]}
            disabled={!group}
            onPress={() => navigation.navigate('GroupInfo', { convId })}
            accessibilityRole={group ? 'button' : undefined}
            accessibilityHint={group ? 'Mở thông tin nhóm' : undefined}
          >
            <Avatar
              id={peer || convId}
              name={title}
              online={group ? onlineOthers > 0 : isOnline(peer || '')}
              group={group}
            />
            <View style={s.flex}>
              <Text style={s.name}>
                {title}
                {group ? '  ⓘ' : ''}
              </Text>
              <Text
                style={[s.status, typingNames.length > 0 && s.typing]}
                accessibilityLiveRegion="polite"
              >
                {status}
              </Text>
            </View>
          </Pressable>
          <Pressable
            disabled={!ready}
            onPress={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            accessibilityRole="button"
            accessibilityLabel="Tìm kiếm tin nhắn"
          >
            <Text style={s.headerIcon}>🔍</Text>
          </Pressable>
        </View>
        {searchOpen && (
          <View style={s.searchPanel}>
            <View style={s.searchRow}>
              <TextInput
                style={[s.searchInput, s.searchField]}
                value={term}
                onChangeText={setTerm}
                autoFocus
                placeholder="Tìm trong cuộc trò chuyện"
                placeholderTextColor="#9297A7"
                returnKeyType="search"
                accessibilityLabel="Nội dung cần tìm"
              />
              <Pressable onPress={closeSearch} accessibilityRole="button">
                <Text style={s.link}>Hủy</Text>
              </Pressable>
            </View>
            {!!term.trim() && (
              <FlatList
                style={s.searchResults}
                data={hits}
                keyExtractor={hit => hit.id}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  <Text style={s.searchCount}>
                    {searching ? 'Đang tìm…' : `${hits.length} kết quả`}
                  </Text>
                }
                renderItem={({ item: hit }) => {
                  const [start, end] = hit.match;
                  const from = Math.max(0, start - 30);
                  return (
                    <Pressable
                      style={s.searchHit}
                      onPress={() => {
                        closeSearch();
                        jumpTo(hit.id);
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={s.searchMeta}>
                        {hit.senderId === uid
                          ? 'Bạn'
                          : users[hit.senderId]?.name || 'Thành viên'}{' '}
                        · {formatTime(hit.createdAt)}
                      </Text>
                      <Text numberOfLines={2} style={s.searchText}>
                        {from > 0 ? '…' : ''}
                        {hit.text.slice(from, start)}
                        <Text style={s.searchMark}>
                          {hit.text.slice(start, end)}
                        </Text>
                        {hit.text.slice(end)}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        )}
        <FlatList
          ref={list}
          inverted
          onScrollToIndexFailed={info => {
            // Rows have different heights: jump near it, then retry exactly.
            list.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: false,
            });
            setTimeout(
              () =>
                list.current?.scrollToIndex({
                  index: info.index,
                  animated: true,
                  viewPosition: 0.5,
                }),
              150,
            );
          }}
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={s.messages}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.2}
          ListFooterComponent={
            loadingOlder ? (
              <ActivityIndicator style={s.olderLoader} />
            ) : !hasMore && ready ? (
              <Text style={s.date}>BẮT ĐẦU CUỘC TRÒ CHUYỆN</Text>
            ) : undefined
          }
          renderItem={({ item, index }) =>
            item.type === 'system' ? (
              <Text style={s.system}>{item.text}</Text>
            ) : (
              <MessageBubble
                message={item}
                senderName={
                  group &&
                  !item.mine &&
                  messages[index + 1]?.senderId !== item.senderId
                    ? users[item.senderId]?.name || 'Thành viên'
                    : undefined
                }
                quote={quoteOf(item)}
                highlighted={highlight === item.id}
                onPressQuote={message =>
                  message.replyTo && jumpTo(message.replyTo.id)
                }
                myReaction={item.reactions?.[uid]}
                receipt={item.id === lastMine?.id ? receipt : undefined}
                onLongPress={setMenuFor}
                onToggleReaction={toggleReaction}
                onOpenImage={setViewing}
                onRetry={retry}
              />
            )
          }
        />
        {replyingTo && (
          <View style={s.replyBar}>
            <View style={s.flex}>
              <Text style={s.replyTitle} numberOfLines={1}>
                Đang trả lời{' '}
                {replyingTo.mine
                  ? 'chính bạn'
                  : users[replyingTo.senderId]?.name || 'Thành viên'}
              </Text>
              <Text style={s.replyText} numberOfLines={1}>
                {replyRefOf(replyingTo).text}
              </Text>
            </View>
            <Pressable
              onPress={() => setReplyingTo(null)}
              accessibilityRole="button"
              accessibilityLabel="Hủy trả lời"
            >
              <Text style={s.replyClose}>✕</Text>
            </Pressable>
          </View>
        )}
        <View style={s.composer}>
          <Pressable
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="Gửi ảnh"
            onPress={askPhoto}
          >
            <Text style={s.back}>📷</Text>
          </Pressable>
          <Pressable
            disabled={busy || !ready}
            accessibilityLabel="Gửi vị trí"
            onPress={sendLocation}
          >
            <Text style={s.back}>📍</Text>
          </Pressable>
          <TextInput
            style={s.composeInput}
            multiline
            maxLength={2000}
            placeholder="Nhập tin nhắn…"
            placeholderTextColor="#9297A7"
            value={draft}
            onChangeText={text => {
              setDraft(text);
              typing.current?.keystroke(text);
            }}
            accessibilityLabel="Nội dung tin nhắn"
          />
          <Pressable
            style={[s.send, !draft.trim() && s.disabled]}
            disabled={busy || !ready || !draft.trim()}
            onPress={submit}
            accessibilityRole="button"
            accessibilityLabel="Gửi tin nhắn"
          >
            <Text style={s.buttonText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <ImageViewer uri={viewing} onClose={() => setViewing(null)} />
      <MessageMenu
        message={menuFor}
        myReaction={menuFor?.reactions?.[uid]}
        onClose={() => setMenuFor(null)}
        onReact={emoji => {
          if (menuFor) {
            toggleReaction(menuFor, emoji);
          }
          setMenuFor(null);
        }}
        onReply={() => {
          setReplyingTo(menuFor);
          setMenuFor(null);
        }}
        onCopy={() => {
          if (menuFor) {
            Clipboard.setString(copyText(menuFor));
          }
          setMenuFor(null);
        }}
        onRecall={() => {
          const target = menuFor;
          setMenuFor(null);
          if (target) {
            confirmRecall(target);
          }
        }}
      />
    </SafeAreaView>
  );
}
