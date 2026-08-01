// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SecureSetupWizard } from "../../src/features/setup/secure-setup-wizard";

describe("secure setup wizard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("guides a first-time user through privacy, vault, upload, recovery, CLI, and finish steps", async () => {
    render(<SecureSetupWizard />);

    expect(screen.getByRole("heading", { name: "Secure Setup Wizard" })).toBeVisible();
    expect(screen.getByText("Step 1 of 6")).toBeVisible();
    expect(screen.getByRole("heading", { name: "What this protects" })).toBeVisible();
    expect(screen.getByText(/What this does/)).toBeVisible();
    expect(screen.getByText(/How to use it/)).toBeVisible();
    expect(screen.getByText(/Security checklist/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Next: Create your vault" }));
    expect(screen.getByText("Step 2 of 6")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Create your vault" })).toBeVisible();
    expect(screen.getByText(/Do not paste a private key into this website/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Next: Upload a test file" }));
    expect(screen.getByRole("heading", { name: "Upload a test file" })).toBeVisible();
    expect(screen.getByText(/Plaintext file bytes stay in your browser/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Next: Save recovery files" }));
    expect(screen.getByRole("heading", { name: "Save recovery files" })).toBeVisible();
    expect(screen.getByText(/The recovery kit is the file the CLI reads locally/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Next: Practice CLI restore" }));
    expect(screen.getByRole("heading", { name: "Practice CLI restore" })).toBeVisible();
    expect(screen.getAllByText(/Replace <file-id>/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Next: Finish setup" }));
    expect(screen.getByRole("heading", { name: "Finish setup" })).toBeVisible();
    expect(
      screen
        .getAllByRole("link", { name: "Go to Dashboard" })
        .some((link) => link.getAttribute("href") === "/app"),
    ).toBe(true);
  });

  it("copies CLI commands with visible feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<SecureSetupWizard initialStepId="cli" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Copy import recovery kit command" }),
    );

    expect(writeText).toHaveBeenCalledWith(
      "node ./private-rollup-cli.mjs recovery import ./recovery-kit.json",
    );
    expect(await screen.findByText("Copied")).toBeVisible();
  });
});
