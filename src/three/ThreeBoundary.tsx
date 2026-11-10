import {Component, type ReactNode} from 'react';

export class ThreeBoundary extends Component<{children: ReactNode; onReturn: () => void}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() {return {failed: true};}
  render() {
    if (this.state.failed) return <div className="three-fallback" role="alert"><h3>3D表示を開始できませんでした</h3><p>WebGL 2の対応状況やブラウザのハードウェアアクセラレーションを確認してください。ライブラリの読み込みに失敗した場合は再読み込みしてください。</p><button type="button" onClick={this.props.onReturn}>2Dモードへ戻る</button></div>;
    return this.props.children;
  }
}
