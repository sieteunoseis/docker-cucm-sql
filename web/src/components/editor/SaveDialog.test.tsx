import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/api/client";
import { SaveDialog } from "./SaveDialog";

describe("SaveDialog", () => {
  it("asks before overwriting an existing query", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(409, '"Get_All_Devices" already exists', "exists"))
      .mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    render(<SaveDialog tree={[]} initialFolder="" onSave={onSave} onClose={onClose} />);
    await userEvent.type(screen.getByPlaceholderText("Phones_with_DN"), "Get_All_Devices");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenLastCalledWith("Get_All_Devices", false);
    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Overwrite" }));
    expect(onSave).toHaveBeenLastCalledWith("Get_All_Devices", true);
    expect(onClose).toHaveBeenCalled();
  });
});
