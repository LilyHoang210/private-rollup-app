// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardPage from "../../src/app/app/page";

describe("dashboard content", () => {
  it("does not show demo pack data before real user data exists", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: "Dashboard Overview" })).toBeVisible();
    expect(screen.getByText("No live packs yet")).toBeVisible();
    expect(
      screen
        .getAllByRole("link", { name: "Start setup" })
        .every((link) => link.getAttribute("href") === "/app/setup"),
    ).toBe(true);
    expect(screen.queryByText("Alpha-Genesis-92")).not.toBeInTheDocument();
    expect(screen.queryByText("Beta-Storage-04")).not.toBeInTheDocument();
    expect(screen.queryByText("1,048")).not.toBeInTheDocument();
  });
});
