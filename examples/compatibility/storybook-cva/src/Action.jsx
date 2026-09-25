import React from 'react';
import { cva } from 'class-variance-authority';
import styles from './Action.module.css';

export const actionVariants = cva(styles.action, {
  variants: { tone: { primary: styles.primary, quiet: styles.quiet } },
  defaultVariants: { tone: 'primary' },
});
export function Action({ tone = 'primary' }) {
  return (
    <button
      className={actionVariants({ tone })}
      data-tone={tone}
      aria-label="Open workspace"
      data-foundry-id="compat-action"
      data-foundry-label="Open workspace"
      data-foundry-component="ProjectCard/Actions/Action"
      data-foundry-source="src/Action.module.css:3:3"
      data-foundry-source-anchor="/* foundry: compat-action */"
    >
      ↗
    </button>
  );
}
