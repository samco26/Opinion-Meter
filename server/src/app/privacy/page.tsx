export const metadata = { title: "Privacy · Opinion Meter" };

export default function Privacy() {
  return (
    <main className="page">
      <section className="glass page-card prose">
        <h1>Privacy</h1>
        <p>Opinion Meter is a browser extension that shows what people think of the things in your search results. This page says exactly what it sends and keeps.</p>
        <h2>What the extension sends</h2>
        <p>On Google search result pages only: the titles and addresses of the results on the page and the words you searched for. Nothing from any other page, ever. No page content, no cookies, no account details, no browsing history.</p>
        <p>Each install makes a random token so the server can limit how often one copy asks. The token identifies an install, not a person, and is never linked to an account.</p>
        <h2>What the server keeps</h2>
        <p>The server keeps only what it works out: the split of opinion, the count, the summary sentence and links to the public posts it read, for up to 24 hours per subject. It does not keep the posts themselves. The quotes shown when you open a subject are fetched live, so a post deleted on its platform disappears from Opinion Meter at once.</p>
        <p>Request records used to prevent abuse are kept for at most 7 days and contain the install token and the time of the request, not the search.</p>
        <h2>Where the opinions come from</h2>
        <p>Public posts and comments read through the official interfaces of Reddit, YouTube, Hacker News and Bluesky, within the limits each platform sets. The text of those posts is sent to an AI model to be classified and summarised; usernames are not. Nothing is used to train any model.</p>
        <h2>What is never a subject</h2>
        <p>Named individuals. Opinion Meter reads opinion about products, films, apps, places, companies and articles, never about a person.</p>
        <h2>Contact</h2>
        <p>Questions about this page: open an issue on the project&apos;s GitHub repository.</p>
      </section>
    </main>
  );
}
