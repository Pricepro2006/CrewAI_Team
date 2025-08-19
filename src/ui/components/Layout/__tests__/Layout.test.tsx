/**
 * Layout Component Test Suite
 * Tests layout component structure and responsiveness
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock Layout component
interface LayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
  className?: string;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  sidebar,
  header,
  footer,
  sidebarCollapsed = false,
  onSidebarToggle,
  className = "",
}) => {
  return (
    <div className={`layout ${className}`} data-testid="layout">
      {header && (
        <header className="layout-header" data-testid="layout-header">
          {header}
          {onSidebarToggle && (
            <button
              onClick={onSidebarToggle}
              data-testid="sidebar-toggle"
              className="sidebar-toggle"
            >
              {sidebarCollapsed ? "☰" : "✕"}
            </button>
          )}
        </header>
      )}
      
      <div className="layout-container" data-testid="layout-container">
        {sidebar && (
          <aside
            className={`layout-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}
            data-testid="layout-sidebar"
          >
            {sidebar}
          </aside>
        )}
        
        <main
          className={`layout-main ${sidebar ? "with-sidebar" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
          data-testid="layout-main"
        >
          {children}
        </main>
      </div>
      
      {footer && (
        <footer className="layout-footer" data-testid="layout-footer">
          {footer}
        </footer>
      )}
    </div>
  );
};

describe("Layout Component", () => {
  it("should render basic layout with children", () => {
    render(
      <Layout>
        <div>Main content</div>
      </Layout>
    );

    expect(screen.getByTestId("layout")).toBeInTheDocument();
    expect(screen.getByTestId("layout-main")).toBeInTheDocument();
    expect(screen.getByText("Main content")).toBeInTheDocument();
  });

  it("should render layout with header", () => {
    render(
      <Layout header={<div>Header content</div>}>
        <div>Main content</div>
      </Layout>
    );

    expect(screen.getByTestId("layout-header")).toBeInTheDocument();
    expect(screen.getByText("Header content")).toBeInTheDocument();
  });

  it("should render layout with sidebar", () => {
    render(
      <Layout sidebar={<div>Sidebar content</div>}>
        <div>Main content</div>
      </Layout>
    );

    expect(screen.getByTestId("layout-sidebar")).toBeInTheDocument();
    expect(screen.getByText("Sidebar content")).toBeInTheDocument();
    expect(screen.getByTestId("layout-main")).toHaveClass("with-sidebar");
  });

  it("should render layout with footer", () => {
    render(
      <Layout footer={<div>Footer content</div>}>
        <div>Main content</div>
      </Layout>
    );

    expect(screen.getByTestId("layout-footer")).toBeInTheDocument();
    expect(screen.getByText("Footer content")).toBeInTheDocument();
  });

  it("should render complete layout with all sections", () => {
    render(
      <Layout
        header={<div>Header</div>}
        sidebar={<div>Sidebar</div>}
        footer={<div>Footer</div>}
      >
        <div>Main content</div>
      </Layout>
    );

    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Sidebar")).toBeInTheDocument();
    expect(screen.getByText("Main content")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("should handle sidebar toggle", () => {
    const onSidebarToggle = vi.fn();
    
    render(
      <Layout
        header={<div>Header</div>}
        sidebar={<div>Sidebar</div>}
        onSidebarToggle={onSidebarToggle}
        sidebarCollapsed={false}
      >
        <div>Main content</div>
      </Layout>
    );

    const toggleButton = screen.getByTestId("sidebar-toggle");
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveTextContent("✕");

    fireEvent.click(toggleButton);
    expect(onSidebarToggle).toHaveBeenCalledTimes(1);
  });

  it("should show correct toggle icon based on collapsed state", () => {
    const { rerender } = render(
      <Layout
        header={<div>Header</div>}
        sidebar={<div>Sidebar</div>}
        onSidebarToggle={() => {}}
        sidebarCollapsed={false}
      >
        <div>Main content</div>
      </Layout>
    );

    expect(screen.getByTestId("sidebar-toggle")).toHaveTextContent("✕");

    rerender(
      <Layout
        header={<div>Header</div>}
        sidebar={<div>Sidebar</div>}
        onSidebarToggle={() => {}}
        sidebarCollapsed={true}
      >
        <div>Main content</div>
      </Layout>
    );

    expect(screen.getByTestId("sidebar-toggle")).toHaveTextContent("☰");
  });

  it("should apply collapsed class to sidebar when collapsed", () => {
    render(
      <Layout
        sidebar={<div>Sidebar</div>}
        sidebarCollapsed={true}
      >
        <div>Main content</div>
      </Layout>
    );

    const sidebar = screen.getByTestId("layout-sidebar");
    expect(sidebar).toHaveClass("collapsed");

    const main = screen.getByTestId("layout-main");
    expect(main).toHaveClass("sidebar-collapsed");
  });

  it("should not show toggle button without onSidebarToggle callback", () => {
    render(
      <Layout
        header={<div>Header</div>}
        sidebar={<div>Sidebar</div>}
      >
        <div>Main content</div>
      </Layout>
    );

    expect(screen.queryByTestId("sidebar-toggle")).not.toBeInTheDocument();
  });

  it("should accept custom className", () => {
    render(
      <Layout className="custom-layout">
        <div>Main content</div>
      </Layout>
    );

    expect(screen.getByTestId("layout")).toHaveClass("custom-layout");
  });

  it("should handle complex children", () => {
    render(
      <Layout>
        <div>
          <h1>Page Title</h1>
          <section>
            <p>Page content</p>
            <button>Action Button</button>
          </section>
        </div>
      </Layout>
    );

    expect(screen.getByText("Page Title")).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action Button" })).toBeInTheDocument();
  });

  it("should maintain proper structure hierarchy", () => {
    render(
      <Layout
        header={<div>Header</div>}
        sidebar={<div>Sidebar</div>}
        footer={<div>Footer</div>}
      >
        <div>Main content</div>
      </Layout>
    );

    const layout = screen.getByTestId("layout");
    const header = screen.getByTestId("layout-header");
    const container = screen.getByTestId("layout-container");
    const footer = screen.getByTestId("layout-footer");

    // Header should be first child
    expect(layout.firstChild).toBe(header);
    // Container should be middle child
    expect(header.nextSibling).toBe(container);
    // Footer should be last child
    expect(container.nextSibling).toBe(footer);
  });

  it("should handle empty sidebar content", () => {
    render(
      <Layout sidebar={null}>
        <div>Main content</div>
      </Layout>
    );

    expect(screen.queryByTestId("layout-sidebar")).not.toBeInTheDocument();
    expect(screen.getByTestId("layout-main")).not.toHaveClass("with-sidebar");
  });

  it("should handle responsive behavior with collapsed sidebar", () => {
    const onSidebarToggle = vi.fn();
    
    const { rerender } = render(
      <Layout
        sidebar={<nav>Navigation</nav>}
        sidebarCollapsed={false}
        onSidebarToggle={onSidebarToggle}
      >
        <div>Main content</div>
      </Layout>
    );

    const sidebar = screen.getByTestId("layout-sidebar");
    const main = screen.getByTestId("layout-main");

    // Initially expanded
    expect(sidebar).not.toHaveClass("collapsed");
    expect(main).not.toHaveClass("sidebar-collapsed");

    // Collapse sidebar
    rerender(
      <Layout
        sidebar={<nav>Navigation</nav>}
        sidebarCollapsed={true}
        onSidebarToggle={onSidebarToggle}
      >
        <div>Main content</div>
      </Layout>
    );

    expect(sidebar).toHaveClass("collapsed");
    expect(main).toHaveClass("sidebar-collapsed");
  });

  it("should handle multiple nested components", () => {
    const HeaderComponent = () => (
      <div>
        <h1>App Title</h1>
        <nav>Navigation</nav>
      </div>
    );

    const SidebarComponent = () => (
      <aside>
        <ul>
          <li>Menu Item 1</li>
          <li>Menu Item 2</li>
        </ul>
      </aside>
    );

    const FooterComponent = () => (
      <div>
        <p>Copyright 2025</p>
      </div>
    );

    render(
      <Layout
        header={<HeaderComponent />}
        sidebar={<SidebarComponent />}
        footer={<FooterComponent />}
      >
        <article>
          <h2>Article Title</h2>
          <p>Article content</p>
        </article>
      </Layout>
    );

    expect(screen.getByText("App Title")).toBeInTheDocument();
    expect(screen.getByText("Menu Item 1")).toBeInTheDocument();
    expect(screen.getByText("Article Title")).toBeInTheDocument();
    expect(screen.getByText("Copyright 2025")).toBeInTheDocument();
  });
});