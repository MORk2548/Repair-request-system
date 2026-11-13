import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemePicker } from '../components/ThemePicker';
import { ThemeProvider, useTheme } from '../lib/theme';

function Current() {
  return <Text>ธีม:{useTheme().id}</Text>;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('the provider starts from the saved theme', async () => {
  await AsyncStorage.setItem('theme', 'ocean');
  await render(
    <ThemeProvider>
      <Current />
    </ThemeProvider>,
  );
  expect(await screen.findByText('ธีม:ocean')).toBeTruthy();
});

test('an unknown saved value falls back to the default theme', async () => {
  await AsyncStorage.setItem('theme', 'neon');
  await render(
    <ThemeProvider>
      <Current />
    </ThemeProvider>,
  );
  expect(await screen.findByText('ธีม:aurora')).toBeTruthy();
});

test('picking a theme applies and saves it', async () => {
  const user = userEvent.setup();
  await render(
    <ThemeProvider>
      <ThemePicker />
      <Current />
    </ThemeProvider>,
  );
  expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual(['ออโรรา', 'สนธยา', 'มหาสมุทร', 'กลางวัน']);
  await user.press(screen.getByRole('radio', { name: 'กลางวัน' }));
  expect(await screen.findByText('ธีม:daylight')).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'กลางวัน' })).toBeChecked();
  await waitFor(async () => expect(await AsyncStorage.getItem('theme')).toBe('daylight'));
});
