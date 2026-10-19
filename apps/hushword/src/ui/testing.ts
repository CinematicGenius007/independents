import { act } from '@testing-library/react'

/**
 * Typing, the way the app actually receives it.
 *
 * The board listens for `keydown` on the window rather than on an input, so a
 * test has to dispatch at the same place a person's keyboard would — and inside
 * `act`, because otherwise React never commits the letter before the next
 * keystroke arrives. A controlled field is the other way round: its value only
 * changes if the native setter is used and an `input` event follows.
 */

export function ACTIVATE(key: string): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

export function setInput(element: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** Key by key at the window, or all at once into a field. */
export function typeInto(text: string, field?: HTMLInputElement): void {
  if (field) {
    setInput(field, `${field.value ?? ''}${text}`)
    return
  }
  for (const character of text) ACTIVATE(character)
}
