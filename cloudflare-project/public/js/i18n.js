/*
 * ぎゅう丸シフト管理 多言語切替モジュール
 * 対応言語: 日本語(ja) / ベトナム語(vi) / 繁体字中国語(zh-Hant) / 台湾語＝閩南語(nan)
 *
 * 使い方:
 *   - HTML側で <span data-i18n="key.name">日本語の表示</span>
 *   - input/textareaのプレースホルダは data-i18n-placeholder="key.name"
 *   - ヘッダーの <select id="lang-switcher"> から手動切替
 *   - 言語選択は localStorage("gyuumaru.lang") に保存
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'gyuumaru.lang';
  const DEFAULT_LANG = 'ja';

  // ---- 言語辞書 ----
  // ja: 日本語 / vi: ベトナム語 / zh: 繁体字中国語 / nan: 台湾語(閩南語ローマ字)
  const DICT = {
    // ヘッダー・共通
    'app.title':            { ja: 'ぎゅう丸 シフト管理',     vi: 'Quản lý ca Gyuumaru',         zh: '牛丸排班系統',           nan: 'Gû-oân pâi-pan' },
    'app.subtitle':         { ja: 'シフト管理',               vi: 'Quản lý ca làm việc',         zh: '排班管理',               nan: 'Pâi-pan koán-lí' },
    'common.back':          { ja: '◀ 戻る',                  vi: '◀ Quay lại',                  zh: '◀ 返回',                 nan: '◀ Tò-khì' },
    'common.loading':       { ja: '読み込み中...',           vi: 'Đang tải...',                  zh: '載入中...',              nan: 'Teh-tha̍k...' },
    'common.save':          { ja: '保存',                    vi: 'Lưu',                          zh: '儲存',                   nan: 'Pó-tsûn' },
    'common.cancel':        { ja: 'キャンセル',              vi: 'Huỷ',                          zh: '取消',                   nan: 'Tshú-siau' },
    'common.delete':        { ja: '削除',                    vi: 'Xoá',                          zh: '刪除',                   nan: 'Sàn-tû' },
    'common.confirm':       { ja: '決定',                    vi: 'Xác nhận',                     zh: '確認',                   nan: 'Khak-jīn' },
    'common.clear':         { ja: 'クリア',                  vi: 'Xoá hết',                      zh: '清除',                   nan: 'Tshing-tû' },
    'common.add':           { ja: '+ 追加',                  vi: '+ Thêm',                       zh: '+ 新增',                 nan: '+ Sin-tsing' },
    'common.next':          { ja: '次へ ▶',                  vi: 'Tiếp ▶',                       zh: '下一步 ▶',               nan: 'Sòa-lo̍h ▶' },
    'common.copy':          { ja: 'コピー',                  vi: 'Sao chép',                     zh: '複製',                   nan: 'Hù-tsè' },
    'common.search':        { ja: '検索',                    vi: 'Tìm kiếm',                     zh: '搜尋',                   nan: 'Tshiau-tshuē' },

    // 言語切替セレクタのラベル
    'lang.label':           { ja: '言語',                    vi: 'Ngôn ngữ',                     zh: '語言',                   nan: 'Gí-giân' },
    'lang.japanese':        { ja: '日本語',                  vi: 'Tiếng Nhật',                   zh: '日文',                   nan: 'Ji̍t-gí' },
    'lang.vietnamese':      { ja: 'ベトナム語',              vi: 'Tiếng Việt',                   zh: '越南文',                 nan: 'Oa̍t-lâm-gí' },
    'lang.chinese_trad':    { ja: '繁体字中国語',            vi: 'Tiếng Trung phồn thể',         zh: '繁體中文',               nan: 'Hôan-thé Tiong-bûn' },
    'lang.taiwanese':       { ja: '台湾語(閩南語)',          vi: 'Tiếng Đài Loan',               zh: '台語',                   nan: 'Tâi-gí' },

    // 店舗選択
    'store.system_title':   { ja: 'シフト管理システム',      vi: 'Hệ thống quản lý ca',          zh: '排班管理系統',           nan: 'Pâi-pan koán-lí hē-thóng' },
    'store.select_prompt':  { ja: '店舗を選択してください',  vi: 'Vui lòng chọn cửa hàng',       zh: '請選擇分店',             nan: 'Tshiánn kíng huat-tiàm' },

    // モード選択
    'mode.which':           { ja: 'どちらのメニューを利用しますか？', vi: 'Bạn muốn dùng menu nào?',  zh: '請選擇要使用的選單',  nan: 'Beh ēng tó tsı̍t-ê tshài-toaⁿ?' },
    'mode.staff':           { ja: 'スタッフ',                vi: 'Nhân viên',                    zh: '員工',                   nan: 'Oân-kang' },
    'mode.staff_sub':       { ja: 'シフト希望の提出・確認',  vi: 'Đăng ký / xem ca làm việc',    zh: '提交與確認排班希望',     nan: 'Thê-kau ê khak-jīn pâi-pan' },
    'mode.admin':           { ja: '管理者',                  vi: 'Quản lý',                      zh: '管理者',                 nan: 'Koán-lí-tsiá' },
    'mode.admin_sub':       { ja: 'シフト作成・スタッフ管理', vi: 'Tạo ca và quản lý nhân viên', zh: '建立排班與員工管理',     nan: 'Pâi-pan kah oân-kang koán-lí' },

    // スタッフ画面共通
    'staff.select':         { ja: 'スタッフ選択',            vi: 'Chọn nhân viên',               zh: '選擇員工',               nan: 'Kíng oân-kang' },
    'staff.tap_name':       { ja: '自分の名前をタップしてください', vi: 'Vui lòng chạm vào tên của bạn', zh: '請點選您的名字',        nan: 'Tshiánn tia̍p lí ê miâ' },
    'staff.greeting':       { ja: 'こんにちは',              vi: 'Xin chào',                     zh: '您好',                   nan: 'Lí hó' },
    'staff.menu_subtitle':  { ja: '以下のステップでシフトを管理できます', vi: 'Quản lý ca theo các bước dưới đây', zh: '依下列步驟管理排班', nan: 'Tsiàu ē-bīn ê pō͘-tsōa lâi koán-lí pâi-pan' },

    // PINログイン
    'pin.title':            { ja: 'PINを入力',               vi: 'Nhập mã PIN',                  zh: '輸入PIN碼',              nan: 'Phah PIN ho-bé' },
    'pin.label':            { ja: '4桁のPIN',                vi: 'Mã PIN 4 chữ số',              zh: '4位數PIN碼',             nan: '4-jī ê PIN' },
    'pin.login':            { ja: 'ログイン',                vi: 'Đăng nhập',                    zh: '登入',                   nan: 'Tsìn-li̍p' },
    'pin.forgot':           { ja: 'PINを忘れた場合は店長にリセットを依頼してください', vi: 'Nếu quên PIN, hãy nhờ cửa hàng trưởng đặt lại', zh: '忘記PIN碼時請聯絡店長重置', nan: 'Bē-kì PIN, kā tiàm-tiúⁿ kóng tio̍h tshiánn tshōa-tāi' },

    // ステップ
    'staff.step1.label':    { ja: '希望を出す',              vi: 'Đăng ký nguyện vọng',          zh: '提交希望',               nan: 'Thê-kau hi-bāng' },
    'staff.step1.title':    { ja: 'STEP 1: シフト希望を出す', vi: 'Bước 1: Đăng ký ca mong muốn', zh: '步驟 1：提交排班希望',  nan: 'Tē-it pō͘: thê-kau pâi-pan hi-bāng' },
    'staff.step1.sub':      { ja: '来月の希望を入力',        vi: 'Nhập nguyện vọng cho tháng sau', zh: '輸入下月希望',          nan: 'Phah ē tio̍h-ge̍h ê hi-bāng' },
    'staff.step2.label':    { ja: '提出を確認',              vi: 'Xem đăng ký',                  zh: '確認提交',               nan: 'Khak-jīn thê-kau' },
    'staff.step2.title':    { ja: 'STEP 2: 提出済み希望を見る', vi: 'Bước 2: Xem nguyện vọng đã gửi', zh: '步驟 2：查看已提交希望', nan: 'Tē-jī pō͘: khoàⁿ í-keng kau ê hi-bāng' },
    'staff.step2.sub':      { ja: '入力した内容の確認',      vi: 'Kiểm tra nội dung đã nhập',    zh: '確認輸入的內容',         nan: 'Khak-jīn phah--ji̍p ê lōe-iông' },
    'staff.step3.label':    { ja: '確定を見る',              vi: 'Xem ca chính thức',            zh: '查看確定排班',           nan: 'Khoàⁿ tek-tēng ê pâi-pan' },
    'staff.step3.title':    { ja: 'STEP 3: 確定シフトを見る', vi: 'Bước 3: Xem ca chính thức',   zh: '步驟 3：查看確定排班',   nan: 'Tē-saⁿ pō͘: khoàⁿ tek-tēng pâi-pan' },
    'staff.step3.sub':      { ja: '決まったシフトの確認',    vi: 'Kiểm tra ca đã chốt',          zh: '確認已決定的排班',       nan: 'Khak-jīn í-keng kuat-tēng ê pâi-pan' },
    'staff.payslip':        { ja: '給与明細を見る',          vi: 'Xem phiếu lương',              zh: '查看薪資明細',           nan: 'Khoàⁿ kang-tsîⁿ bêng-sè' },
    'staff.payslip_sub':    { ja: '月ごとの明細を確認',      vi: 'Xem phiếu lương theo tháng',   zh: '依月份查看明細',         nan: 'Tsiàu ge̍h khoàⁿ bêng-sè' },

    // シフト希望入力画面
    'sr.title':             { ja: 'シフト希望入力',          vi: 'Đăng ký ca làm việc',          zh: '排班希望輸入',           nan: 'Phah pâi-pan hi-bāng' },
    'sr.bulk':              { ja: '一括設定',                vi: 'Cài đặt hàng loạt',            zh: '批次設定',               nan: 'Tsı̍t-tsuah siat-tēng' },
    'sr.clear_all':         { ja: '全てクリア',              vi: 'Xoá tất cả',                   zh: '全部清除',               nan: 'Lóng tshing-tû' },
    'sr.want_work':         { ja: '出勤希望',                vi: 'Muốn đi làm',                  zh: '希望出勤',               nan: 'Ài tsiūⁿ-pan' },
    'sr.want_off':          { ja: '休み希望',                vi: 'Muốn nghỉ',                    zh: '希望休假',               nan: 'Ài hioh-khùn' },
    'sr.either':            { ja: 'どちらでも',              vi: 'Tuỳ ý',                        zh: '都可以',                 nan: 'Lóng ē-sái' },
    'sr.submit':            { ja: 'シフト希望を提出する',    vi: 'Gửi nguyện vọng',              zh: '提交排班希望',           nan: 'Kau pâi-pan hi-bāng' },
    'sr.start_time':        { ja: '開始時間',                vi: 'Giờ bắt đầu',                  zh: '開始時間',               nan: 'Khai-sí sî-kan' },
    'sr.end_time':          { ja: '終了時間',                vi: 'Giờ kết thúc',                 zh: '結束時間',               nan: 'Kiat-sok sî-kan' },
    'sr.note':              { ja: '備考（任意）',            vi: 'Ghi chú (không bắt buộc)',     zh: '備註（選填）',           nan: 'Pī-tsù (sûi-ì)' },
    'sr.target_dow':        { ja: '対象の曜日',              vi: 'Thứ áp dụng',                  zh: '對象星期',               nan: 'Tuì-siōng pài-kî' },
    'sr.preference':        { ja: '希望',                    vi: 'Nguyện vọng',                  zh: '希望',                   nan: 'Hi-bāng' },
    'sr.apply_bulk':        { ja: '一括設定する',            vi: 'Áp dụng hàng loạt',            zh: '批次套用',               nan: 'Tsı̍t-tsuah ìng-iōng' },
    'sr.submitted_title':   { ja: '提出済みの希望',          vi: 'Nguyện vọng đã gửi',           zh: '已提交的希望',           nan: 'Í-keng kau ê hi-bāng' },

    // 確定シフト
    'sv.title':             { ja: '確定シフト',              vi: 'Ca chính thức',                zh: '確定排班',               nan: 'Tek-tēng pâi-pan' },
    'sv.this_month':        { ja: '今月の勤務',              vi: 'Ca tháng này',                 zh: '本月出勤',               nan: 'Pún-ge̍h tsiūⁿ-pan' },
    'sv.work_days':         { ja: '出勤日数',                vi: 'Số ngày làm',                  zh: '出勤天數',               nan: 'Tsiūⁿ-pan ji̍t-sò͘' },
    'sv.switch_list':       { ja: 'リスト表示に切り替え',    vi: 'Chuyển sang danh sách',        zh: '切換為列表顯示',         nan: 'Uānn lia̍t-toaⁿ hián-sī' },
    'sv.col_date':          { ja: '日付',                    vi: 'Ngày',                         zh: '日期',                   nan: 'Ji̍t-kî' },
    'sv.col_dow':           { ja: '曜日',                    vi: 'Thứ',                          zh: '星期',                   nan: 'Pài-kî' },
    'sv.col_start':         { ja: '開始',                    vi: 'Bắt đầu',                      zh: '開始',                   nan: 'Khai-sí' },
    'sv.col_end':           { ja: '終了',                    vi: 'Kết thúc',                     zh: '結束',                   nan: 'Kiat-sok' },
    'sv.col_actual':        { ja: '実働',                    vi: 'Thực làm',                     zh: '實際工時',               nan: 'Si̍t-tsè kang-sî' },

    // 管理者
    'admin.login_title':    { ja: '管理者ログイン',          vi: 'Đăng nhập quản lý',            zh: '管理者登入',             nan: 'Koán-lí-tsiá tsìn-li̍p' },
    'admin.password_ph':    { ja: 'パスワードを入力',        vi: 'Nhập mật khẩu',                zh: '輸入密碼',               nan: 'Phah ba̍t-bé' },
    'admin.menu':           { ja: '管理者メニュー',          vi: 'Menu quản lý',                 zh: '管理選單',               nan: 'Koán-lí tshài-toaⁿ' },
    'admin.req_status':     { ja: 'シフト希望の提出状況',    vi: 'Tình trạng nộp nguyện vọng',   zh: '排班希望提交狀況',       nan: 'Pâi-pan hi-bāng thê-kau tsōng-hóng' },
    'admin.req_list':       { ja: 'シフト希望一覧',          vi: 'Danh sách nguyện vọng',        zh: '排班希望一覽',           nan: 'Pâi-pan hi-bāng it-lám' },
    'admin.req_list_sub':   { ja: '提出された希望を確認',    vi: 'Kiểm tra nguyện vọng đã nộp',  zh: '確認已提交的希望',       nan: 'Khak-jīn í-keng kau ê hi-bāng' },
    'admin.shift_create':   { ja: 'シフト表作成',            vi: 'Tạo bảng ca',                  zh: '建立排班表',             nan: 'Kiàn-li̍p pâi-pan-pió' },
    'admin.shift_create_sub':{ ja: '自動作成と編集',          vi: 'Tự động tạo và chỉnh sửa',     zh: '自動建立與編輯',         nan: 'Tsū-tōng kiàn-li̍p kah pian-tsi̍p' },
    'admin.labor_cost':     { ja: '人件費確認',              vi: 'Kiểm tra chi phí lao động',    zh: '人事費確認',             nan: 'Jîn-sū-huì khak-jīn' },
    'admin.labor_cost_sub': { ja: '人件費の計算と確認',      vi: 'Tính và kiểm tra chi phí',     zh: '人事費計算與確認',       nan: 'Jîn-sū-huì kè-sǹg kah khak-jīn' },
    'admin.staff_manage':   { ja: 'スタッフ管理',            vi: 'Quản lý nhân viên',            zh: '員工管理',               nan: 'Oân-kang koán-lí' },
    'admin.staff_manage_sub':{ ja: '追加・編集・退職処理',    vi: 'Thêm, sửa, nghỉ việc',         zh: '新增・編輯・離職處理',   nan: 'Sin-tsing・pian-tsi̍p・lī-tsit' },
    'admin.store_settings': { ja: '店舗設定',                vi: 'Cài đặt cửa hàng',             zh: '分店設定',               nan: 'Huat-tiàm siat-tēng' },
    'admin.store_settings_sub':{ ja: '必要人数・営業時間など', vi: 'Số nhân viên cần, giờ mở cửa', zh: '所需人數・營業時間等',   nan: 'Su-iàu jîn-sò͘・iân-gia̍p sî-kan' },
    'admin.payslip_csv':    { ja: '給与明細CSV取込',         vi: 'Nhập CSV phiếu lương',         zh: '匯入薪資CSV',            nan: 'Tsuán-ji̍p kang-tsîⁿ CSV' },
    'admin.payslip_csv_sub':{ ja: '社労士のCSVを取り込み',   vi: 'Nhập CSV từ kế toán',          zh: '匯入會計師CSV',          nan: 'Tsuán-ji̍p huē-kè-sai CSV' },

    // 給与
    'payslip.title':        { ja: '給与明細',                vi: 'Phiếu lương',                  zh: '薪資明細',               nan: 'Kang-tsîⁿ bêng-sè' },
    'payslip.tap_month':    { ja: '月をタップすると詳細を表示します。', vi: 'Chạm vào tháng để xem chi tiết.', zh: '點選月份以顯示明細。', nan: 'Tia̍p ge̍h-hūn lâi khoàⁿ siông-sè' }
  };

  // ---- 内部状態 ----
  let currentLang = DEFAULT_LANG;

  function getLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && ['ja', 'vi', 'zh-Hant', 'nan'].indexOf(saved) >= 0) return saved;
    } catch (e) {}
    return DEFAULT_LANG;
  }

  function langKey(lang) {
    // 辞書のキーは ja / vi / zh / nan の4つ。zh-Hant → zh に正規化。
    if (lang === 'zh-Hant') return 'zh';
    return lang;
  }

  function t(key) {
    const entry = DICT[key];
    if (!entry) return key;
    const k = langKey(currentLang);
    return entry[k] || entry.ja || key;
  }

  // 全要素に翻訳を適用
  function applyAll(root) {
    const scope = root || document;
    // textContent
    const els = scope.querySelectorAll('[data-i18n]');
    els.forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    // placeholder
    const phs = scope.querySelectorAll('[data-i18n-placeholder]');
    phs.forEach(function (el) {
      const key = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', t(key));
    });
    // title属性
    const titles = scope.querySelectorAll('[data-i18n-title]');
    titles.forEach(function (el) {
      const key = el.getAttribute('data-i18n-title');
      el.setAttribute('title', t(key));
    });
    // <html lang="..."> も更新
    document.documentElement.setAttribute('lang', currentLang);
  }

  function setLang(lang) {
    currentLang = lang || DEFAULT_LANG;
    try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (e) {}
    applyAll();
    // 言語切替セレクタの選択状態も合わせる
    const sel = document.getElementById('lang-switcher');
    if (sel && sel.value !== currentLang) sel.value = currentLang;
    // 他のスクリプトに通知
    window.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: currentLang } }));
  }

  // 初期化
  function init() {
    currentLang = getLang();
    applyAll();
    const sel = document.getElementById('lang-switcher');
    if (sel) {
      sel.value = currentLang;
      sel.addEventListener('change', function (e) {
        setLang(e.target.value);
      });
    }
  }

  // 公開API
  window.I18n = {
    t: t,
    setLang: setLang,
    getLang: function () { return currentLang; },
    applyAll: applyAll,
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
