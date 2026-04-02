import { z } from 'zod';

const trustDevice = {
  params: z.object({
    deviceId: z.string().min(1, { message: 'Device ID is required' }),
  }),
};

const removeDevice = {
  params: z.object({
    deviceId: z.string().min(1, { message: 'Device ID is required' }),
  }),
};

const removeAllOtherDevices = {
  body: z.object({
    currentDeviceId: z.string().min(1, { message: 'Current device ID is required' }),
  }),
};

export default {
  trustDevice,
  removeDevice,
  removeAllOtherDevices,
};
