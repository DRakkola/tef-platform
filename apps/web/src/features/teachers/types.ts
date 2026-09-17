export interface TeacherProfileCard {
  id: string;
  userId: string;
  displayName: string;
  bio?: string;
  specializations: string[];
  hourlyRateCents: number;
  ratingAverage: number;
  totalReviews: number;
  timezone: string;
}

export interface TeacherSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}
