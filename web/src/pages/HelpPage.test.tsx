import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelpPage } from "./HelpPage";
import { Header } from "@/components/layout/Header";

describe("HelpPage", () => {
  it("covers the main topics with linkable sections", () => {
    render(
      <MemoryRouter>
        <HelpPage />
      </MemoryRouter>,
    );
    for (const id of ["variables", "links", "shortcuts", "large-results", "saved-queries", "api"]) {
      expect(document.getElementById(id)).toBeInTheDocument();
    }
    expect(screen.getAllByText(/:name=default/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /API docs/ })).toHaveAttribute("href", "/api/docs");
  });

  it("is in the header nav", () => {
    render(
      <MemoryRouter initialEntries={["/help"]}>
        <Header />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
  });
});
