import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Tooltip } from './tooltip';

describe('Tooltip', () => {
  it('opens on hover and focus, and closes on mouseLeave and blur', () => {
    render(
      <Tooltip content="提示說明內容" testId="demo-tooltip">
        <button type="button">觸發按鈕</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button', { name: '觸發按鈕' });
    expect(screen.queryByTestId('demo-tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(trigger);
    expect(screen.getByTestId('demo-tooltip')).toHaveTextContent(
      '提示說明內容'
    );

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByTestId('demo-tooltip')).not.toBeInTheDocument();

    fireEvent.focus(trigger);
    expect(screen.getByTestId('demo-tooltip')).toBeInTheDocument();

    fireEvent.blur(trigger);
    expect(screen.queryByTestId('demo-tooltip')).not.toBeInTheDocument();
  });

  it('supports pinOnClick without inverting open state on first click after hover', () => {
    render(
      <div>
        <Tooltip content="可釘選提示" pinOnClick testId="pin-tooltip">
          <button type="button">資訊按鈕</button>
        </Tooltip>
        <button type="button">外部區域</button>
      </div>
    );

    const trigger = screen.getByRole('button', { name: '資訊按鈕' });

    // Desktop sequence: mouseEnter -> click -> mouseLeave keeps tooltip open
    fireEvent.mouseEnter(trigger);
    expect(screen.getByTestId('pin-tooltip')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByTestId('pin-tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    expect(screen.getByTestId('pin-tooltip')).toBeInTheDocument();

    // Outside pointerDown unpins and closes
    fireEvent.pointerDown(screen.getByRole('button', { name: '外部區域' }));
    expect(screen.queryByTestId('pin-tooltip')).not.toBeInTheDocument();

    // Clicking trigger directly pins open; second click closes immediately
    fireEvent.click(trigger);
    expect(screen.getByTestId('pin-tooltip')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByTestId('pin-tooltip')).not.toBeInTheDocument();
  });

  it('renders into portalContainer and closes cleanly on Escape or dismissSignal', () => {
    const onDocumentKeyDown = vi.fn();

    function Harness() {
      const [portalEl, setPortalEl] = React.useState<HTMLDivElement | null>(
        null
      );
      const [signal, setSignal] = React.useState(0);

      return (
        <div ref={setPortalEl} data-testid="portal-host">
          <div style={{ overflow: 'hidden' }}>
            <Tooltip
              content="脫離裁切容器提示"
              pinOnClick
              portalContainer={portalEl}
              dismissSignal={signal}
              testId="portaled-tooltip"
            >
              <button type="button">略過按鈕</button>
            </Tooltip>
          </div>
          <button type="button" onClick={() => setSignal((v) => v + 1)}>
            強制關閉提示
          </button>
        </div>
      );
    }

    render(<Harness />);

    const trigger = screen.getByRole('button', { name: '略過按鈕' });
    fireEvent.click(trigger);

    const tooltip = screen.getByTestId('portaled-tooltip');
    expect(tooltip.parentElement).toBe(screen.getByTestId('portal-host'));

    // Escape on trigger closes tooltip and stops propagation to parent/document
    document.addEventListener('keydown', onDocumentKeyDown);
    try {
      const allowed = fireEvent.keyDown(trigger, { key: 'Escape' });
      expect(allowed).toBe(false);
      expect(screen.queryByTestId('portaled-tooltip')).not.toBeInTheDocument();
      expect(onDocumentKeyDown).not.toHaveBeenCalled();

      // Once closed, subsequent Escape is not swallowed by Tooltip
      fireEvent.keyDown(trigger, { key: 'Escape' });
      expect(onDocumentKeyDown).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('keydown', onDocumentKeyDown);
    }

    // Re-open and dismiss via dismissSignal
    fireEvent.click(trigger);
    expect(screen.getByTestId('portaled-tooltip')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '強制關閉提示' }));
    expect(screen.queryByTestId('portaled-tooltip')).not.toBeInTheDocument();
  });
});
