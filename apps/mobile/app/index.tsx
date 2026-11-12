import { Redirect } from 'expo-router';

// protected in the root layout, so a signed-out user lands on the login screen instead
export default function Index() {
  return <Redirect href="/tickets" />;
}
