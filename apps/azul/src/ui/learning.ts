/**
 * Learning mode: the aids for someone still finding their feet.
 *
 * With it on, the table does the arithmetic out loud — what each line would
 * earn or cost before you commit, where the handful would land, how close each
 * end-game bonus is, what a firing tile scored — and keeps a count of the tiles
 * still to come. With it off, the table is the bare board, as at a real table.
 *
 * On by default, and remembered per browser.
 */

const LEARNING_KEY = 'azulejo:learning'

export function learningEnabled(): boolean {
  try {
    return localStorage.getItem(LEARNING_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setLearningEnabled(on: boolean): void {
  try {
    localStorage.setItem(LEARNING_KEY, on ? 'on' : 'off')
  } catch {
    // the choice lasts for this visit
  }
}
