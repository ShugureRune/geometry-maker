import type {ReactNode} from 'react';

/** Collapsible, keyboard-accessible explanation for detailed settings.
 * Uses native details so touch, keyboard and screen readers work without JS.
 */
export function HelpInfo({children,label='説明を見る'}:{
  children:ReactNode;label?:string;
}){
  return <details className="studio-info-disclosure">
    <summary aria-label={label} title={label}>
      <span className="studio-info-icon" aria-hidden="true">i</span>
      <span className="studio-info-label">説明</span>
      <span className="studio-info-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div className="studio-info-content">
      <p className="help">{children}</p>
    </div>
  </details>;
}
