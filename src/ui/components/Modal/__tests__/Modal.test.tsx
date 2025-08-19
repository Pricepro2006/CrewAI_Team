/**
 * Modal Component Test Suite
 * Tests modal functionality and accessibility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock Modal component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "small" | "medium" | "large";
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "medium",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = "",
}) => {
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      if (document?.body?.style) {
        document.body.style.overflow = "hidden";
      }
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      if (document?.body?.style) {
        document.body.style.overflow = "unset";
      }
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="modal-overlay"
      data-testid="modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div 
        className={`modal-content modal-${size} ${className}`}
        data-testid="modal-content"
        onClick={(e: any) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="modal-header" data-testid="modal-header">
            {title && (
              <h2 id="modal-title" data-testid="modal-title">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                data-testid="modal-close-button"
                className="modal-close-button"
                aria-label="Close modal"
              >
                ✕
              </button>
            )}
          </div>
        )}
        
        <div className="modal-body" data-testid="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

describe("Modal Component", () => {
  it("should render modal when isOpen is true", () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.getByTestId("modal-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("modal-content")).toBeInTheDocument();
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("should not render modal when isOpen is false", () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.queryByTestId("modal-overlay")).not.toBeInTheDocument();
  });

  it("should render modal with title", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.getByTestId("modal-title")).toHaveTextContent("Test Modal");
    expect(screen.getByTestId("modal-header")).toBeInTheDocument();
  });

  it("should render close button by default", () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.getByTestId("modal-close-button")).toBeInTheDocument();
  });

  it("should hide close button when showCloseButton is false", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} showCloseButton={false}>
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.queryByTestId("modal-close-button")).not.toBeInTheDocument();
  });

  it("should call onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Modal content</p>
      </Modal>
    );

    fireEvent.click(screen.getByTestId("modal-close-button"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when overlay is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} closeOnOverlayClick={true}>
        <p>Modal content</p>
      </Modal>
    );

    fireEvent.click(screen.getByTestId("modal-overlay"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should not close when overlay is clicked if closeOnOverlayClick is false", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} closeOnOverlayClick={false}>
        <p>Modal content</p>
      </Modal>
    );

    fireEvent.click(screen.getByTestId("modal-overlay"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("should not close when modal content is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Modal content</p>
      </Modal>
    );

    fireEvent.click(screen.getByTestId("modal-content"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("should call onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} closeOnEscape={true}>
        <p>Modal content</p>
      </Modal>
    );

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should not close on Escape when closeOnEscape is false", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} closeOnEscape={false}>
        <p>Modal content</p>
      </Modal>
    );

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("should render different sizes", () => {
    const sizes = ["small", "medium", "large"] as const;

    sizes.forEach((size: any) => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={() => {}} size={size}>
          {size} modal
        </Modal>
      );

      expect(screen.getByTestId("modal-content")).toHaveClass(`modal-${size}`);

      rerender(<div />); // Clear for next iteration
    });
  });

  it("should accept custom className", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} className="custom-modal">
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.getByTestId("modal-content")).toHaveClass("custom-modal");
  });

  it("should have proper accessibility attributes", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Accessible Modal">
        <p>Modal content</p>
      </Modal>
    );

    const overlay = screen.getByTestId("modal-overlay");
    expect(overlay).toHaveAttribute("role", "dialog");
    expect(overlay).toHaveAttribute("aria-modal", "true");
    expect(overlay).toHaveAttribute("aria-labelledby", "modal-title");

    const closeButton = screen.getByTestId("modal-close-button");
    expect(closeButton).toHaveAttribute("aria-label", "Close modal");
  });

  it("should not have aria-labelledby when no title is provided", () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    );

    const overlay = screen.getByTestId("modal-overlay");
    expect(overlay).not.toHaveAttribute("aria-labelledby");
  });

  it("should prevent body scroll when modal is open", () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    );

    expect(document?.body?.style.overflow).toBe("hidden");

    rerender(
      <Modal isOpen={false} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    );

    expect(document?.body?.style.overflow).toBe("unset");
  });

  it("should clean up event listeners when unmounted", () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Modal content</p>
      </Modal>
    );

    unmount();

    // Try to trigger escape after unmount
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
    expect(document?.body?.style.overflow).toBe("unset");
  });

  it("should handle complex modal content", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Complex Modal">
        <div>
          <h3>Section Title</h3>
          <form>
            <input type="text" placeholder="Name" />
            <input type="email" placeholder="Email" />
            <button type="submit">Submit</button>
          </form>
          <div>
            <button>Cancel</button>
            <button>Save</button>
          </div>
        </div>
      </Modal>
    );

    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("should handle modal state changes properly", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen={false} onClose={onClose}>
        <p>Modal content</p>
      </Modal>
    );

    // Initially closed
    expect(screen.queryByTestId("modal-overlay")).not.toBeInTheDocument();

    // Open modal
    rerender(
      <Modal isOpen={true} onClose={onClose}>
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.getByTestId("modal-overlay")).toBeInTheDocument();

    // Close modal
    rerender(
      <Modal isOpen={false} onClose={onClose}>
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.queryByTestId("modal-overlay")).not.toBeInTheDocument();
  });

  it("should handle multiple key events correctly", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} closeOnEscape={true}>
        <p>Modal content</p>
      </Modal>
    );

    // Test other keys don't trigger close
    fireEvent.keyDown(document, { key: "Enter", code: "Enter" });
    fireEvent.keyDown(document, { key: "Space", code: "Space" });
    fireEvent.keyDown(document, { key: "Tab", code: "Tab" });

    expect(onClose).not.toHaveBeenCalled();

    // Test Escape does trigger close
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});