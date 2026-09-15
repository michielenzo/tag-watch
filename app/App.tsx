import React, { createContext, useContext, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Action,
  elapsed,
  formatTime,
  State,
  Stopwatch,
} from './src/stopwatches';
import { useStopwatches } from './src/useStopwatches';
import Popup from './src/Popup';

const BackgroundBlocked = createContext(false);

const palettes = {
  dark: {
    bg: '#101315',
    card: '#1B2023',
    border: '#30383C',
    text: '#F1F5F2',
    muted: '#A3AFAA',
    accent: '#BAEF72',
    onAccent: '#14220E',
    active: '#212D21',
    button: '#293135',
    danger: '#FFA8A2',
  },
  light: {
    bg: '#F1F3ED',
    card: '#FFFFFF',
    border: '#D5DDD1',
    text: '#202A23',
    muted: '#5D6B61',
    accent: '#436C23',
    onAccent: '#FFFFFF',
    active: '#EAF4DE',
    button: '#E8EDE5',
    danger: '#AB302F',
  },
};
type Palette = typeof palettes.dark;

function Button({
  label,
  onPress,
  colors,
  primary = false,
  disabled = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  colors: Palette;
  primary?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  const blocked = useContext(BackgroundBlocked);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || blocked }}
      disabled={disabled || blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? colors.accent : colors.button,
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          {
            color: primary
              ? colors === palettes.dark
                ? '#18230F'
                : '#FFFFFF'
              : danger
              ? colors.danger
              : colors.text,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Card({
  watch,
  state,
  now,
  colors,
  width,
  dispatch,
  confirm,
}: {
  watch: Stopwatch;
  state: State;
  now: number;
  colors: Palette;
  width: number;
  dispatch: (action: Action) => void;
  confirm: (type: 'reset' | 'delete', watch: Stopwatch) => void;
}) {
  const running = state.runningId === watch.id;
  const blocked = useContext(BackgroundBlocked);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(watch.name);
  const finish = () => {
    dispatch({ type: 'rename', id: watch.id, name });
    setEditing(false);
  };
  return (
    <View
      style={[
        styles.card,
        {
          width,
          backgroundColor: running ? colors.active : colors.card,
          borderColor: running ? colors.accent : colors.border,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.nameArea}>
          {editing ? (
            <TextInput
              editable={!blocked}
              autoFocus
              accessibilityLabel={`Rename ${watch.name}`}
              value={name}
              maxLength={80}
              onChangeText={setName}
              onBlur={finish}
              onSubmitEditing={finish}
              returnKeyType="done"
              selectTextOnFocus
              style={[
                styles.nameInput,
                { color: colors.text, borderColor: colors.accent },
              ]}
            />
          ) : (
            <Pressable
              disabled={blocked}
              accessibilityRole="button"
              accessibilityLabel={`Rename ${watch.name}`}
              accessibilityHint="Edit stopwatch name"
              onPress={() => {
                setName(watch.name);
                setEditing(true);
              }}
              style={styles.nameButton}
            >
              <Text
                numberOfLines={1}
                style={[styles.name, { color: colors.text }]}
              >
                {watch.name}
              </Text>
              <Text style={[styles.editIcon, { color: colors.muted }]}>✎</Text>
            </Pressable>
          )}
        </View>
        <View
          style={[
            styles.dot,
            { backgroundColor: running ? colors.accent : colors.muted },
          ]}
        />
      </View>
      <Text
        style={[styles.timer, { color: running ? colors.accent : colors.text }]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {formatTime(elapsed(watch, state, now))}
      </Text>
      <Text
        style={[
          styles.status,
          { color: running ? colors.accent : colors.muted },
        ]}
      >
        {running
          ? 'RUNNING'
          : watch.elapsedMs > 0
          ? 'PAUSED'
          : 'READY WHEN YOU ARE'}
      </Text>
      <View style={styles.cardActions}>
        <View style={styles.grow}>
          <Button
            colors={colors}
            primary
            label={
              running
                ? 'Ⅱ  Pause'
                : watch.elapsedMs > 0
                ? '▶  Resume'
                : '▶  Start'
            }
            onPress={() => dispatch({ type: 'toggle', id: watch.id })}
          />
        </View>
        <Button
          colors={colors}
          label="Reset"
          onPress={() => confirm('reset', watch)}
        />
        <Button
          colors={colors}
          label="Delete"
          disabled={state.watches.length === 1}
          onPress={() => confirm('delete', watch)}
        />
      </View>
    </View>
  );
}

function Content() {
  const {
    state,
    now,
    ready,
    loadError,
    saveError,
    dispatch,
    retryLoad,
    retrySave,
  } = useStopwatches();
  const colors = palettes[state.theme];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [confirmation, setConfirmation] = useState<{
    type: 'reset' | 'delete';
    watch: Stopwatch;
  } | null>(null);
  const available = Math.max(0, width - insets.left - insets.right - 32);
  const columns = Math.max(1, Math.floor((available + 12) / 322));
  const cardWidth = (available - (columns - 1) * 12) / columns;
  const active = state.watches.find(w => w.id === state.runningId);
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <BackgroundBlocked.Provider value={confirmation !== null}>
        <View
          style={styles.grow}
          pointerEvents={confirmation ? 'none' : 'auto'}
          accessibilityElementsHidden={confirmation !== null}
          importantForAccessibility={
            confirmation ? 'no-hide-descendants' : 'auto'
          }
        >
          <StatusBar
            barStyle={state.theme === 'dark' ? 'light-content' : 'dark-content'}
            backgroundColor={colors.bg}
          />
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.brand}>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>
                  tag-watch
                </Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  One thing at a time.
                </Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Button
                colors={colors}
                disabled={!ready}
                label={state.theme === 'dark' ? '☼  Light' : '☾  Dark'}
                onPress={() => dispatch({ type: 'theme' })}
              />
            </View>
          </View>
          {!ready ? (
            <View style={styles.center}>
              <Image
                source={
                  Platform.OS === 'windows'
                    ? require('./assets/tag-watch-source.json')
                    : require('./assets/tag-watch-preview.png')
                }
                style={styles.loadingLogo}
                resizeMode="contain"
                accessibilityLabel="tag-watch icon"
              />
              {loadError ? (
                <>
                  <Text style={[styles.message, { color: colors.text }]}>
                    Couldn’t load your stopwatches. Your saved data hasn’t been
                    changed.
                  </Text>
                  <Button
                    colors={colors}
                    label="Try again"
                    onPress={() => {
                      retryLoad();
                    }}
                  />
                </>
              ) : (
                <View style={styles.loadingStatus}>
                  <ActivityIndicator
                    accessibilityLabel="Loading stopwatches"
                    color={colors.accent}
                  />
                  <Text style={[styles.subtitle, { color: colors.muted }]}>
                    Loading your stopwatches…
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <>
              <View style={styles.toolbar}>
                <View style={styles.grow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Your stopwatches
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.muted }]}>
                    {state.watches.length} total ·{' '}
                    {active ? '1 running' : 'All paused'}
                  </Text>
                </View>
                <Button
                  colors={colors}
                  primary
                  label="+  Add stopwatch"
                  onPress={() => dispatch({ type: 'add' })}
                />
              </View>
              {saveError && (
                <View style={[styles.notice, { borderColor: colors.danger }]}>
                  <Text style={[styles.grow, { color: colors.danger }]}>
                    Changes couldn’t be saved. Keep the app open and retry.
                  </Text>
                  <Button
                    colors={colors}
                    label="Retry save"
                    onPress={retrySave}
                  />
                </View>
              )}
              <ScrollView
                style={styles.grow}
                contentContainerStyle={styles.grid}
                keyboardShouldPersistTaps="handled"
              >
                {state.watches.map(watch => (
                  <Card
                    key={watch.id}
                    watch={watch}
                    state={state}
                    now={now}
                    colors={colors}
                    width={cardWidth}
                    dispatch={dispatch}
                    confirm={(type, selected) =>
                      setConfirmation({ type, watch: selected })
                    }
                  />
                ))}
              </ScrollView>
              <View style={[styles.footer, { borderTopColor: colors.border }]}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: active ? colors.accent : colors.muted },
                  ]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.grow,
                    styles.subtitle,
                    { color: colors.muted },
                  ]}
                >
                  {active
                    ? `Focusing on ${active.name}`
                    : 'Start a stopwatch to find your focus.'}
                </Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  Tap a name to edit
                </Text>
              </View>
            </>
          )}
        </View>
      </BackgroundBlocked.Provider>
      {confirmation !== null && (
        <Popup onDismiss={() => setConfirmation(null)}>
          <View style={styles.overlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              accessible={false}
              focusable={false}
              onPress={() => setConfirmation(null)}
            />
            <View
              accessibilityViewIsModal
              style={[
                styles.dialog,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {confirmation?.type === 'delete'
                  ? 'Delete stopwatch?'
                  : 'Reset stopwatch?'}
              </Text>
              <Text style={[styles.message, { color: colors.muted }]}>
                {confirmation?.type === 'delete'
                  ? `“${confirmation.watch.name}” and its recorded time will be deleted.`
                  : `“${confirmation?.watch.name}” will be paused and set to 00:00:00.`}
              </Text>
              <View style={styles.dialogActions}>
                <Button
                  colors={colors}
                  label="Cancel"
                  onPress={() => setConfirmation(null)}
                />
                <Button
                  colors={colors}
                  danger
                  label={
                    confirmation?.type === 'delete'
                      ? 'Delete stopwatch'
                      : 'Reset stopwatch'
                  }
                  onPress={() => {
                    if (confirmation) {
                      dispatch({
                        type: confirmation.type,
                        id: confirmation.watch.id,
                      });
                    }
                    setConfirmation(null);
                  }}
                />
              </View>
            </View>
          </View>
        </Popup>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Content />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flex: 1 },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    gap: 12,
  },
  brand: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingLogo: { width: 144, height: 144 },
  loadingStatus: { alignItems: 'center', gap: 10 },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { fontSize: 12, lineHeight: 18 },
  toolbar: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: { padding: 16, borderRadius: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameArea: { flex: 1, minWidth: 0 },
  nameButton: {
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: { fontSize: 16, fontWeight: '600', flex: 1, minWidth: 0 },
  editIcon: { flexShrink: 0 },
  nameInput: { height: 44, padding: 4, fontSize: 16, borderBottomWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  timer: {
    fontSize: 44,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      windows: 'Consolas',
    }),
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.5,
    marginTop: 12,
  },
  status: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 3,
    marginBottom: 20,
  },
  cardActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  button: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 13, fontWeight: '700' },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  message: { fontSize: 15, lineHeight: 22, marginVertical: 16 },
  notice: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
  },
  dialogActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
