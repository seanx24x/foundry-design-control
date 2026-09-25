// Presentation only. Context mutations and measurements remain acknowledged by the iframe.
export function sameStateCondition(a, b) {
  if (!a || !b) return false;
  return (
    ['theme', 'state', 'motionPreference'].every((key) => a[key] === b[key]) &&
    ['id', 'width', 'height'].every((key) => a.viewport?.[key] === b.viewport?.[key]) &&
    a.selectedTarget?.id === b.selectedTarget?.id &&
    a.selectedTarget?.selector === b.selectedTarget?.selector
  );
}

export function stateEvidenceModel({ connected, pending, context, lastResult, record }) {
  const measured =
    record?.result?.applied && sameStateCondition(record.context, context) ? record : null;
  const failed =
    lastResult?.applied === false && sameStateCondition(lastResult.context, context)
      ? lastResult
      : null;
  if (!connected)
    return {
      status: 'offline',
      title: 'Preview disconnected',
      note: 'Reconnect the isolated preview before inspecting this condition.',
      record: measured,
    };
  if (pending)
    return {
      status: 'pending',
      title: 'Inspecting condition',
      note: 'Waiting for the preview to apply this context and return a matching measurement.',
    };
  if (failed)
    return {
      status: 'failed',
      title: 'Context not applied',
      note: `${failed.failureReason ?? 'This condition could not be inspected.'} The preview may still show the previous condition.`,
      result: failed,
    };
  if (measured)
    return {
      status: 'inspected',
      title: 'Context inspected',
      note: 'The preview acknowledged this combination and returned a matching snapshot. This is not a full accessibility or visual audit.',
      result: measured.result,
      record: measured,
    };
  return {
    status: 'untested',
    title: 'Not inspected',
    note: 'Inspect this condition to collect evidence for this viewport, theme, motion preference and target.',
  };
}

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text != null) element.textContent = text;
  return element;
};

