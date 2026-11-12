import AsyncStorage from '@react-native-async-storage/async-storage';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// SecureStore values are limited to about 2 KB and a Supabase session is larger, so SecureStore keeps
// only a random AES-256 key per item and AsyncStorage keeps the AES-GCM sealed session (Supabase's Expo pattern)
const keyName = (key: string) => `aes.${key.replace(/[^A-Za-z0-9._-]/g, '_')}`;

export const encryptedStorage = {
  async getItem(key: string): Promise<string | null> {
    const [hex, sealed] = await Promise.all([SecureStore.getItemAsync(keyName(key)), AsyncStorage.getItem(key)]);
    if (!hex || !sealed) return null;
    try {
      const bytes = await aesDecryptAsync(AESSealedData.fromCombined(sealed), await AESEncryptionKey.import(hex, 'hex'));
      return new TextDecoder().decode(bytes);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    const aesKey = await AESEncryptionKey.generate();
    const sealed = await aesEncryptAsync(new TextEncoder().encode(value), aesKey);
    await SecureStore.setItemAsync(keyName(key), await aesKey.encoded('hex'));
    await AsyncStorage.setItem(key, await sealed.combined('base64'));
  },
  async removeItem(key: string): Promise<void> {
    await Promise.all([SecureStore.deleteItemAsync(keyName(key)), AsyncStorage.removeItem(key)]);
  },
};
