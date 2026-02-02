// 네비게이션 처리
document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const moduleViews = document.querySelectorAll('.module-view');

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const module = item.dataset.module;

      // 네비게이션 활성화 상태 변경
      navItems.forEach((nav) => nav.classList.remove('active'));
      item.classList.add('active');

      // 모듈 뷰 전환
      moduleViews.forEach((view) => view.classList.remove('active'));
      const targetView = document.getElementById(`${module}-view`);
      if (targetView) {
        targetView.classList.add('active');
      }

      // 메인 프로세스에 네비게이션 알림
      if (window.wawaAPI) {
        window.wawaAPI.navigate(module);
      }
    });
  });

  // 모듈 간 메시지 수신
  if (window.wawaAPI) {
    window.wawaAPI.onBroadcast((data) => {
      console.log('Broadcast received:', data);

      // 각 웹뷰에 메시지 전달
      const webviews = document.querySelectorAll('webview');
      webviews.forEach((webview) => {
        webview.send('module:message', data);
      });
    });
  }

  // 버전 표시
  const versionEl = document.querySelector('.version');
  if (versionEl && window.wawaAPI) {
    versionEl.textContent = `v${window.wawaAPI.version}`;
  }
});