export function createNextStateWorkbench(root, { selectState, syncControls }) {
  root.classList.add('next-state-workbench');
  root.dataset.nextIconScope = '';
  root.querySelector('.mode-head h1').textContent = 'State workbench';
  root.querySelector('.mode-head p').textContent =
    'Inspect authored conditions in an isolated product preview';
  const refresh = root.querySelector('#state-run-verification');
  refresh.textContent = 'Inspect condition';
  const footer = node('footer', 'next-state-footer');
  footer.append(node('span', '', 'Preview only. Canvas and source remain unchanged.'));
  const connection = node('span', '');
  footer.append(connection);
  root.append(footer);
  let axisList, selectionLabel, targetNote, evidenceScroll, coverageNote;
  let signature = '';
  let choicesSignature = '';
  return {
    mount() {
      const left = root.querySelector('.state-matrix-panel');
      const head = left.querySelector('header');
      head.replaceChildren(node('strong', '', 'States'));
      const scroll = node('div', 'next-state-controls');
      const list = left.querySelector('.state-matrix-list');
      list.querySelector('code')?.remove();
      for (const button of list.querySelectorAll('button')) {
        button.querySelector('i')?.remove();
        const glyph = node('i', '');
        glyph.dataset.icon = 'layers';
        button.prepend(glyph);
        button.append(node('small', 'next-state-row-status', 'Not inspected'));
      }
      coverageNote = node(
        'p',
        'next-state-help',
        'Only states indexed from the project are listed. Current restores the authored baseline.',
      );
      const conditions = node('section', 'next-state-conditions');
      conditions.append(node('h2', '', 'Conditions'));
      conditions.append(...left.querySelectorAll(':scope > label'));
      scroll.append(list, coverageNote, conditions);
      left.querySelector('.state-panel-rule')?.remove();
      left.replaceChildren(head, scroll);

      const right = root.querySelector('.state-verification-panel');
      right.querySelector('header').replaceChildren(node('strong', '', 'Evidence'));
      evidenceScroll = node('div', 'next-state-evidence-scroll');
      const target = node('section', 'next-state-target');
      target.append(node('h2', '', 'Selected target'));
      selectionLabel = node('p', '');
      targetNote = node('p', 'next-state-help');
      target.append(selectionLabel, targetNote);
      const summary = right.querySelector('.state-verification-summary');
      const note = right.querySelector('.state-ready-note');
      const context = right.querySelector('dl');
      context.querySelectorAll('div').forEach((row) => {
        if (row.querySelector('dt')?.textContent === 'Changes') row.remove();
      });
      const requested = node('section', 'next-state-requested');
      requested.append(node('h2', '', 'Requested conditions'), context);
      axisList = node('section', 'next-state-axes');
      axisList.setAttribute('aria-label', 'Context application evidence');
      evidenceScroll.append(target, note, requested, axisList, summary);
      right.append(evidenceScroll);
      root.querySelector('#state-preview-status').setAttribute('role', 'status');
      signature = '';
      choicesSignature = '';
    },
    update({
      context,
      connected,
      pending,
      lastResult,
      results,
      keyFor,
      states,
      themes,
      selection,
      scale,
      viewports,
    }) {
      if (!axisList?.isConnected) return;
      const choices = JSON.stringify([states, themes, viewports]);
      if (choices !== choicesSignature) {
        choicesSignature = choices;
        const list = root.querySelector('.state-matrix-list');
        list.replaceChildren();
        for (const state of states) {
          const button = node('button', '');
          button.type = 'button';
          button.dataset.stateMatrixState = state.id;
          const glyph = node('i', '');
          glyph.dataset.icon = 'layers';
          button.append(
            glyph,
            node('span', '', state.label),
            node('small', 'next-state-row-status', 'Not inspected'),
          );
          button.addEventListener('click', () => selectState(state.id));
          list.append(button);
        }
        for (const [id, items, value] of [
          ['state-matrix-theme', themes, context.theme],
          ['state-matrix-viewport', viewports, context.viewport.id],
        ]) {
          const select = root.querySelector(`#${id}`);
          select.replaceChildren(
            ...items.map((item) => {
              const option = node(
                'option',
                '',
                item.width ? `${item.label} · ${item.width} × ${item.height}` : item.label,
              );
              option.value = item.id;
              option.selected = item.id === value;
              return option;
            }),
          );
        }
        syncControls();
      }
      const record = results.get(keyFor(context));
      const model = stateEvidenceModel({ context, connected, pending, lastResult, record });
      const label = states.find((item) => item.id === context.state)?.label ?? 'Current';
      root.querySelector('#state-preview-context-label').textContent =
        `${label} · ${context.viewport.width} × ${context.viewport.height}`;
      root.querySelector('#state-preview-status').textContent = !connected
        ? 'Disconnected'
        : pending
          ? 'Inspecting'
          : 'Connected';
      root.querySelector('#state-preview-status').dataset.status = model.status;
      refresh.disabled = !connected || pending;
      refresh.textContent = pending ? 'Inspecting…' : 'Inspect condition';
      selectionLabel.textContent = selection?.label ?? 'Whole page';
      selectionLabel.title = selectionLabel.textContent;
      targetNote.textContent =
        selection?.component ?? 'Authored page conditions apply to this isolated preview.';
      root.querySelector('#state-verification-title').textContent = model.title;
      root.querySelector('#state-verification-note').textContent = model.note;
      root.querySelector('.state-ready-note').dataset.status = model.status;
      root.querySelector('#state-result-theme').textContent =
        themes.find((item) => item.id === context.theme)?.label ?? 'Current';
      root.querySelector('#state-result-motion').textContent =
        { system: 'System', reduce: 'Reduced', 'no-preference': 'Full motion' }[
          context.motionPreference
        ] ?? context.motionPreference;
      root.querySelector('#state-verification-connection').textContent = connected
        ? 'Connected'
        : 'Disconnected';
      let tested = 0;
      for (const button of root.querySelectorAll('[data-state-matrix-state]')) {
        const candidate = { ...context, state: button.dataset.stateMatrixState };
        const saved = results.get(keyFor(candidate));
        const inspected = saved?.result?.applied && sameStateCondition(saved.context, candidate);
        if (inspected) tested++;
        const active = candidate.state === context.state;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
        const status =
          active && pending && connected
            ? 'Inspecting'
            : active && model.status === 'failed'
              ? 'Not applied'
              : inspected
                ? 'Inspected'
                : 'Not inspected';
        button.querySelector('.next-state-row-status').textContent = status;
        button.title = `${button.querySelector('span').textContent}: ${status}`;
      }
      root.querySelector('#state-verification-count').textContent =
        `${tested} of ${states.length} conditions inspected`;
      root.querySelector('#state-verification-copy').textContent =
        'Coverage for this viewport, theme, motion preference and target. Export includes untested conditions.';
      connection.textContent = `${connected ? 'Isolated preview connected' : 'Isolated preview disconnected'} · ${Math.round(scale * 100)}% fit`;
      const nextSignature = JSON.stringify([
        model.status,
        model.result?.axes,
        model.record?.measuredAt,
      ]);
      if (signature !== nextSignature) {
        signature = nextSignature;
        const axes = Object.entries(model.result?.axes ?? {});
        axisList.replaceChildren();
        if (axes.length) {
          axisList.append(node('h2', '', 'Applied context'));
          for (const [key, axis] of axes) {
            const detail = node('details', 'next-state-axis');
            const summary = node('summary', '');
            summary.append(
              node(
                'span',
                '',
                {
                  viewport: 'Viewport',
                  theme: 'Theme',
                  state: 'State',
                  motion: 'Motion',
                  motionPreference: 'Motion',
                  selectedTarget: 'Target',
                }[key] ?? key,
              ),
              node(
                'span',
                '',
                { applied: 'Applied', current: 'Already current', unsupported: 'Unsupported' }[
                  axis.status
                ] ?? axis.status,
              ),
            );
            detail.append(summary, node('p', 'next-state-help', `Method: ${axis.method}`));
            for (const line of axis.evidence ?? [])
              detail.append(node('p', 'next-state-help', line));
            if (axis.failureReason) detail.append(node('p', 'next-state-help', axis.failureReason));
            axisList.append(detail);
          }
          if (model.record?.measurement?.bounds) {
            const bounds = model.record.measurement.bounds;
            axisList.append(
              node(
                'p',
                'next-state-help',
                `Target measured ${Math.round(bounds.width)} × ${Math.round(bounds.height)} px`,
              ),
            );
          }
        }
      }
    },
  };
}
