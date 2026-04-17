// ぎゅう丸シフト管理システム - カレンダー操作JS（GAS版と同一ロジック）

var Calendar = {
  render: function(containerId, yearMonth, options) {
    options = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    var parts = yearMonth.split('-');
    var year = parseInt(parts[0]);
    var month = parseInt(parts[1]);
    var daysInMonth = new Date(year, month, 0).getDate();
    var firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    var dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    var data = options.data || {};

    var html = '<div class="calendar-grid">';

    for (var d = 0; d < 7; d++) {
      var dayClass = '';
      if (d === 0) dayClass = ' sun';
      if (d === 6) dayClass = ' sat';
      html += '<div class="calendar-day-header' + dayClass + '">' + dayNames[d] + '</div>';
    }

    for (var e = 0; e < firstDayOfWeek; e++) {
      html += '<div class="calendar-cell empty"></div>';
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var dateStr = yearMonth + '-' + ('0' + day).slice(-2);
      var dayOfWeek = new Date(year, month - 1, day).getDay();
      var dayData = data[dateStr] || null;
      // 祝日判定（holidays.js を読み込んでいない環境でも落ちないようガード）
      var isHol = (window.Holidays && window.Holidays.isHoliday(dateStr));
      var holName = isHol ? window.Holidays.getName(dateStr) : null;

      var cellClass = 'calendar-cell';
      if (dayOfWeek === 0) cellClass += ' sun';
      if (dayOfWeek === 6) cellClass += ' sat';
      // 祝日は日曜と同じ赤色扱い
      if (isHol) cellClass += ' sun holiday';

      if (dayData) {
        if (dayData.type === '出勤希望') cellClass += ' work';
        else if (dayData.type === '休み希望') cellClass += ' off';
        else if (dayData.type === 'どちらでも') cellClass += ' either';
        else if (dayData.confirmed) cellClass += ' confirmed';
      }

      var titleAttr = holName ? ' title="' + holName + '"' : '';
      html += '<div class="' + cellClass + '" data-date="' + dateStr + '"' + titleAttr + ' onclick="Calendar._onCellClick(\'' + containerId + '\', \'' + dateStr + '\')">';
      html += '<div class="day-number">' + day + '</div>';
      if (holName) {
        html += '<div class="holiday-name">' + holName + '</div>';
      }

      if (options.renderCell) {
        html += options.renderCell(dateStr, dayData);
      } else if (dayData) {
        html += '<div class="shift-info">';
        if (dayData.startTime && dayData.endTime) {
          html += dayData.startTime + '-' + dayData.endTime;
        } else if (dayData.type) {
          if (dayData.type === '休み希望') html += '休';
          else if (dayData.type === 'どちらでも') html += 'OK';
        }
        html += '</div>';
      }

      html += '</div>';
    }

    var totalCells = firstDayOfWeek + daysInMonth;
    var remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (var r = 0; r < remainingCells; r++) {
      html += '<div class="calendar-cell empty"></div>';
    }

    html += '</div>';
    container.innerHTML = html;

    if (!Calendar._callbacks) Calendar._callbacks = {};
    Calendar._callbacks[containerId] = options.onCellClick;
  },

  _callbacks: {},
  _onCellClick: function(containerId, dateStr) {
    if (Calendar._callbacks[containerId]) {
      Calendar._callbacks[containerId](dateStr);
    }
  },

  renderHeader: function(headerId, yearMonth, onNavigate) {
    var container = document.getElementById(headerId);
    if (!container) return;

    var parts = yearMonth.split('-');
    var year = parseInt(parts[0]);
    var month = parseInt(parts[1]);

    var prevMonth = month - 1;
    var prevYear = year;
    if (prevMonth === 0) { prevMonth = 12; prevYear--; }

    var nextMonth = month + 1;
    var nextYear = year;
    if (nextMonth === 13) { nextMonth = 1; nextYear++; }

    var prevYM = prevYear + '-' + ('0' + prevMonth).slice(-2);
    var nextYM = nextYear + '-' + ('0' + nextMonth).slice(-2);

    container.innerHTML =
      '<div class="calendar-header">' +
      '<button class="calendar-nav-btn" onclick="Calendar._navigate(\'' + headerId + '\', \'' + prevYM + '\')">&lt;</button>' +
      '<span class="month-label">' + year + '年' + month + '月</span>' +
      '<button class="calendar-nav-btn" onclick="Calendar._navigate(\'' + headerId + '\', \'' + nextYM + '\')">&gt;</button>' +
      '</div>';

    if (!Calendar._navCallbacks) Calendar._navCallbacks = {};
    Calendar._navCallbacks[headerId] = onNavigate;
  },

  _navCallbacks: {},
  _navigate: function(headerId, newYearMonth) {
    if (Calendar._navCallbacks[headerId]) {
      Calendar._navCallbacks[headerId](newYearMonth);
    }
  }
};
