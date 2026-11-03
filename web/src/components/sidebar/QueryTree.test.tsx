import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeNode } from "@shared/types";
import { QueryTree } from "./QueryTree";
import { api, ApiError } from "@/api/client";

const tree: TreeNode[] = [
  {
    type: "folder",
    name: "Phones",
    path: "Phones",
    children: [{ type: "query", name: "Phones_with_DN", path: "Phones/Phones_with_DN", description: "DN per phone" }],
  },
  { type: "query", name: "Show_Nodes", path: "Show_Nodes" },
];

beforeEach(() => {
  vi.restoreAllMocks();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

function setup(overrides: Partial<React.ComponentProps<typeof QueryTree>> = {}) {
  const props = {
    tree,
    selectedPath: null,
    onOpen: vi.fn(),
    onChanged: vi.fn(),
    onDeleted: vi.fn(),
    ...overrides,
  };
  render(<QueryTree {...props} />);
  return props;
}

const rowNames = () => screen.getAllByTestId("tree-row").map((r) => r.getAttribute("data-path"));

describe("QueryTree", () => {
  it("renders folders before queries", () => {
    setup();
    expect(rowNames()).toEqual(["Phones", "Show_Nodes"]);
  });

  it("opens a query on click", async () => {
    const props = setup();
    await userEvent.click(screen.getByText("Show_Nodes"));
    expect(props.onOpen).toHaveBeenCalledWith("Show_Nodes");
  });

  it("filter shows matching nested query and its folder", async () => {
    setup();
    await userEvent.type(screen.getByPlaceholderText("Filter queries"), "per phone");
    expect(rowNames()).toEqual(["Phones", "Phones/Phones_with_DN"]);
  });

  it("rename onto existing shows already exists", async () => {
    vi.spyOn(api, "moveQuery").mockRejectedValue(new ApiError(409, '"Phones/Taken" already exists', "exists"));
    const props = setup();
    await userEvent.click(screen.getByText("Phones"));
    await userEvent.click(screen.getByRole("button", { name: "Actions for Phones_with_DN" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Rename/ }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "Taken");
    await userEvent.click(within(dialog).getByRole("button", { name: "Rename" }));
    expect(await within(dialog).findByText(/already exists/)).toBeInTheDocument();
    expect(api.moveQuery).toHaveBeenCalledWith("Phones/Phones_with_DN", "Phones/Taken");
    expect(props.onChanged).not.toHaveBeenCalled();
  });

  it("folder delete confirm shows query count", async () => {
    vi.spyOn(api, "countQueries").mockResolvedValue({ count: 1 });
    const del = vi.spyOn(api, "deleteQuery").mockResolvedValue({ deleted: ["Phones/Phones_with_DN"] });
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: "Actions for Phones" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/Delete folder "Phones" and 1 query\?/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("Phones"));
    expect(props.onDeleted).toHaveBeenCalledWith(["Phones/Phones_with_DN"]);
    expect(props.onChanged).toHaveBeenCalled();
  });
});
