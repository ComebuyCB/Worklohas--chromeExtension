// 添加時間設定介面
$('body').append(`
  <div id="WL_fixed">
    <div id="WL_toggle">
      <i class="fa fa-chevron-up"></i>
    </div>
    <div id="WL_content" style="margin-top: 8px;">
      <div class="wl-input-group">
        <label class="wl-input-label">上班時間</label>
        <div class="wl-input-row">
          <input type="time" id="WL_startTime" value="10:00" class="wl-time-input">
          <span style="margin-left: 10px;">隨機前</span>
          <select id="WL_startRandom" style="width: 60px; padding: 5px;">
            <option value="" default selected hidden>--</option>
            ${Array.from({length: 13}, (_, i) => `<option value="${i * 5}" ${i === 2 ? 'selected' : ''}>${i * 5}</option>`).join('')}
          </select>
          <span>分鐘</span>
        </div>
      </div>
      <div class="wl-input-group">
        <label class="wl-input-label">下班時間</label>
        <div class="wl-input-row">
          <input type="time" id="WL_endTime" value="19:00" class="wl-time-input">
          <span style="margin-left: 10px;">隨機後</span>
          <select id="WL_endRandom" style="width: 60px; padding: 5px;">
            <option value="" default selected hidden>--</option>
            ${Array.from({length: 13}, (_, i) => `<option value="${i * 5}" ${i === 2 ? 'selected' : ''}>${i * 5}</option>`).join('')}
          </select>
          <span>分鐘</span>
        </div>
      </div>
      <div class="wl-input-group">
        <label class="wl-input-row" style="width: fit-content;">
          <input type="checkbox" id="WL_includeLeaveOvertime">
          <span>包含請假/加班</span>
        </label>
      </div>
    </div>
    <button id="WL_submitPunch" class="btn btn-danger btn-sm" style="width: 100%;">
      <i class="fa fa-plus"></i> 快速補卡
    </button>
  </div>
`);

var WL_selectValues = {
  startTime: '09:59',
  endTime: '19:01',
  startRandom: '10',
  endRandom: '10',
  includeLeaveOvertime: false,
  collapsed: false
}

// 添加切換功能
$(document).on('click', '#WL_toggle', function() {
  const $content = $('#WL_content');
  const $icon = $(this).find('i');
  const $btn = $('#WL_submitPunch');
  const $fixed = $('#WL_fixed');

  let collapsed;
  if ($content.is(':visible')) {
    $content.slideUp();
    $icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
    $btn.css('width', 'auto');
    $fixed.css('width', 'auto');
    collapsed = true;
  } else {
    $content.slideDown();
    $icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
    $btn.css('width', '100%');
    $fixed.css('width', '');
    collapsed = false;
  }

  WL_selectValues = { ...WL_selectValues, collapsed };
  window.postMessage({
    from: 'cloud.nueip.com/attendance_record',
    to: 'content.js',
    type: 'SAVE_SELECT_VALUES',
    data: {
      nueip_punch_settings: WL_selectValues
    }
  }, '*');
});

wlMessage({
  INIT(event) {
    restoreSettingsFromStorage(event.data.data.nueip_punch_settings);
  }
});

// 用 content.js 從 local storage 取回的設定值，還原整個介面狀態
function restoreSettingsFromStorage(values) {
  wlLog('📂 restoreSettingsFromStorage', values);
  if (values) {
    // 設定時間輸入框，如果有儲存的值則使用，否則使用預設值
    if (values.startTime) {
      $('#WL_startTime').val(values.startTime);
    }
    if (values.endTime) {
      $('#WL_endTime').val(values.endTime);
    }
    $('#WL_startRandom').val(values.startRandom || '10');
    $('#WL_endRandom').val(values.endRandom || '10');
    $('#WL_includeLeaveOvertime').prop('checked', !!values.includeLeaveOvertime);

    // 還原收合狀態，不做展開/收合動畫
    if (values.collapsed) {
      $('#WL_content').hide();
      $('#WL_toggle').find('i').removeClass('fa-chevron-up').addClass('fa-chevron-down');
      $('#WL_submitPunch').css('width', 'auto');
      $('#WL_fixed').css('width', 'auto');
    }

    WL_selectValues = { ...WL_selectValues, ...values };
  }
}

