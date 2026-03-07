export function formatEmailHtml(digest: string, locations?: string[]): string {
  function md(text: string): string {
    return text
      .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");
  }

  const lines = digest.split("\n");
  const htmlLines = lines.map((line) => {
    if (line.startsWith("##")) return `<h2 style="color:#e2e8f0;margin:24px 0 8px">${md(line.replace(/^#+\s*/, ""))}</h2>`;
    if (line.startsWith("#")) return `<h1 style="color:#f8fafc;margin:0 0 16px">${md(line.replace(/^#+\s*/, ""))}</h1>`;
    if (line.match(/^[-*]\s/)) return `<li style="margin:4px 0;color:#cbd5e1">${md(line.replace(/^[-*]\s/, ""))}</li>`;
    if (line.trim() === "") return "<br/>";
    return `<p style="margin:4px 0;color:#cbd5e1">${md(line)}</p>`;
  });

  const subtitle = locations
    ? `Locations: ${locations.join(", ")} &nbsp;·&nbsp; Last 7 days`
    : `Last 7 days &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`;

  const title = locations ? "Job Scout Results" : "Job Scout — Daily Digest";

  return `
    <div style="font-family:system-ui,sans-serif;background:#0f172a;padding:32px;border-radius:12px;max-width:700px;margin:0 auto">
      <div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #1e293b">
        <h1 style="color:#f8fafc;margin:0 0 4px;font-size:22px">${title}</h1>
        <p style="color:#64748b;margin:0;font-size:14px">${subtitle}</p>
      </div>
      ${htmlLines.join("\n")}
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
        Sent by Job Scout · <a href="https://www.bengredev.com/ai-lab/job-search-agent" style="color:#3b82f6">${locations ? "Run another search" : "Run a custom search"}</a>
      </div>
    </div>
  `;
}