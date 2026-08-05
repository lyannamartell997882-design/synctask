export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

export interface Task {
  id: string;
  userId: string;
  text: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  recurrence: RecurrenceType;
  reminderEnabled: boolean;
}

export interface User {
  id: string;
  username: string;
}
