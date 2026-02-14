
export type AreaId = 'arlington_va' | 'alexandria_va' | 'richmond_va' | 'exploring';

export interface Area {
  id: AreaId;
  name: string;
  label: string;
}

export type Interest = 'Walking' | 'Chess' | 'Coffee & Chat' | 'Bird Watching' | 'Gardening';

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export type FontSize = 'standard' | 'large' | 'extra-large';
export type ContrastMode = 'normal' | 'high';

export interface AccessibilitySettings {
  fontSize: FontSize;
  contrastMode: ContrastMode;
  screenReaderOptimized: boolean;
}

export interface Session {
  id: string;
  displayName: string;
  areaId: AreaId;
  interests: Interest[];
  createdAt: number;
  lastSeenAt: number;
  accessibility: AccessibilitySettings;
  inviteDuration: number;
}

export interface Invite {
  id: string;
  fromSessionId: string;
  toSessionId: string;
  activity: Interest;
  status: InviteStatus;
  createdAt: number;
  expiresAt: number;
  respondedAt?: number;
  coordinationNote?: string;
  aiSuggestedSpot?: string;
  acceptedBy?: string[]; 
}

export type View = 'WELCOME' | 'NAME' | 'LOCATION' | 'INTERESTS' | 'DASHBOARD' | 'PROFILE';

export interface AppState {
  currentSession: Session | null;
  invites: Invite[];
  currentView: View;
}

export interface BuddyInsight {
  buddyId: string;
  insight: string;
  icebreaker: string;
}
