import { MAX_PHOTO_BYTES } from '@repair/core';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PreparedPhoto = { uri: string; name: string; mime: 'image/jpeg'; size: number; data: ArrayBuffer };

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.7;

const DENIED = {
  camera: 'ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาเปิดสิทธิ์ในการตั้งค่าเครื่อง',
  library: 'ไม่ได้รับอนุญาตให้เข้าถึงคลังรูป กรุณาเปิดสิทธิ์ในการตั้งค่าเครื่อง',
} as const;

// a string result is the Thai message to show; an empty array means the user cancelled
export async function pickPhotos(source: 'camera' | 'library', limit: number): Promise<ImagePicker.ImagePickerAsset[] | string> {
  const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return DENIED[source];
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: limit, quality: 1 });
  return result.canceled ? [] : result.assets;
}

// phone photos are often 3-12 MB; a 1600 px JPEG at 0.7 is a few hundred KB, well under MAX_PHOTO_BYTES
export async function preparePhoto(asset: ImagePicker.ImagePickerAsset, index: number): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_EDGE) context.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
  if (!saved.base64) throw new Error('no image data');
  const data = Uint8Array.from(atob(saved.base64), (c) => c.charCodeAt(0)).buffer;
  if (data.byteLength > MAX_PHOTO_BYTES) throw new Error('photo too large');
  const base = asset.fileName?.replace(/\.[^.]+$/, '') ?? `photo-${Date.now()}-${index}`;
  return { uri: saved.uri, name: `${base}.jpg`, mime: 'image/jpeg', size: data.byteLength, data };
}
