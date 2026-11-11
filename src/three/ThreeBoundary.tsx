import {Component, type ReactNode} from 'react';

type FailureKind='module'|'webgl'|'runtime';
type FailureState={failed:boolean;kind:FailureKind;detail:string};

/** React errors in the lazy 3D module and its WebGL canvas must not take down
 * the 2D editor. Keep actionable diagnostics visible on mobile Safari. */
function explain3DError(error:unknown):Pick<FailureState,'kind'|'detail'>{
  const message=error instanceof Error?error.message:String(error??'Unknown error');
  const kind:FailureKind=
    /dynamically imported|loading chunk|importing a module|failed to fetch|module script|load failed|networkerror|fetching dynamically/i.test(message)?'module':
    /webgl|gpu|shader|context lost|context creation|framebuffer|gl_out_of_memory/i.test(message)?'webgl':'runtime';
  // Rendered as plain React text, never HTML. Keep the diagnostics legible in
  // a screenshot without exposing stack traces or arbitrary long URLs.
  return {kind,detail:message.slice(0,220)};
}

export class ThreeBoundary extends Component<
  {children:ReactNode;onReturn:()=>void;onRetryLowQuality?:()=>void},
  FailureState
>{
  state:FailureState={failed:false,kind:'runtime',detail:''};
  static getDerivedStateFromError(error:unknown):FailureState{
    return {failed:true,...explain3DError(error)};
  }
  componentDidCatch(error:unknown){
    // On a connected desktop, the actual exception remains inspectable.
    console.error('3D preview failed:',error);
  }
  render(){
    if(!this.state.failed)return this.props.children;
    const moduleError=this.state.kind==='module';
    const webglError=this.state.kind==='webgl';
    return <div className="three-fallback" role="alert" data-three-error-kind={this.state.kind}>
      <h3>3D表示を開始できませんでした</h3>
      <p>{moduleError
        ?'アプリの更新直後などに、古い3Dファイルの読み込みが失敗することがあります。最新版を再読み込みしてください。'
        :webglError
          ?'WebGLの初期化・描画でエラーが発生しました。軽量設定での再試行かページの再読み込みをお試しください。'
          :'3Dの初期化中にエラーが発生しました。軽量設定で再試行するか、ページを再読み込みしてください。'}</p>
      <p className="help" data-testid="three-error-detail">エラー種別：{this.state.kind}
        {this.state.detail?<> ／ {this.state.detail}</>:null}</p>
      <div className="three-fallback-actions">
        {!moduleError&&this.props.onRetryLowQuality&&
          <button type="button" onClick={()=>{
            this.props.onRetryLowQuality?.();
            this.setState({failed:false,kind:'runtime',detail:''});
          }}>軽量設定で3Dを再試行</button>}
        <button type="button" onClick={()=>window.location.reload()}>最新版を再読み込み</button>
        <button type="button" onClick={this.props.onReturn}>2Dモードへ戻る</button>
      </div>
      <p className="help">再読み込みすると現在の未保存の編集内容が失われる場合があります。エラー種別をスクリーンショットで教えてもらうと原因調査に役立ちます。</p>
    </div>;
  }
}
