import type {ReactNode} from 'react';

/** A compact, native disclosure for setting explanations.
 * Keeping the summary as a real interactive element preserves touch and
 * keyboard activation without nesting a button inside a <label>.
 */
export function HelpInfo({children,label='説明を見る'}:{
  children:ReactNode;label?:string;
}){
  return <details className="studio-info-disclosure">
    <summary aria-label={label} title={label}>
      <span className="studio-info-icon" aria-hidden="true">i</span>
    </summary>
    <div className="studio-info-content">
      <p className="help">{children}</p>
    </div>
  </details>;
}
