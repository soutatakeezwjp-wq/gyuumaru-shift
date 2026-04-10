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

    // URLから店舗コードを取得（例: /URESHINO/ や ?store=URESHINO）
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
    } else {
      // 店舗選択画面
      this.showScreen('store-select');
    }
  },

  // URLから店舗コードを取得する
  getStoreCode: function() {
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
        case 'shift-request':
        case 'shift-request-view':
        case 'shift-view':
          this.showScreen('staff-menu');
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
          this.showScreen('admin-dashboard');
          break;
        default:
          this.showScreen('admin-dashboard');
      }
    }
  },

  // スタッフを選択する
  selectStaff: function(staffId, staffName) {
    var self = this;
    App.showLoading('ログイン中...');

    API.staffLogin(staffId).then(function(result) {
      App.hideLoading();
      if (result.success) {
        API.setToken(result.token);
        sessionStorage.setItem('gyuumaru_token', result.token);
        self.currentStaff = { id: result.staffId, name: result.staffName };
        self.showScreen('staff-menu');
      } else {
        App.showToast(result.message, 'error');
      }
    }).catch(function() {
      App.hideLoading();
      App.showToast('ログインに失敗しました', 'error');
    });
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
