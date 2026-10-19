// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { configFor } from '../engine/game'
import { buildLink } from '../engine/link'
import { ACTIVATE, setInput, typeInto } from './testing'
import { gapFor, keyWidthFor } from './sizing'

/**
 * The app, as somebody uses it.
 *
 * The engine has its own suite; this one only asserts what a person can see and
 * do — that a link opens a board, that typing fills it, that a rejected guess
 * says why, that a free letter gives away a letter, and that the composer's
 * controls reach the link it builds. It is deliberately thin: enough to catch a
 * screen that stops working, not a second copy of the engine tests.
 */

function openCase(config = configFor({ seed: 'UI-1' }), answer = 'garden') {
  const { fragment } = buildLink(config, answer, { entropy: 'ui' })
  window.location.hash = fragment
  return render(<App />)
}

const board = () => screen.getByRole('group', { name: /the board/i })
const rowAt = (index: number) => within(board()).getAllByRole('group')[index]
const statuses = () => screen.getAllByRole('status').map((node) => node.textContent ?? '')
/**
 * Wait for the board to stop talking.
 *
 * The keyboard is disabled while a row is being revealed and while the
 * dictionary is in flight, and it is replaced altogether once the puzzle is
 * over — so "ready" means usable, or gone.
 */
const ready = async () =>
  waitFor(
    () => {
      const enter = screen.queryByRole('button', { name: 'ENTER' })
      expect(enter === null || enter.hasAttribute('disabled') === false).toBe(true)
    },
    { timeout: 4000 },
  )

beforeEach(() => {
  window.location.hash = ''
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('the room', () => {
  it('turns the lights on', async () => {
    render(<App />)
    const toggle = screen.getByRole('button', { name: /lights on/i })
    toggle.click()
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))
    expect(screen.getByRole('button', { name: /lights off/i })).toBeTruthy()
  })

  it('offers the daily and the composer', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /every link speaks/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /play today/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /make your own/i })).toBeTruthy()
  })
})

