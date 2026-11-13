import { ScrollView } from 'react-native';
import { Screen } from '../../components/Screen';
import { ThemePicker } from '../../components/ThemePicker';
import { useUi } from '../../components/ui';

export default function SettingsScreen() {
  const { styles } = useUi();
  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={styles.screen}>
        <ThemePicker />
      </ScrollView>
    </Screen>
  );
}
