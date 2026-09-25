import styles from './Action.module.css';
export function ProjectCard() {
  return (
    <main className={styles.canvas}>
      <section className={styles.card}>
        <p>Next.js App Router</p>
        <h1>A considered workspace</h1>
        <p>A server-rendered card with a nested, source-mapped action.</p>
        <div className={styles.actions}>
          <Action />
          <button className={styles.secondary}>Save draft</button>
        </div>
      </section>
    </main>
  );
}
function Action() {
  return (
    <button
      className={styles.action}
      aria-label="Open workspace"
      data-foundry-id="compat-action"
      data-foundry-label="Open workspace"
      data-foundry-component="ProjectCard/Actions/Action"
      data-foundry-source="app/Action.module.css:3:3"
      data-foundry-source-anchor="/* foundry: compat-action */"
    >
      ↗
    </button>
  );
}
