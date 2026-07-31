// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "../../src/components/app-shell/app-shell";

describe("app shell", () => {
  it("renders authenticated navigation with stable action ids", () => {
    render(
      <AppShell>
        <h1>Dashboard</h1>
      </AppShell>,
    );

    expect(
      screen
        .getAllByRole("link", { name: "Dashboard" })
        .every((link) => link.getAttribute("data-action") === "nav.dashboard"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "Upload" })
        .every((link) => link.getAttribute("data-action") === "nav.upload"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "Packs" })
        .every((link) => link.getAttribute("data-action") === "nav.packs"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "Recovery" })
        .every((link) => link.getAttribute("data-action") === "nav.recovery"),
    ).toBe(true);
    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { name: "Dashboard" }),
    );
  });
});
