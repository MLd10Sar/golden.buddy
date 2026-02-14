
import { Area, Interest } from './types';

export const AREAS: Area[] = [
  { id: 'arlington_va', name: 'Arlington County, VA', label: 'Arlington County' },
  { id: 'alexandria_va', name: 'City of Alexandria, VA', label: 'City of Alexandria' },
  { id: 'richmond_va', name: 'City of Richmond, VA', label: 'City of Richmond' },
  { id: 'exploring', name: 'Just exploring', label: 'Just exploring' },
];

export const INTERESTS: Interest[] = [
  'Walking',
  'Chess',
  'Coffee & Chat',
  'Bird Watching',
  'Gardening',
];

export const INVITE_DURATION_MS = 60 * 60 * 1000; // 1 hour

export const STORAGE_KEY = 'goldenbuddy_v2_state';

// Mock peers removed for pure natural testing
export const MOCK_PEERS: any[] = [];
