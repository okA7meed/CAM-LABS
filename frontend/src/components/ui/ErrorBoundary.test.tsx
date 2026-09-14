import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { screen, fireEvent } from '@testing-library/dom';
import { ErrorBoundary } from './ErrorBoundary';

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

describe('ErrorBoundary', () => {
  it('shows the provided fallback instead of unmounting the whole tree', () => {
    const Boom: React.FC = () => { throw new Error('boom'); };
    render(
      <ErrorBoundary fallback={(error, retry) => (
        <div role="alert">
          <p>{error.message}</p>
          <button onClick={retry}>Retry</button>
        </div>
      )}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });

  it('remounts children via the retry button when the failure is transient', () => {
    let shouldThrow = true;
    const Bomb: React.FC = () => {
      if (shouldThrow) throw new Error('transient');
      return <p>recovered</p>;
    };
    render(
      <ErrorBoundary fallback={(error, retry) => (
        <div role="alert">
          <p>{error.message}</p>
          <button onClick={retry}>Retry</button>
        </div>
      )}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    shouldThrow = false;
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('renders an accessible default fallback with a retry control', () => {
    const Boom: React.FC = () => { throw new Error('default'); };
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong in this section.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('reports the error through onError for scoped diagnostics', () => {
    const onError = vi.fn();
    const Boom: React.FC = () => { throw new Error('reported'); };
    render(<ErrorBoundary onError={onError}><Boom /></ErrorBoundary>);
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('leaves healthy subtrees untouched', () => {
    render(
      <ErrorBoundary fallback={() => <div role="alert">failed</div>}>
        <p>healthy</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('healthy')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});