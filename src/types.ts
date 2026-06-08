export interface Student {
  id: string; // e.g., "S101"
  studentNumber: string; // e.g., "STUD-2026-001"
  name: string;
  major: string;
  photo: string; // base64 payload of registered face
  timetable: string[]; // Class ID strings
  password?: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  password?: string;
  timetable: string[]; // Class ID strings
}

export interface ClassSchedule {
  id: string; // e.g., "C101"
  subjectName: string; // e.g., "Introduction to AI"
  room: string; // e.g., "Room 404"
  dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  startTime: string; // e.g., "09:00"
  endTime: string; // e.g., "10:30"
  teacherId: string;
  studentIds: string[]; // array of studentId
}

export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  studentNumber: string;
  major: string;
  timestamp: string; // ISO String
  status: "PRESENT" | "ABSENT" | "LATE" | "VERIFYING";
  verifiedPhoto?: string; // base64 face snapshot captured at check-in
  confidenceScore?: number; // analysis matching confidence
  matchAnalysis?: string; // Gemini's similarity rationale
}

export interface AttendanceSession {
  id: string; // classId + "_" + date (YYYY-MM-DD)
  classId: string;
  date: string; // YYYY-MM-DD
  status: "OPEN" | "CLOSED";
  createdAt: string;
  records: AttendanceRecord[];
}

export interface AuthState {
  user: {
    id: string;
    name: string;
    role: "teacher" | "student";
    email?: string;
    studentNumber?: string;
    major?: string;
    photo?: string;
  } | null;
}
