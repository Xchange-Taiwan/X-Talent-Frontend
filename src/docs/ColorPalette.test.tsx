import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ColorPalette, hslToHex } from './ColorPalette';

// Mock clipboard API
const mockWriteText = vi.fn().mockImplementation(() => Promise.resolve());
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
  },
  writable: true,
});

describe('ColorPalette Component', () => {
  it('renders search input and grid/list view buttons', () => {
    render(<ColorPalette />);

    // Check search input exists
    expect(screen.getByPlaceholderText(/搜尋顏色/)).toBeInTheDocument();

    // Check Grid and List view buttons exist
    expect(screen.getByText(/格狀檢視/)).toBeInTheDocument();
    expect(screen.getByText(/列表檢視/)).toBeInTheDocument();
  });

  it('renders all core color groups by default', () => {
    render(<ColorPalette />);

    expect(screen.getByText(/Brand Colors/)).toBeInTheDocument();
    expect(screen.getByText(/Gray Scale/)).toBeInTheDocument();
    expect(screen.getByText(/Text System/)).toBeInTheDocument();
    expect(screen.getByText(/Background System/)).toBeInTheDocument();
    expect(screen.getByText(/Status Colors/)).toBeInTheDocument();
  });

  it('filters colors dynamically when typing in search input', () => {
    render(<ColorPalette />);

    const searchInput = screen.getByPlaceholderText(/搜尋顏色/);

    // Type a specific token query (e.g. brand-500)
    fireEvent.change(searchInput, { target: { value: 'brand-500' } });

    // Brand Colors should still be visible
    expect(screen.getByText(/Brand Colors/)).toBeInTheDocument();

    // Gray Scale should be hidden because it has no match for 'brand-500'
    expect(screen.queryByText(/Gray Scale/)).not.toBeInTheDocument();
  });

  it('displays fallback message when no search results are found', () => {
    render(<ColorPalette />);

    const searchInput = screen.getByPlaceholderText(/搜尋顏色/);

    // Type a query with no matches
    fireEvent.change(searchInput, {
      target: { value: 'nonexistent-color-token-xyz' },
    });

    expect(screen.getByText(/沒有找到符合/)).toBeInTheDocument();
  });

  it('allows switching to list view', () => {
    render(<ColorPalette />);

    const listViewButton = screen.getByText(/列表檢視/);
    fireEvent.click(listViewButton);

    // Check list view headers exist
    expect(screen.getAllByText(/名稱 & KEY/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/CSS 變數/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/HSL 原生值/)[0]).toBeInTheDocument();
  });

  it('allows copying color HEX on clicking color block in grid view', async () => {
    render(<ColorPalette />);

    // Click to copy the Brand 50 color
    const brand50Block = screen.getAllByTitle('點擊複製 HEX 值')[0];
    fireEvent.click(brand50Block);

    // Clipboard API should have been called with the brand-50 hex color
    expect(mockWriteText).toHaveBeenCalledWith('#EAFAFA');
  });

  it('handles clipboard copy error gracefully', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockWriteText.mockRejectedValueOnce(new Error('Permission denied'));

    render(<ColorPalette />);

    // Click to copy the Brand 50 color
    const brand50Block = screen.getAllByTitle('點擊複製 HEX 值')[0];
    fireEvent.click(brand50Block);

    // Wait for the async call to be processed
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to copy to clipboard:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});

describe('hslToHex Utility Function', () => {
  it('converts standard HSL string to HEX perfectly', () => {
    // Red (Hue 0)
    expect(hslToHex('0 100% 50%')).toBe('#FF0000');

    // Yellow (Hue 60)
    expect(hslToHex('60 100% 50%')).toBe('#FFFF00');

    // Green (Hue 120)
    expect(hslToHex('120 100% 50%')).toBe('#00FF00');

    // Cyan (Hue 180)
    expect(hslToHex('180 100% 50%')).toBe('#00FFFF');

    // Blue (Hue 240)
    expect(hslToHex('240 100% 50%')).toBe('#0000FF');

    // Magenta (Hue 300)
    expect(hslToHex('300 100% 50%')).toBe('#FF00FF');
  });

  it('handles hue=360 and wrapping correctly', () => {
    // Hue 360 is mathematically equivalent to 0 (Red)
    expect(hslToHex('360 100% 50%')).toBe('#FF0000');
    expect(hslToHex('720 100% 50%')).toBe('#FF0000');
  });

  it('returns black fallback for invalid or empty HSL values', () => {
    expect(hslToHex('')).toBe('#000000');
    expect(hslToHex('180')).toBe('#000000');
  });
});
