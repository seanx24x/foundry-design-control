import React from 'react';
import { Action } from './Action';
import styles from './Action.module.css';
export default { title: 'Project/Action', component: Action };
export const Primary = {
  args: { tone: 'primary' },
  render: (args) => (
    <main className={styles.canvas}>
      <section className={styles.card}>
        <p>Storybook and CVA</p>
        <h1>A considered workspace</h1>
        <p>Authored variants remain connected to the component library.</p>
        <div className={styles.actions}>
          <Action {...args} />
          <button className={styles.secondary}>Save draft</button>
        </div>
      </section>
    </main>
  ),
};
export const Quiet = { args: { tone: 'quiet' } };
