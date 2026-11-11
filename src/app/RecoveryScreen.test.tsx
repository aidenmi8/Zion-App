// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { PluginManager } from "../plugins/manager";
import { RecoveryScreen } from "./RecoveryScreen";

afterEach(cleanup);

it.each([false, true])(
  "keeps recovery actions intact with Zion wording (reset allowed: %s)",
  async (canReset) => {
    const retry = vi.fn();
    const recover = vi.fn();
    const state = {
      configuration: {
        status: "recovery",
        reason: "Synthetic read failure",
        canReset,
      },
      busy: false,
      error: undefined,
    };
    const plugins = {
      subscribe: () => () => {},
      snapshot: () => state,
      retry,
      recover,
    } as unknown as PluginManager;
    render(<RecoveryScreen plugins={plugins} />);
    expect(
      screen.getByRole("heading", { name: "Couldn’t open Zion" }),
    ).toBeVisible();
    expect(screen.queryByText(/Buzz/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    if (canReset) {
      await userEvent.click(
        screen.getByRole("button", { name: "Back up & reset settings" }),
      );
      expect(recover).toHaveBeenCalledOnce();
    } else {
      expect(
        screen.queryByRole("button", { name: "Back up & reset settings" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/restart Zion/)).toBeVisible();
    }
  },
);
