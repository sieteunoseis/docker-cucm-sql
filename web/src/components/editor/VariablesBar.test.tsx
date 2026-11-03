import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VariablesBar } from "./VariablesBar";

describe("VariablesBar", () => {
  it("renders nothing without variables", () => {
    const { container } = render(<VariablesBar sql="select 1" values={{}} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks empty required var and shows default as value", () => {
    render(<VariablesBar sql="where a = :dn and b = :pt=Internal" values={{}} onChange={() => {}} />);
    expect(screen.getByLabelText(":dn")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(":pt")).toHaveValue("Internal");
    expect(screen.getByLabelText(":pt")).toHaveAttribute("aria-invalid", "false");
  });

  it("URL var prefills input", () => {
    render(<VariablesBar sql="where a = :dn" values={{ dn: "1234" }} onChange={() => {}} />);
    expect(screen.getByLabelText(":dn")).toHaveValue("1234");
  });

  it("reports edits", async () => {
    const onChange = vi.fn();
    render(<VariablesBar sql="where a = :dn" values={{}} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(":dn"), "7");
    expect(onChange).toHaveBeenLastCalledWith({ dn: "7" });
  });
});