// 監聽按鈕點擊
$(document).on('click', '#WL_submitPunch', function() {
  const punchSettings = {
    startTime: $('#WL_startTime').val(),
    endTime: $('#WL_endTime').val(),
    startRandom: $('#WL_startRandom').val(),
    endRandom: $('#WL_endRandom').val(),
    includeLeaveOvertime: $('#WL_includeLeaveOvertime').is(':checked')
  };

  if ( punchSettings.startTime === '' ||
    punchSettings.endTime === '' ||
    punchSettings.startRandom === '' ||
    punchSettings.endRandom === '' ){
    alert('請先設定完整');
    return;
  }

  WL_selectValues = punchSettings;

  wlLog('💾 @NUEIP → content.js: SAVE_SELECT_VALUES');
  window.postMessage({ // 發送消息給 content.js
    from: 'cloud.nueip.com/attendance_record',
    to: 'content.js',
    type: 'SAVE_SELECT_VALUES',
    data: {
      nueip_punch_settings: punchSettings
    }
  }, '*');

  // WL_AttendanceData 只有在執行「查詢」時才會更新，補卡前先重新查詢一次，避免拿到手動打卡前的舊資料
  wlLog('🔄 補卡前重新查詢出勤資料...');
  $.when(loadingData("attendance")).then(() => {
    autoCheckIn(); // 執行自動打卡
  });
});

// 判斷該日 punch 是否已有指定 section 的打卡紀錄
// punch 沒有任何打卡時是 []，有打卡時會變成 { onPunch: [...], offPunch: [...] } 物件（型別不一致，兩種都要判斷）
function hasPunchSection(punch, key) {
  return !Array.isArray(punch) && punch?.[key]?.length > 0;
}

// 自動打卡功能
function autoCheckIn(){
  const attendanceData = window.WL_AttendanceData?.data;
  if (!attendanceData) {
    alert('尚未取得出勤資料，請稍後再試');
    return;
  }

  const date_today = new Date().toISOString().split('T')[0];
  const { startTime: targetStartTime, endTime: targetEndTime, startRandom, endRandom, includeLeaveOvertime } = WL_selectValues;

  const ajaxArray = [];

  Object.entries(attendanceData).forEach(([date, usersOnDate]) => {
    const dayData = Object.values(usersOnDate)[0]; // 個人出勤查詢，每個日期只會有自己一筆
    if (!dayData) return;

    const U_SN = dayData.user?.u_sn;

    /*=== 跳過未來日期 / 假日（date_off 已涵蓋週末與國定假日）===*/
    if (date_today < date || dayData.dateInfo?.date_off === true) return;

    /*=== 未勾選「打卡包含請假或加班」時，該日只要有加班前/加班/請假紀錄就整天略過 ===*/
    if (!includeLeaveOvertime && (dayData.preovertime || dayData.overtime || dayData.timeoff)) return;

    /*=== 時間打卡，上班和下班 ===*/
    const punch = dayData.punch;

    if (!hasPunchSection(punch, 'onPunch')){ // 補卡 (上班)
      let {hour, min} = getRdHourMin(targetStartTime, startRandom, "上班");
      let postData = { section: 1, hour, min, remark: '補卡', u_sn: U_SN, date, apply_date: date, }
      ajaxArray.push( promiseAjax(postData) );
    }

    if (!hasPunchSection(punch, 'offPunch')){ // 補卡 (下班)
      let {hour, min} = getRdHourMin(targetEndTime, endRandom, "下班");
      let postData = { section: 2, hour, min, remark: '補卡', u_sn: U_SN, date, apply_date: date, }
      ajaxArray.push( promiseAjax(postData) );
    }
  });

  // 執行所有補卡請求
  if (ajaxArray.length > 0) {
    executeAjaxSequentially(ajaxArray).then((res)=>{
      wlLog('✅ 補卡結果', res);
      let successVals = res.filter((e)=> e?.code === 200);
      if (confirm('自動打卡完畢! 共'+ successVals.length +'筆。\n點擊確定更新頁面。')) {
        window.location.reload();
      }
    });
  } else {
    alert('沒有需要補卡的記錄');
  }
}

