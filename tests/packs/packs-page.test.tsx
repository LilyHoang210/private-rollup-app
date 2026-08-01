// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PacksPage from "../../src/app/app/packs/page";

describe("packs page", () => {
  it("shows an empty state instead of demo pack fixtures", () => {
    render(<PacksPage />);

    expect(screen.getByRole("heading", { name: "Pack Participation" })).toBeVisible();
    expect(screen.getByText("No pack participation yet")).toBeVisible();
    expect(screen.getByRole("link", { name: "Upload a test file" })).toHaveAttribute(
      "href",
      "/app/upload",
    );
    expect(screen.queryByText("Alpha-Genesis-92")).not.toBeInTheDocument();
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
  });
});
