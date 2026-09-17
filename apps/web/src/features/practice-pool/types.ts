export interface PracticePoolCandidate {
  queueEntryId: string;
  anonymousAlias: string;
  language: string;
  level: string;
  practiceType: string;
  joinedAt: string;
}

export interface PracticePoolSession {
  sessionId: string;
  roomId: string;
  peerAlias: string;
  status: 'active' | 'completed' | 'expired';
  audioOnly: boolean;
  startsAt: string;
  expiresAt: string;
}
