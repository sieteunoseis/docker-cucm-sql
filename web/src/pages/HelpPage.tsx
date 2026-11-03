import { Link } from "react-router-dom";

const SECTIONS = [
  { id: "variables", title: "Variables" },
  { id: "links", title: "Links to queries" },
  { id: "shortcuts", title: "Keyboard shortcuts" },
  { id: "large-results", title: "Large results" },
  { id: "saved-queries", title: "Saved queries" },
  { id: "api", title: "Run queries from scripts" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-2">
      <h2 className="text-base font-semibold">
        <a href={`#${id}`} className="hover:underline">
          {title}
        </a>
      </h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">{children}</div>
    </section>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">{children}</code>
);

const Block = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs text-foreground">{children}</pre>
);

export function HelpPage() {
  return (
    <div className="flex gap-10">
      <nav className="sticky top-6 hidden w-48 shrink-0 self-start text-sm md:block" aria-label="Help sections">
        <ul className="space-y-1">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-muted-foreground hover:text-foreground">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="max-w-3xl space-y-8">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Help</h1>
          <p className="text-sm text-muted-foreground">
            Write SQL, run it on one or more CUCM clusters, and save it as a <Code>.sql</Code> file the whole team can use.
            Queries are read-only: AXL's <Code>executeSQLQuery</Code> only runs <Code>SELECT</Code>.
          </p>
        </div>

        <Section id="variables" title="Variables">
          <p>
            Put <Code>:name</Code> or <Code>:name=default</Code> in a query. Each one gets an input in the{" "}
            <strong>Variables</strong> bar under the editor, filled in with its default.
          </p>
          <Block>{"SELECT d.name, n.dnorpattern\nFROM device d, devicenumplanmap m, numplan n\nWHERE d.pkid = m.fkdevice AND m.fknumplan = n.pkid\n  AND n.dnorpattern LIKE :pattern=1234%"}</Block>
          <ul className="list-disc space-y-1 pl-5">
            <li>A default ends at a space, comma or <Code>)</Code>. Defaults are saved with the query.</li>
            <li>
              <strong>Run</strong> stays disabled until every variable without a default has a value.
            </li>
            <li>
              Values are always sent quoted (<Code>'value'</Code>). Informix converts them for comparisons with number
              columns, but not where a bare number is required, such as <Code>FIRST :n</Code>.
            </li>
            <li>
              <Code>::INTEGER</Code> casts and anything inside quotes are not treated as variables.
            </li>
          </ul>
        </Section>

        <Section id="links" title="Links to queries">
          <p>Every saved query has its own link. You can add options to it:</p>
          <table className="w-full text-left text-xs">
            <tbody className="[&_td]:border-b [&_td]:border-border [&_td]:py-1.5 [&_td]:pr-4">
              <tr>
                <td><Code>/q/Phones/Phones_with_DN</Code></td>
                <td>opens the query</td>
              </tr>
              <tr>
                <td><Code>?cluster=brb,lab</Code></td>
                <td>selects clusters by id: the cluster's name in lowercase, with dashes for spaces and dots</td>
              </tr>
              <tr>
                <td><Code>?pattern=5551%25</Code></td>
                <td>fills in a variable (<Code>%25</Code> is a URL-encoded <Code>%</Code>)</td>
              </tr>
              <tr>
                <td><Code>?run=1</Code></td>
                <td>runs it as soon as it opens</td>
              </tr>
            </tbody>
          </table>
          <p>
            <strong>Copy link</strong> builds the link for you from the open query, the selected clusters and any variable
            values you changed. Unsaved SQL can't be linked, so save it first.
          </p>
        </Section>

        <Section id="shortcuts" title="Keyboard shortcuts">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <Code>Ctrl/Cmd + Enter</Code> runs the query
            </li>
            <li>
              <Code>Ctrl/Cmd + S</Code> saves it
            </li>
            <li>
              <Code>Ctrl/Cmd + K</Code> opens search: jump to any saved query or action
            </li>
            <li>
              Type <Code>table.</Code> or an alias (<Code>d.</Code> after <Code>from device d</Code>) to get column suggestions
            </li>
          </ul>
        </Section>

        <Section id="large-results" title="Large results">
          <p>
            UCM refuses any response over 8 MB and only reports how many rows matched. You'll see{" "}
            <strong>Too large for one request</strong> with a button to fetch the result in batches.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Batching only starts when you click it, and you can cancel it.</li>
            <li>
              There's a limit on batches per fetch (200 by default). The button says up front if the limit will cut the
              result short.
            </li>
            <li>
              Add an <Code>ORDER BY</Code> to the query so no rows are skipped or repeated between batches.
            </li>
            <li>
              A query with a top-level <Code>UNION</Code>, or one that already uses <Code>SKIP</Code>/<Code>FIRST</Code>, can't
              be batched. Narrow it with a <Code>WHERE</Code> clause instead.
            </li>
          </ul>
        </Section>

        <Section id="saved-queries" title="Saved queries">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Each query is a plain <Code>.sql</Code> file. Folders in the list are folders on disk.
            </li>
            <li>
              Use the <strong>⋯</strong> menu on a query or folder to rename, move, duplicate, copy a link or delete it.
            </li>
            <li>
              When you name a query, spaces and the characters <Code>\ ? % * : | " &lt; &gt;</Code> become <Code>_</Code>.
            </li>
            <li>
              A first line <Code>-- description: …</Code> shows under the name in the list.
            </li>
            <li>Saving under a name that's already taken asks before replacing it.</li>
            <li>
              Deletes are permanent, but the <Link to="/log" className="underline">Log</Link> keeps the SQL of deleted and
              replaced queries. Use <strong>Restore</strong> there to open it again.
            </li>
          </ul>
        </Section>

        <Section id="api" title="Run queries from scripts">
          <p>
            Any saved query can be run with a URL and returned as JSON or CSV. URL options other than <Code>cluster</Code> and{" "}
            <Code>format</Code> fill in variables.
          </p>
          <Block>{`curl -H "Authorization: Bearer $API_KEY" \\\n  "${window.location.origin}/api/run/Phones/Phones_with_DN?pattern=5551%25&format=csv"`}</Block>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <Code>400</Code> lists missing variables, <Code>404</Code> means no saved query has that name, and{" "}
              <Code>413</Code> means the result is over UCM's 8 MB limit.
            </li>
            <li>Calls from scripts show in the Log with source "api".</li>
            <li>
              All endpoints are described in the{" "}
              <a href="/api/docs" className="underline">
                API docs
              </a>
              .
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
