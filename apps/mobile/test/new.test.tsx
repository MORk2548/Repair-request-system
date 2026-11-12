import { attachPhoto, createTicket, listCategories, listEquipment } from '@repair/api';
import type { Ticket } from '@repair/core';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import NewTicketScreen from '../app/tickets/new';

jest.mock('@repair/api', () => ({ createTicket: jest.fn(), attachPhoto: jest.fn(), listEquipment: jest.fn(), listCategories: jest.fn() }));
jest.mock('../lib/supabase', () => ({ db: {} }));
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-image-picker', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (uri: string) => {
      const context = {
        resize: () => context,
        renderAsync: async () => ({ saveAsync: async () => ({ uri: `${uri}-small.jpg`, width: 1600, height: 1200, base64: 'AQID' }) }),
      };
      return context;
    },
  },
}));

const ticket = { id: 't-1', ticketNo: 'RQ-2611-0001' } as Ticket;
const granted = { granted: true, status: ImagePicker.PermissionStatus.GRANTED, canAskAgain: true, expires: 'never' } as const;
const asset = (name: string) => ({ uri: `file:///${name}`, width: 4000, height: 3000, fileName: name, type: 'image' as const });
const picked = (...names: string[]) => ({ canceled: false as const, assets: names.map(asset) });

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(listCategories).mockResolvedValue([
    { id: 1, name: 'ไฟฟ้า', sortOrder: 1, isActive: true },
    { id: 3, name: 'เครื่องปรับอากาศ', sortOrder: 3, isActive: true },
  ]);
  jest.mocked(listEquipment).mockResolvedValue([]);
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue(granted);
  jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue(granted);
});

async function setup() {
  const user = userEvent.setup();
  await render(<NewTicketScreen />);
  await screen.findByRole('radio', { name: 'เครื่องปรับอากาศ' });
  return user;
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('หัวข้อ'), 'แอร์ไม่เย็น');
  await user.type(screen.getByLabelText('รายละเอียด'), 'ห้องประชุม 2 แอร์ไม่เย็น');
  await user.press(screen.getByRole('radio', { name: 'เครื่องปรับอากาศ' }));
  await user.type(screen.getByLabelText('สถานที่'), 'ตึก A ชั้น 3');
}

const submitButton = () => screen.getByRole('button', { name: 'ส่งใบแจ้งซ่อม' });
const requestIds = () => jest.mocked(createTicket).mock.calls.map(([, input]) => input.clientRequestId);

test('shows Thai validation errors and blocks submit when form is empty', async () => {
  const user = await setup();
  await user.press(submitButton());

  expect(screen.getByText('กรุณากรอกหัวข้อ')).toBeTruthy();
  expect(screen.getByText('กรุณากรอกรายละเอียด')).toBeTruthy();
  expect(screen.getByText('กรุณาเลือกหมวดหมู่')).toBeTruthy();
  expect(screen.getByText('กรุณากรอกสถานที่')).toBeTruthy();
  expect(screen.getByLabelText('หัวข้อ').props.accessibilityHint).toBe('กรุณากรอกหัวข้อ');
  expect(createTicket).not.toHaveBeenCalled();
});

test('selecting a 6th photo is refused with "แนบรูปได้ไม่เกิน 5 รูป"', async () => {
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce(picked('1.jpg', '2.jpg', '3.jpg', '4.jpg')).mockResolvedValueOnce(picked('5.jpg', '6.jpg'));
  const user = await setup();

  await user.press(screen.getByRole('button', { name: 'เลือกจากคลังรูป' }));
  expect(await screen.findAllByRole('button', { name: /^ลบรูป/ })).toHaveLength(4);
  await user.press(screen.getByRole('button', { name: 'เลือกจากคลังรูป' }));

  expect(await screen.findByText('แนบรูปได้ไม่เกิน 5 รูป')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /^ลบรูป/ })).toHaveLength(4);
});

