
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

export const INVITE_DURATION_MS = 60 * 60 * 1000; 

// CHANGED KEY TO FORCE REFRESH
export const STORAGE_KEY = 'gb_v6_storage_final';

export const MOCK_PEERS: any[] = [];
