const DEVICE_ID_KEY = 'yupos_device_id';

/**
 * Returns a stable installation identifier for this browser/device.
 * It is an identifier, not a security credential. The server will enforce
 * max-device limits in a later licensing phase.
 */
export const getDeviceId = (): string => {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // Some restricted browser contexts can block storage. Generate a transient
    // identifier rather than preventing the POS from loading.
    return crypto.randomUUID();
  }
};

export const clearDeviceId = (): void => {
  try {
    localStorage.removeItem(DEVICE_ID_KEY);
  } catch {
    // Ignore local cache failures.
  }
};
