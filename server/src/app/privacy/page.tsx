export const metadata = { title: "Privacy · Opinion Meter" };

export default function Privacy() {
  return (
    <main className="page">
      <section className="glass page-card prose">
        <h1>Privacy</h1>
        <p>Opinion Meter is a browser extension that shows what people think of the things in your search results, of the sites you visit, and — when you ask — of the subject of the page you are on. This page says exactly what it sends and keeps.</p>
        <h2>What the extension sends</h2>
        <p><strong>On Google search result pages:</strong> the titles and addresses of the results on the page and the words you searched for. This includes sponsored results, shopping tiles and AI Overview reference links. Opening a result&apos;s card resends that one result&apos;s title and address and the original query to recover the reading if necessary.</p>
        <p><strong>On every other website</strong> (the card at the top right of the page): the site&apos;s address — its domain, never the page&apos;s path or query — and the name the site declares for itself, so the site&apos;s reading can be fetched. When you arrived from a Google search that already showed the site&apos;s bar, nothing is sent: the reading is carried inside your browser. Nothing else about the page is read or sent unless you press the button below.</p>
        <p><strong>When you press &ldquo;Analyse this page&apos;s subject&rdquo;:</strong> the visible text of that page (reviews and comments first, up to about twelve thousand words), its title, its address and any structured data it carries are sent to the server once, so the page&apos;s subject can be named and the opinions written on the page read. Nothing you type into the page is ever read: forms, fields and passwords are skipped. The text is read and then forgotten; only the finished reading is kept, for a quarter of an hour. A one-time note in the card says this before the first press.</p>
        <p>No cookies, no account details, no browsing history beyond the site addresses described above. Each install makes a random token so the server can limit how often one copy asks. The token identifies an install, not a person, and is never linked to an account.</p>
        <h2>Turning the card off</h2>
        <p>The menu behind the extension&apos;s toolbar icon turns the card on other websites off, everywhere, at once; the × on a card hides it on that page until the page is next loaded. With the card off, nothing is sent from any site but Google&apos;s search pages.</p>
        <h2>Why the browser says “read and change data”</h2>
        <p>Browsers grant page access as a combined capability: the same permission that lets an extension draw a bar also allows it to read and change that page. They do not offer a draw-only permission. Opinion Meter does not read passwords or form entries; it adds its own bars and card. Removing automatic page access would require you to activate it separately on pages and would stop the card appearing automatically. Turning the card off stops drawing and sending on other sites but does not revoke the browser permission; you can restrict website access in your browser&apos;s extension settings.</p>
        <h2>What the server keeps</h2>
        <p>The server keeps only what it works out: the split of opinion, the count, the summary sentence and links to the public posts it read, for up to 24 hours per subject. It does not keep the posts themselves, and it does not keep the text of any page. A finished card, with its quotes, is held for at most a quarter of an hour so that opening it again is instant. Quotes are otherwise fetched live, so a post deleted on its platform disappears from Opinion Meter at once.</p>
        <p>Request records used to prevent abuse are kept for at most 7 days and contain the install token and the time of the request, not the search or the page.</p>
        <h2>Where the opinions come from</h2>
        <p>Public posts and comments read through the official interfaces of Reddit, YouTube, X, Hacker News and Bluesky, within the limits each platform sets, and — for a page&apos;s reading — the reviews and comments written on that page itself. The text of those posts and reviews is sent to an AI model to be classified and summarised; usernames are not. Nothing is used to train any model.</p>
        <h2>What is a subject</h2>
        <p>Anything people talk about: products, films, apps, places, companies, articles, topics and public figures. For a person, the reading is about their work and public conduct, drawn only from public posts, and like every reading it is kept only as short-lived derived data.</p>
        <h2>Contact</h2>
        <p>Questions about this page: open an issue on the project&apos;s GitHub repository.</p>
      </section>
    </main>
  );
}
