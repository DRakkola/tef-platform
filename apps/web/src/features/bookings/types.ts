export type BookingState =
  | 'requested'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export interface BookingDetails {
  id: string;
  teacherId: string;
  studentId: string;
  teacherDisplayName?: string;
  startTime: string;
  endTime: string;
  status: BookingState;
  meetingLink?: string;
  notes?: string;
  cancellationReason?: string;
}
