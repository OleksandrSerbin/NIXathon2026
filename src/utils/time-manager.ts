/**
 * Time management utility for move calculation
 * Ensures we always return a move within time limits
 */
export class TimeManager {
  private startTime: number;
  private maxTimeMs: number;
  private warningTimeMs: number;

  constructor(maxTimeMs: number = 5000, warningTimeMs: number = 4000) {
    this.maxTimeMs = maxTimeMs;
    this.warningTimeMs = warningTimeMs;
    this.startTime = Date.now();
  }

  /**
   * Check if we should stop searching (time limit approaching)
   */
  shouldStop(): boolean {
    const elapsed = this.elapsed();
    return elapsed >= this.warningTimeMs;
  }

  /**
   * Check if time limit exceeded
   */
  isTimeout(): boolean {
    return this.elapsed() >= this.maxTimeMs;
  }

  /**
   * Get elapsed time in milliseconds
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get remaining time in milliseconds
   */
  remaining(): number {
    return Math.max(0, this.maxTimeMs - this.elapsed());
  }

  /**
   * Reset timer
   */
  reset(): void {
    this.startTime = Date.now();
  }
}
