/**
 * @format
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ActivityIndicator, Image, Platform, TextInput } from 'react-native';
import App from '../App';
import { readState } from '../src/persistence';

jest.mock('../src/lifecycle', () => ({ onClose: () => () => {} }));

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../src/persistence', () => ({
  readState: jest.fn().mockResolvedValue(null),
  createWriter: () => jest.fn().mockResolvedValue(true),
}));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('shows the app icon in the loading screen with a spinner', async () => {
  jest.mocked(readState).mockImplementationOnce(() => new Promise(() => {}));
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(<App />);
  });
  expect(app.root.findAllByType(Image)).toHaveLength(1);
  if (Platform.OS === 'windows') {
    expect(app.root.findByType(Image).props.source.uri).toMatch(
      /^data:image\/svg\+xml;base64,/,
    );
  }
  expect(app.root.findByType(ActivityIndicator).props.accessibilityLabel).toBe(
    'Loading stopwatches',
  );
  await act(async () => app.unmount());
});

test('users can add, switch, rename, change theme and cancel deletion', async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(<App />);
  });
  expect(app.root.findAllByType(Image)).toHaveLength(0);
  const press = async (label: string, index = 0) => {
    const buttons = app.root.findAll(
      b => b.props.label === label && typeof b.props.onPress === 'function',
    );
    await act(async () => {
      buttons[index].props.onPress();
    });
  };
  expect(
    app.root.findAll(b => b.props.label === 'Delete')[0]?.props.disabled,
  ).toBe(true);
  await press('▶  Start');
  await press('+  Add stopwatch');
  expect(app.root.findAll(b => b.props.label === 'Ⅱ  Pause')).toHaveLength(1);
  await act(async () => {
    app.root
      .findAll(
        b =>
          b.props.accessibilityLabel === 'Rename Stopwatch 2' &&
          typeof b.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
  await act(async () => {
    app.root.findByType(TextInput).props.onChangeText('Writing');
  });
  await act(async () => {
    app.root.findByType(TextInput).props.onSubmitEditing();
  });
  expect(
    app.root
      .findAll(b => Boolean(b.props.accessibilityLabel))
      .some(b => b.props.accessibilityLabel === 'Rename Writing'),
  ).toBe(true);
  await press('☼  Light');
  await press('☾  Dark');
  await press('Delete', 1);
  await press('Cancel');
  expect(
    app.root
      .findAll(b => Boolean(b.props.accessibilityLabel))
      .some(b => b.props.accessibilityLabel === 'Rename Writing'),
  ).toBe(true);
  await act(async () => {
    app.unmount();
  });
});
