// ぎゅう丸シフト管理システム - メインアプリケーションJS（Cloudflare版）

var App = {
  mode: '',
  currentStaff: null,
  storeInfo: null,
  timeSlots: null,
  currentScreen: '',

  // アプリを初期化する
  init: function(mode) {
    this.mode = mode;

    // URLまたはデプロイ環境変数から店舗コードを取得
    var storeCode = this.getStoreCode();
    if (storeCode) {
      API.setStoreCode(storeCode);
      this.loadStoreInfo();
    }

    // 保存済みトークンがあれば復元
    var savedToken = sessionStorage.getItem('gyuumaru_token');
    if (savedToken) {
      API.setToken(savedToken);
    }

    if (mode === 'admin') {
      this.showScreen('admin-login');
    } else if (mode === 'staff') {
      this.showScreen('staff-select');
    } else if (storeCode) {
      // 店舗別デプロイ：店舗選択をスキップしてモード選択画面へ
      this.showScreen('mode-select');
    } else {
      // 店舗選択画面
      this.showScreen('store-select');
    }
  },

  // URLまたはデプロイ環境変数から店舗コードを取得する
  getStoreCode: function() {
    // 店舗別デプロイ用：/api/config 経由でセットされた値
    if (window.__GYUUMARU_STORE_CODE__) {
      return window.__GYUUMARU_STORE_CODE__;
    }
    // URLパス形式: /URESHINO/staff, /URESHINO/admin
    var path = location.pathname.split('/').filter(function(p) { return p; });
    if (path.length >= 1 && path[0] !== 'index.html') {
      return path[0];
    }
    // クエリパラメータ形式: ?store=URESHINO
    var params = new URLSearchParams(location.search);
    return params.get('store') || '';
  },

  // 店舗情報を読み込む
  loadStoreInfo: function() {
    var self = this;
    API.getCurrentStoreInfo().then(function(info) {
      self.storeInfo = info;
      var el = document.getElementById('store-name');
      if (el) el.textContent = info.storeName;
    }).catch(function() {});

    API.getTimeSlots().then(function(slots) {
      self.timeSlots = slots;
    });
  },

  // 画面を切り替える
  showScreen: function(screenId, params) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.add('hidden');
    }

    var target = document.getElementById('screen-' + screenId);
    if (target) {
      target.classList.remove('hidden');
      this.currentScreen = screenId;

      var backBtn = document.getElementById('back-btn');
      if (backBtn) {
        if (screenId === 'store-select' || screenId === 'staff-select') {
          backBtn.classList.add('hidden');
        } else {
          backBtn.classList.remove('hidden');
        }
      }

      if (typeof window['onShow_' + screenId.replace(/-/g, '_')] === 'function') {
        window['onShow_' + screenId.replace(/-/g, '_')](params);
      }

      // 画面切替後に翻訳を再適用（pages.jsで動的に追加された要素もカバー）
      if (window.I18n && typeof window.I18n.applyAll === 'function') {
        window.I18n.applyAll();
      }
    }

    window.scrollTo(0, 0);
  },

  // 戻るボタンの処理
  goBack: function() {
    if (this.mode === 'staff') {
      switch (this.currentScreen) {
        case 'staff-menu':
          this.currentStaff = null;
          this.showScreen('staff-select');
          break;
        case 'staff-pin-login':
        case 'staff-pin-setup':
          this._pendingStaff = null;
          this.showScreen('staff-select');
          break;
        case 'shift-request':
        case 'shift-request-view':
        case 'shift-view':
        case 'staff-payslip-list':
          this.showScreen('staff-menu');
          break;
        case 'staff-payslip-detail':
          this.showScreen('staff-payslip-list');
          break;
        default:
          this.showScreen('staff-select');
      }
    } else {
      switch (this.currentScreen) {
        case 'admin-login':
          this.showScreen('mode-select');
          break;
        case 'admin-dashboard':
          this.showScreen('admin-login');
          break;
        case 'admin-shift-requests':
        case 'admin-shift-edit':
        case 'admin-staff-manage':
        case 'admin-labor-cost':
        case 'admin-store-settings':
        case 'admin-payslip':
          this.showScreen('admin-dashboard');
          break;
        default:
          this.showScreen('admin-dashboard');
      }
    }
  },

  // スタッフを選択する → PIN入力画面に飛ぶ
  // PIN未設定の場合は「店長にPINを設定してもらってください」と表示
  selectStaff: function(staffId, staffName) {
    var self = this;
    App.showLoading('確認中...');
    API.staffHasPin(staffId).then(function(result) {
      App.hideLoading();
      self._pendingStaff = { id: staffId, name: staffName };
      if (result.hasPin) {
        self.showScreen('staff-pin-login');
      } else {
        // PINは店長が発行するので、ここではメッセージだけ出して戻す
        alert(
          staffName + 'さんのPINはまだ設定されていません。\n\n' +
          '店長にPINの発行を依頼してください。\n' +
          '（店長画面の「スタッフ管理」→「PIN発行」から設定できます）'
        );
        self._pendingStaff = null;
      }
    }).catch(function() {
      App.hideLoading();
      App.showToast('通信に失敗しました', 'error');
    });
  },

  // PIN入力でログインする
  submitStaffPin: function(pin) {
    var self = this;
    if (!self._pendingStaff) {
      App.showToast('スタッフが選択されていません', 'error');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      App.showToast('4桁の数字を入力してください', 'error');
      return;
    }
    App.showLoading('ログイン中...');
    API.staffLogin(self._pendingStaff.id, pin).then(function(result) {
      App.hideLoading();
      if (result.success) {
        API.setToken(result.token);
        sessionStorage.setItem('gyuumaru_token', result.token);
        sessionStorage.setItem('gyuumaru_role', result.role || 'staff');
        self.currentStaff = { id: result.staffId, name: result.staffName };
        self._pendingStaff = null;
        self.showScreen('staff-menu');
      } else {
        App.showToast(result.message || 'PINが一致しません', 'error');
      }
    }).catch(function() {
      App.hideLoading();
      App.showToast('ログインに失敗しました', 'error');
    });
  },

  // 自己PIN設定は廃止（店長が発行する方式に変更）
  submitStaffPinSetup: function() {
    App.showToast('PINは店長が発行する方式に変更されました', 'error');
  },

  // ローディング制御
  showLoading: function(message) {
    var overlay = document.getElementById('loading-overlay');
    var text = document.getElementById('loading-text');
    if (text) text.textContent = message || '読み込み中...';
    if (overlay) overlay.classList.add('active');
  },
  hideLoading: function() {
    var overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
  },

  // トースト通知
  showToast: function(message, type) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast';
    if (type) toast.classList.add('toast-' + type);
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
  },

  // モーダル制御
  showModal: function(modalId) {
    var modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  },
  hideModal: function(modalId) {
    var modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  // 確認ダイアログ
  confirm: function(message) { return window.confirm(message); },

  // 数値フォーマット
  formatCurrency: function(num) {
    if (num === null || num === undefined) return '0';
    return Math.round(num).toLocaleString();
  },
  formatHours: function(hours) {
    if (!hours) return '0.0';
    return (Math.round(hours * 10) / 10).toFixed(1);
  }
};
