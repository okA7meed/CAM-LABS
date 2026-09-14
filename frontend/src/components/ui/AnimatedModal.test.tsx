import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { screen, fireEvent } from '@testing-library/dom';
import { AnimatedModal } from './AnimatedModal';

afterEach(() => {
  document.body.innerHTML = '';
});

function render(element: React.ReactElement): Root {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return root;
}

describe('AnimatedModal', () => {
  it('renders the dialog role with the expected accessible name when open', () => {
    render(
      <AnimatedModal open role="dialog" ariaLabel="Test modal">
        <p>Content</p>
      </AnimatedModal>,
    );
    expect(screen.getByRole('dialog', { name: 'Test modal' })).toBeInTheDocument();
  });

  it('sets aria-modal on the overlay when a role is provided', () => {
    render(
      <AnimatedModal open role="dialog">
        <p>Content</p>
      </AnimatedModal>,
    );
    const overlay = screen.getByRole('dialog');
    expect(overlay).toHaveAttribute('aria-modal', 'true');
  });

  it('omits aria-modal when no role is supplied', () => {
    render(
      <AnimatedModal open>
        <p>Content</p>
      </AnimatedModal>,
    );
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toHaveAttribute('aria-modal');
  });

  it('exposes the declared accessible label', () => {
    render(
      <AnimatedModal open ariaLabel="Upload details">
        <p>Content</p>
      </AnimatedModal>,
    );
    expect(screen.getByLabelText('Upload details')).toBeInTheDocument();
  });

  it('does not expose the dialog when closed', () => {
    render(
      <AnimatedModal open={false} role="dialog" ariaLabel="Hidden modal">
        <p>Content</p>
      </AnimatedModal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('notifies the onOverlayMouseDown handler on overlay mousedown', () => {
    const handleMouseDown = vi.fn();
    render(
      <AnimatedModal open role="dialog" onOverlayMouseDown={handleMouseDown}>
        <p>Content</p>
      </AnimatedModal>,
    );
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(handleMouseDown).toHaveBeenCalledTimes(1);
  });
});