// 獲取隨機時間
function getRdHourMin(timeString, randomMins, type) {
  // 將 HH:MM 格式轉換為小時和分鐘
  const [hours, minutes] = timeString.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;

  // 計算隨機範圍
  let randomMinutes;
  if (type === "上班") {
    // 上班時間：在目標時間之前的隨機分鐘
    randomMinutes = Math.floor(Math.random() * parseInt(randomMins));
    const newTotalMinutes = totalMinutes - randomMinutes;
    const newHours = Math.floor(newTotalMinutes / 60);
    const newMinutes = newTotalMinutes % 60;
    return {
      hour: newHours.toString().padStart(2, '0'),
      min: newMinutes.toString().padStart(2, '0')
    };
  } else {
    // 下班時間：在目標時間之後的隨機分鐘
    randomMinutes = Math.floor(Math.random() * parseInt(randomMins));
    const newTotalMinutes = totalMinutes + randomMinutes;
    const newHours = Math.floor(newTotalMinutes / 60);
    const newMinutes = newTotalMinutes % 60;
    return {
      hour: newHours.toString().padStart(2, '0'),
      min: newMinutes.toString().padStart(2, '0')
    };
  }
}

// Ajax Promise 封裝
function promiseAjax(data){
  console.group(`📍 補卡 ${data.section === 1 ? '上班' : '下班'} — ${data.date}`)
  console.log(data)
  console.groupEnd()
  return function(){
    return new Promise((resolve)=>{
      $.ajax({
        type: 'post',
        url: '/attendance_record/addCorrectionPunch',
        data,
      }).done(function(res) {
        resolve(res);
      }).error(function(res) {
        resolve(res.responseJSON);
      });
    });
  }
}

// 依序執行 Ajax 請求
async function executeAjaxSequentially(ajaxArray) {
  const results = [];
  for (let i = 0; i < ajaxArray.length; i++) {
    wlLog(`⏳ 補卡進度 ${i + 1} / ${ajaxArray.length}`);
    try {
      const result = await ajaxArray[i]();
      results.push(result);
    } catch (error) {
      console.error(`第 ${i + 1} 個請求失敗:`, error);
      results.push(error);
    }
  }
  return results;
}

// 他們的程式，抓取查詢的結果，在此覆蓋他們網站的fn。 loadingData("attendance")
loadingData("attendance")
function loadingData(t, e) {
  var a, n = $('select[name="work_status"]').val() || "1,4",
      o = ".tab-content",
      l = {
          absent: "absent",
          misspunch: "missedpunch",
          late: "late",
          leaveearly: "leaveearly",
          abnormal: "_147_punch_abnormal_short"
      };
  loadInBatch && e && 1 !== e || (e = 1, loadBatchStart(), a = Nueip.mask.start(o));
  var i = "action=" + t + "&loadInBatch=" + loadInBatch + "&loadBatchGroupNum=" + loadBatchGroupNum + "&loadBatchNumber=" + e + "&work_status=" + n,
      r = $("[name='ajax_url']").val();
  loadBatchSend[e] = $.post(r, i, (function(a) {
    window.WL_AttendanceData = a; //// CB
    wlLog('📊 NUEIP 出勤資料', WL_AttendanceData); //// CB
    return 1 === e && (dataQuantity = 0, $.each(a.data, (function(t, e) {
      if ($.each(e, (function(t, e) {
        dataQuantity++
      })), dataQuantity > verticalTableMaxNum) return !1
    })), dataTable = dtInit()), buildTableContent(a, t, e)
  }), "json").done((function(t) {
    var e = $("#abnormal").val(),
        a = $("#tablefilter").val();
    "1" == e ? ($(".ctrl-filter").each((function(t, e) {
      var n = $(e);
      if ("" == a) n.hasClass("active") || n.trigger("click");
      else {
        var o = l[a] || "";
        n.hasClass("active") || n.data("filter") != o || n.trigger("click")
      }
    })), $("#abnormal").val("0")) : datatableFilterSetting($(".ctrl-nofilter").hasClass("active") ? "0" : "1");
    jumpCorrection()
  })).error((function(t, n, l) {
    1 === e && Nueip.mask.end(o, a), console.log(l)
  }))
  return loadBatchSend[e]; //// CB：回傳查詢的 jqXHR，供補卡前重新查詢完成後再繼續
}