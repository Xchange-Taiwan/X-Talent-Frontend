import { act, renderHook } from '@testing-library/react';
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

import { useUnsavedChangesPrompt } from './useUnsavedChangesPrompt';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('useUnsavedChangesPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('When when is false (clean or saving state)', () => {
    it('should initialize with isPromptOpen as false', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(false));
      expect(result.current.isPromptOpen).toBe(false);
    });

    it('should not intercept beforeunload events', () => {
      renderHook(() => useUnsavedChangesPrompt(false));
      const event = new Event('beforeunload') as BeforeUnloadEvent;
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        window.dispatchEvent(event);
      });
      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(event.returnValue).not.toBe('');
    });

    it('should not intercept link clicks', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(false));

      const anchor = document.createElement('a');
      anchor.href = '/about';
      document.body.appendChild(anchor);

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        anchor.dispatchEvent(event);
      });

      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(result.current.isPromptOpen).toBe(false);
    });

    it('should not intercept browser popstate (back button)', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(false));

      const pushStateSpy = vi.spyOn(window.history, 'pushState');
      const event = new Event('popstate');

      act(() => {
        window.dispatchEvent(event);
      });

      expect(pushStateSpy).not.toHaveBeenCalled();
      expect(result.current.isPromptOpen).toBe(false);
    });

    it('should execute guardNavigate action immediately without prompting', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(false));
      const action = vi.fn();

      act(() => {
        result.current.guardNavigate(action);
      });

      expect(action).toHaveBeenCalledTimes(1);
      expect(result.current.isPromptOpen).toBe(false);
    });
  });

  describe('When when is true (unsaved changes exist)', () => {
    it('should register beforeunload and intercept it', () => {
      renderHook(() => useUnsavedChangesPrompt(true));
      const event = new Event('beforeunload') as BeforeUnloadEvent;
      Object.defineProperty(event, 'returnValue', {
        value: true,
        writable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        window.dispatchEvent(event);
      });
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(event.returnValue).toBe('');
    });

    it('should intercept SPA clicks on matching anchors, open prompt, and navigate on confirm', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(true));

      const anchor = document.createElement('a');
      anchor.href = '/dashboard';
      document.body.appendChild(anchor);

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      act(() => {
        anchor.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
      expect(result.current.isPromptOpen).toBe(true);

      // Cancel leave
      act(() => {
        result.current.cancelLeave();
      });
      expect(result.current.isPromptOpen).toBe(false);
      expect(mockPush).not.toHaveBeenCalled();

      // Trigger click again to test confirm
      const event2 = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        anchor.dispatchEvent(event2);
      });
      expect(result.current.isPromptOpen).toBe(true);

      act(() => {
        result.current.confirmLeave();
      });
      expect(result.current.isPromptOpen).toBe(false);
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('should support clicking nested child elements of an anchor', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(true));

      const anchor = document.createElement('a');
      anchor.href = '/settings';
      const child = document.createElement('span');
      child.textContent = 'Nested Text';
      anchor.appendChild(child);
      document.body.appendChild(anchor);

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });

      act(() => {
        child.dispatchEvent(event);
      });

      expect(result.current.isPromptOpen).toBe(true);
    });

    it('should not intercept if target is not _self', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(true));

      const anchor = document.createElement('a');
      anchor.href = '/settings';
      anchor.target = '_blank';
      document.body.appendChild(anchor);

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        anchor.dispatchEvent(event);
      });

      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(result.current.isPromptOpen).toBe(false);
    });

    it('should not intercept if download attribute is present', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(true));

      const anchor = document.createElement('a');
      anchor.href = '/report.pdf';
      anchor.setAttribute('download', 'report.pdf');
      document.body.appendChild(anchor);

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        anchor.dispatchEvent(event);
      });

      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(result.current.isPromptOpen).toBe(false);
    });

    it('should not intercept if href starts with # or is missing', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(true));

      const anchor1 = document.createElement('a');
      anchor1.href = '#anchor-section';
      const anchor2 = document.createElement('a');
      document.body.appendChild(anchor1);
      document.body.appendChild(anchor2);

      const event1 = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        anchor1.dispatchEvent(event1);
      });
      expect(result.current.isPromptOpen).toBe(false);

      const event2 = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        anchor2.dispatchEvent(event2);
      });
      expect(result.current.isPromptOpen).toBe(false);
    });

    it('should not intercept if event default is already prevented', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(true));

      const anchor = document.createElement('a');
      anchor.href = '/some-path';
      document.body.appendChild(anchor);

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      event.preventDefault(); // simulated pre-cancelled event

      act(() => {
        anchor.dispatchEvent(event);
      });
      expect(result.current.isPromptOpen).toBe(false);
    });

    it('should not intercept clicks that are not primary left-button click', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(true));

      const anchor = document.createElement('a');
      anchor.href = '/some-path';
      document.body.appendChild(anchor);

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 1,
      }); // middle click
      act(() => {
        anchor.dispatchEvent(event);
      });
      expect(result.current.isPromptOpen).toBe(false);
    });

    it('should not intercept clicks with modifier keys (meta, ctrl, shift, alt)', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(true));

      const anchor = document.createElement('a');
      anchor.href = '/some-path';
      document.body.appendChild(anchor);

      const modifiers = [
        { metaKey: true },
        { ctrlKey: true },
        { shiftKey: true },
        { altKey: true },
      ];

      modifiers.forEach((mod) => {
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          ...mod,
        });
        act(() => {
          anchor.dispatchEvent(event);
        });
        expect(result.current.isPromptOpen).toBe(false);
      });
    });

    it('should not intercept cross-domain (external) links', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(true));

      const anchor = document.createElement('a');
      anchor.href = 'https://external-domain.com/landing';
      document.body.appendChild(anchor);

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        anchor.dispatchEvent(event);
      });
      expect(result.current.isPromptOpen).toBe(false);
    });

    it('should handle malformed href gracefully and not intercept', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(true));

      const anchor = document.createElement('a');
      anchor.setAttribute('href', 'http://:invalid-url');
      document.body.appendChild(anchor);

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        anchor.dispatchEvent(event);
      });
      expect(result.current.isPromptOpen).toBe(false);
    });

    it('should intercept browser back button (popstate), revert layout state, and pop out on confirm', () => {
      const pushStateSpy = vi
        .spyOn(window.history, 'pushState')
        .mockImplementation(() => {});
      const backSpy = vi
        .spyOn(window.history, 'back')
        .mockImplementation(() => {});

      const { result } = renderHook(() => useUnsavedChangesPrompt(true));

      // Dispatch POPSTATE event to trigger interception
      const event = new Event('popstate');
      act(() => {
        window.dispatchEvent(event);
      });

      // Verify page stays by pushState re-push
      expect(pushStateSpy).toHaveBeenCalledWith(null, '', window.location.href);
      expect(result.current.isPromptOpen).toBe(true);

      // If user clicks "Cancel"
      act(() => {
        result.current.cancelLeave();
      });
      expect(result.current.isPromptOpen).toBe(false);
      expect(backSpy).not.toHaveBeenCalled();

      // Dispatch POPSTATE again to test confirm
      act(() => {
        window.dispatchEvent(event);
      });
      expect(result.current.isPromptOpen).toBe(true);

      // If user clicks "Confirm"
      act(() => {
        result.current.confirmLeave();
      });

      expect(result.current.isPromptOpen).toBe(false);
      expect(backSpy).toHaveBeenCalledTimes(1);

      // Simulate back firing popstate again - should NOT intercept this time
      pushStateSpy.mockClear();
      act(() => {
        window.dispatchEvent(event);
      });
      expect(pushStateSpy).not.toHaveBeenCalled();
      expect(result.current.isPromptOpen).toBe(false);
    });

    it('should guard programmatic actions via guardNavigate', () => {
      const { result } = renderHook(() => useUnsavedChangesPrompt(true));
      const action = vi.fn();

      act(() => {
        result.current.guardNavigate(action);
      });

      expect(action).not.toHaveBeenCalled();
      expect(result.current.isPromptOpen).toBe(true);

      act(() => {
        result.current.confirmLeave();
      });

      expect(action).toHaveBeenCalledTimes(1);
      expect(result.current.isPromptOpen).toBe(false);
    });
  });

  describe('Dynamic transitions of the when state', () => {
    it('should handle transition from clean to dirty to saving', () => {
      const { result, rerender } = renderHook(
        ({ when }) => useUnsavedChangesPrompt(when),
        {
          initialProps: { when: false },
        }
      );

      expect(result.current.isPromptOpen).toBe(false);

      // transition to dirty (when = true)
      rerender({ when: true });

      const event = new Event('beforeunload') as BeforeUnloadEvent;
      Object.defineProperty(event, 'returnValue', {
        value: true,
        writable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      act(() => {
        window.dispatchEvent(event);
      });
      expect(preventDefaultSpy).toHaveBeenCalled();

      // transition to saving/clean (when = false)
      rerender({ when: false });

      const event2 = new Event('beforeunload') as BeforeUnloadEvent;
      const preventDefaultSpy2 = vi.spyOn(event2, 'preventDefault');
      act(() => {
        window.dispatchEvent(event2);
      });
      expect(preventDefaultSpy2).not.toHaveBeenCalled();
    });
  });
});