test('photo failure keeps ticket, shows retry; retry uploads only the failed photos and does not call createTicket again', async () => {
  jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValueOnce(picked('a.jpg')).mockResolvedValueOnce(picked('b.jpg'));
  jest.mocked(createTicket).mockResolvedValue(ticket);
  jest.mocked(attachPhoto)
    .mockResolvedValueOnce({ id: 1 })
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockResolvedValueOnce({ id: 2 });
  const user = await setup();
  await fill(user);
  await user.press(screen.getByRole('button', { name: 'ถ่ายรูป' }));
  await screen.findByRole('button', { name: 'ลบรูป a.jpg' });
  await user.press(screen.getByRole('button', { name: 'ถ่ายรูป' }));
  await screen.findByRole('button', { name: 'ลบรูป b.jpg' });

  await user.press(submitButton());
  expect(await screen.findByText('สร้างใบแจ้งซ่อมแล้ว แต่อัปโหลดรูปไม่สำเร็จ')).toBeTruthy();
  expect(mockRouter.back).not.toHaveBeenCalled();

  await user.press(screen.getByRole('button', { name: 'ลองอัปโหลดรูปอีกครั้ง' }));
  await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  expect(jest.mocked(attachPhoto).mock.calls.map(([, id, file]) => [id, file.name, file.mime])).toEqual([
    ['t-1', 'a.jpg', 'image/jpeg'],
    ['t-1', 'b.jpg', 'image/jpeg'],
    ['t-1', 'b.jpg', 'image/jpeg'],
  ]);
  expect(jest.mocked(attachPhoto).mock.calls[0]![2].data).toBeInstanceOf(ArrayBuffer);
  expect(createTicket).toHaveBeenCalledTimes(1);
});

test('draft text survives a failed createTicket (network error) and can be resubmitted with same clientRequestId', async () => {
  jest.mocked(createTicket).mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(ticket);
  const user = await setup();
  await fill(user);

  await user.press(submitButton());
  expect(await screen.findByText('ส่งใบแจ้งซ่อมไม่สำเร็จ กรุณาลองอีกครั้ง')).toBeTruthy();
  expect(screen.getByLabelText('หัวข้อ').props.value).toBe('แอร์ไม่เย็น');

  await user.press(submitButton());
  await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  expect(requestIds()).toHaveLength(2);
  expect(requestIds()[1]).toBe(requestIds()[0]);
});

test('picking equipment fills the location, which stays editable', async () => {
  jest.mocked(listEquipment).mockResolvedValue([
    { id: 7, assetTag: 'AC-0001', name: 'แอร์ห้องประชุมใหญ่', installLocation: 'อาคาร A ชั้น 2', serialNo: null, departmentId: null, status: 'active' },
  ]);
  jest.mocked(createTicket).mockResolvedValue(ticket);
  const user = await setup();
  await user.type(screen.getByLabelText('หัวข้อ'), 'แอร์ไม่เย็น');
  await user.type(screen.getByLabelText('รายละเอียด'), 'ไม่เย็น');
  await user.press(screen.getByRole('radio', { name: 'เครื่องปรับอากาศ' }));

  await user.type(screen.getByLabelText('อุปกรณ์ (ไม่บังคับ)'), 'AC-0');
  await user.press(await screen.findByRole('button', { name: /AC-0001/ }));
  expect(screen.getByLabelText('สถานที่').props.value).toBe('อาคาร A ชั้น 2');
  expect(listEquipment).toHaveBeenLastCalledWith({}, { q: 'AC-0' });

  await user.type(screen.getByLabelText('สถานที่'), ' ห้อง 201');
  await user.press(submitButton());
  await waitFor(() => expect(createTicket).toHaveBeenCalled());
  expect(jest.mocked(createTicket).mock.calls[0]![1]).toMatchObject({ equipmentId: 7, location: 'อาคาร A ชั้น 2 ห้อง 201', priority: 'normal' });
});

test('camera permission denied shows a Thai message and does not open the camera', async () => {
  jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ ...granted, granted: false, status: ImagePicker.PermissionStatus.DENIED });
  const user = await setup();

  await user.press(screen.getByRole('button', { name: 'ถ่ายรูป' }));
  expect(await screen.findByText('ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาเปิดสิทธิ์ในการตั้งค่าเครื่อง')).toBeTruthy();
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
});
