import { Component } from 'react';

// A failed chunk (offline connection or an older deployment) must not blank
// the entire app. Never reload automatically: unsaved forms stay in control.
export default class LazyBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="m-4 rounded-xl border border-theme-border bg-white p-5 text-sm text-slate-600">
      <h2 className="font-bold text-charcoal">This section could not load</h2>
      <p className="mt-2">Check your connection and reload to try again. Save any open edits first.</p>
      <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-wine px-4 py-2 font-bold text-white">Reload page</button>
    </section>;
  }
}