describe('a case', () => {
  it('narrows its keys until the widest row fits the room', () => {
    const widest = (room: number): number => {
      const key = keyWidthFor(room)
      return 10 * key + 18 + 9 * gapFor(key)
    }
    // Comfortable is 34px, and nine letters plus a wide key come to 403.
    expect(keyWidthFor(520)).toBe(34)
    expect(widest(520)).toBe(403)
    // A 390px phone leaves 342, so the keys give way rather than the layout —
    // which they did not, and the whole page scrolled sideways on every iPhone.
    expect(keyWidthFor(342)).toBe(28)
    expect(widest(342)).toBe(334)
    expect(widest(272)).toBeLessThanOrEqual(272)
    // A floor rather than a vanishing act.
    expect(keyWidthFor(100)).toBe(22)
  })

  it('opens a board of the right shape', async () => {
    openCase(configFor({ seed: 'UI-2', length: 5 }), 'apple')
    await waitFor(() => expect(board()).toBeTruthy())
    expect(board().getAttribute('aria-label')).toMatch(/6 rows of 5 letters/i)
  })

  it('opens a twelve-letter board, which is as long as a board gets', async () => {
    openCase(configFor({ seed: 'UI-12', length: 12 }), 'nevertheless')
    await waitFor(() => expect(board()).toBeTruthy())
    expect(board().getAttribute('aria-label')).toMatch(/6 rows of 12 letters/i)
    expect(rowAt(0).getAttribute('aria-label')).toBe('Row 1, empty')
  })

  it('fills the row you are typing into, rather than a separate field', async () => {
    openCase()
    await ready()
    await typeInto('cand')
    await waitFor(() => expect(rowAt(0).getAttribute('aria-label')).toBe('Row 1, 4 of 6: c a n d'))
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('refuses a guess of the wrong length and says how long this one is', async () => {
    openCase()
    await ready()
    await typeInto('cat')
    ACTIVATE('Enter')
    await waitFor(() => expect(statuses().some((text) => /3 letters/i.test(text))).toBe(true))
  })

  it('tells a row what it means, cell by cell', async () => {
    openCase()
    await ready()
    await typeInto('danger')
    ACTIVATE('Enter')
    await waitFor(() => expect(rowAt(0).getAttribute('aria-label')).toMatch(/right letter, right spot/))
    // danger against garden: d shifted, a exact, n shifted, g shifted, e exact, r shifted.
    expect(rowAt(0).getAttribute('aria-label')).toMatch(/d, right letter, wrong spot/)
    expect(rowAt(0).getAttribute('aria-label')).toMatch(/a, right letter, right spot/)
  })

  it('wins on the exact word and announces it', async () => {
    openCase()
    await ready()
    await typeInto('garden')
    ACTIVATE('Enter')
    // The row is told first and the outcome lands after it, which is the point
    // of the delay — so the test waits for the board to finish speaking.
    await ready()
    expect(screen.getByText('SOLVED')).toBeTruthy()
    expect(statuses().some((text) => /solved in 1 of 6/i.test(text))).toBe(true)
  })

  it('gives away a letter when a free letter is spent', async () => {
    openCase(configFor({ seed: 'UI-3', hints: 2 }))
    await ready()
    const position = await screen.findByRole('button', { name: /spend a free letter on position 3/i })
    position.click()
    await waitFor(() => expect(screen.getByRole('button', { name: /position 3 is r/i })).toBeTruthy())
    expect(screen.getByText(/1 of 2/i)).toBeTruthy()
  })

  it('pulls a bar back when a lift is spent', async () => {
    openCase(configFor({ seed: 'UI-4', rows: 4, lifts: 1 }))
    await ready()
    for (const word of ['danger', 'wander', 'damage']) {
      await typeInto(word)
      ACTIVATE('Enter')
      await ready()
    }
    // Row three is barred on this configuration, so there is something to lift.
    await waitFor(() => expect(document.querySelectorAll('.tile--barred').length).toBeGreaterThan(0))
    screen.getByRole('button', { name: /spend a lift/i }).click()
    // The bars only become clickable once the mode has committed.
    await waitFor(() =>
      expect(document.querySelectorAll('.tile--barred:not([disabled])').length).toBeGreaterThan(0),
    )
    const barred = document.querySelector('.tile--barred:not([disabled])') as HTMLElement
    barred.click()
    await waitFor(() => expect(screen.getByText(/0 OF 1/i)).toBeTruthy())
  })

  it('keeps a half-finished puzzle, so a link still works tomorrow', async () => {
    const first = openCase(configFor({ seed: 'UI-5' }))
    await ready()
    await typeInto('danger')
    ACTIVATE('Enter')
    await ready()
    first.unmount()
    cleanup()

    render(<App />)
    await waitFor(() => expect(rowAt(0).getAttribute('aria-label')).toMatch(/^Row 1: d/))
  })
})

describe('the composer', () => {
  it('builds a link that opens the puzzle it described', async () => {
    window.location.hash = '/compose'
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: /make a puzzle/i })).toBeTruthy())
    await waitFor(() => expect(screen.getByRole('button', { name: /play it yourself/i }).hasAttribute('disabled')).toBe(false))
    const link = document.querySelector('.sheet')?.textContent ?? ''
    expect(link.startsWith('#')).toBe(true)

    window.location.hash = link
    cleanup()
    render(<App />)
    await waitFor(() => expect(board()).toBeTruthy())
  })

  it('changes the map when a redaction shape is chosen', async () => {
    window.location.hash = '/compose'
    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: /everything/i })).toBeTruthy())
    screen.getByRole('button', { name: /^everything$/i }).click()
    await waitFor(() => expect(screen.getAllByText(/36 of 36 barred/i).length).toBeGreaterThan(0))
    screen.getByRole('button', { name: /^nothing$/i }).click()
    await waitFor(() => expect(screen.getAllByText(/0 of 36 barred/i).length).toBeGreaterThan(0))
  })

  it('lets a word the dictionary has never heard of through', async () => {
    window.location.hash = '/compose'
    render(<App />)
    await waitFor(() => expect(screen.getByLabelText(/the answer/i)).toBeTruthy())
    setInput(screen.getByLabelText(/the answer/i) as HTMLInputElement, 'gelato')
    await waitFor(() => expect(screen.getByText(/your own word/i)).toBeTruthy())
    expect(screen.getByRole('button', { name: /play it yourself/i }).hasAttribute('disabled')).toBe(false)
  })

  it('counts all the way to twelve letters, and no further', async () => {
    window.location.hash = '/compose'
    render(<App />)
    await waitFor(() => expect(screen.getByRole('heading', { name: /make a puzzle/i })).toBeTruthy())
    // The stepper beside the word "letters" is the board length, and it has to
    // be re-queried each time: React replaces the button as it re-renders, so a
    // second click on the old node would land nowhere.
    const lengthStepper = () => within(screen.getByText('letters').closest('.row') as HTMLElement)
    for (let i = 0; i < 6; i += 1) fireEvent.click(lengthStepper().getByRole('button', { name: 'more' }))
    await waitFor(() => expect(screen.getByText(/of 12 letters/i)).toBeTruthy())
    expect(lengthStepper().getByRole('button', { name: 'more' }).hasAttribute('disabled')).toBe(true)

    setInput(screen.getByLabelText(/the answer/i) as HTMLInputElement, 'nevertheless')
    await waitFor(() => expect(screen.getByRole('button', { name: /play it yourself/i }).hasAttribute('disabled')).toBe(false))
    const link = document.querySelector('.sheet')?.textContent ?? ''
    window.location.hash = link
    cleanup()
    render(<App />)
    await waitFor(() => expect(board()).toBeTruthy())
    expect(board().getAttribute('aria-label')).toMatch(/6 rows of 12 letters/i)
  })
})
