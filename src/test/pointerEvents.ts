import { fireEvent } from '@testing-library/react';

export function firePointer(
  el: Element,
  type: string,
  { pointerId = 1, clientX = 0, clientY = 0 } = {}
) {
  fireEvent(
    el,
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId,
      clientX,
      clientY,
    })
  );
}
