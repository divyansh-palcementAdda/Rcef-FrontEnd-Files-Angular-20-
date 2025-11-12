/** Mirrors com.renaissance.app.payload.TaskRequestPayload */
export interface TaskRequestPayload {
  /** Task to which request belongs */
  taskId: number;

  /** CLOSURE or EXTENSION */
  requestType: 'CLOSURE' | 'EXTENSION';

  /** Optional remarks */
  remarks?: string;
}