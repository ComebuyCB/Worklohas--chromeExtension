// 添加時間設定介面
$('body').append(`
  <div id="CB_fixed" style="position: fixed; bottom: 0; left: 0; z-index: 9999; background: white; padding: 10px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
    <div style="position: absolute; top: -15px; right: -15px; cursor: pointer; background: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 5px rgba(0,0,0,0.2);" id="CB_toggle">
      <i class="fa fa-chevron-up"></i>
    </div>
    <div id="CB_content" style="margin-top: 20px;">
      <div class="input-group" style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">上班時間</label>
        <div style="display: flex; gap: 5px; align-items: center;">
          <select id="CB_startHour" style="width: 50px; padding: 5px;">
            <option value="" default selected hidden>時</option>
            ${Array.from({length: 13}, (_, i) => `<option value="${(i + 6).toString().padStart(2, '0')}">${(i + 6).toString().padStart(2, '0')}</option>`).join('')}
          </select>
          <span>:</span>
          <select id="CB_startMin" style="width: 50px; padding: 5px;">
            <option value="" default selected hidden>分</option>
            ${Array.from({length: 6}, (_, i) => `<option value="${(i * 10).toString().padStart(2, '0')}">${(i * 10).toString().padStart(2, '0')}</option>`).join('')}
          </select>
          <span style="margin-left: 10px;">隨機前</span>
          <select id="CB_startRandom" style="width: 50px; padding: 5px;">
            <option value="" default selected hidden>--</option>
            ${Array.from({length: 13}, (_, i) => `<option value="${i * 5}" ${i === 1 ? 'selected' : ''}>${i * 5}</option>`).join('')}
          </select>
          <span>分鐘</span>
        </div>
      </div>
      <div class="input-group" style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">下班時間</label>
        <div style="display: flex; gap: 5px; align-items: center;">
          <select id="CB_endHour" style="width: 50px; padding: 5px;">
            <option value="" default selected hidden>時</option>
            ${Array.from({length: 13}, (_, i) => `<option value="${(i + 12).toString().padStart(2, '0')}">${(i + 12).toString().padStart(2, '0')}</option>`).join('')}
          </select>
          <span>:</span>
          <select id="CB_endMin" style="width: 50px; padding: 5px;">
            <option value="" default selected hidden>分</option>
            ${Array.from({length: 6}, (_, i) => `<option value="${(i * 10).toString().padStart(2, '0')}">${(i * 10).toString().padStart(2, '0')}</option>`).join('')}
          </select>
          <span style="margin-left: 10px;">隨機後</span>
          <select id="CB_endRandom" style="width: 50px; padding: 5px;">
            <option value="" default selected hidden>--</option>
            ${Array.from({length: 13}, (_, i) => `<option value="${i * 5}" ${i === 1 ? 'selected' : ''}>${i * 5}</option>`).join('')}
          </select>
          <span>分鐘</span>
        </div>
      </div>
    </div>
    <button id="CB_btn" class="btn btn-danger btn-sm" style="width: 100%;">
      <i class="fa fa-plus"></i> 自動補卡
    </button>
  </div>
`);

// 添加切換功能
$(document).on('click', '#CB_toggle', function() {
  const $content = $('#CB_content');
  const $icon = $(this).find('i');
  const $btn = $('#CB_btn');
  const $fixed = $('#CB_fixed');
  
  if ($content.is(':visible')) {
    $content.slideUp();
    $icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
    $btn.css('width', 'auto');
    $fixed.css('width', 'auto');
  } else {
    $content.slideDown();
    $icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
    $btn.css('width', '100%');
    $fixed.css('width', '');
  }
});

// 監聽來自 content.js 的消息
window.addEventListener('message', (event) => {
  const receivedData = event.data;
  if (event.source !== window) return;
  if (receivedData.type === 'INIT_SELECT_VALUES') {
    initializeSelectValues(receivedData.data.autoPunchSettings);
  }
});

// 初始化 <select> 值
function initializeSelectValues(values) {
  console.log('initializeSelectValues', values);
  if (values) {
    $('#CB_startHour').val(values.startHour);
    $('#CB_startMin').val(values.startMin);
    $('#CB_endHour').val(values.endHour);
    $('#CB_endMin').val(values.endMin);
    $('#CB_startRandom').val(values.startRandom);
    $('#CB_endRandom').val(values.endRandom);
  }
}

var CB_selectValues = {
  startHour: '',
  startMin: '',
  endHour: '',
  endMin: '',
  startRandom: '',
  endRandom: ''
}

// 監聽按鈕點擊
$(document).on('click', '#CB_btn', function() {
  const autoPunchSettings = {
    startHour: $('#CB_startHour').val(),
    startMin: $('#CB_startMin').val(),
    endHour: $('#CB_endHour').val(),
    endMin: $('#CB_endMin').val(),
    startRandom: $('#CB_startRandom').val(),
    endRandom: $('#CB_endRandom').val()
  };

  if ( autoPunchSettings.startHour === '' || 
    autoPunchSettings.startMin === '' || 
    autoPunchSettings.endHour === '' || 
    autoPunchSettings.endMin === '' || 
    autoPunchSettings.startRandom === '' || 
    autoPunchSettings.endRandom === '' ){
    alert('請先設定完整');
    return;
  }

  CB_selectValues = autoPunchSettings;

  window.postMessage({ // 發送消息給 content.js
    type: 'SAVE_SELECT_VALUES',
    data: {
      autoPunchSettings: autoPunchSettings
    }
  }, '*');

  autoCheckIn(); // 執行自動打卡
});

// 自動打卡功能
function autoCheckIn(){
  const date_today = new Date().toISOString().split('T')[0];
  const $TR = $('#body-wrapper #table_content').children('tbody').children('tr');
  const U_SN = $TR.children('td').eq(0).attr('class').split(' ').find((val)=>(/sn\d\d\d\d\d\d/g).test(val))?.replace('sn','');
  
  const ajaxArray = [];
  const select_startTime = CB_selectValues.startHour + ':' + CB_selectValues.startMin + ':00';
  const select_endTime = CB_selectValues.endHour + ':' + CB_selectValues.endMin + ':00';

  $.each($TR, function(trIdx, trVal){
    /*=== 檢查日期，未來或休假 ===*/
    let TR_hasBG = $(trVal).attr('class').split(' ').some((val)=> (/bg_color/g).test(val));
    let TR_date = $.trim($(trVal).children('td[data-th="日期"]').find('.dateday')?.text());
    if (date_today < TR_date || TR_hasBG === true){
      console.log(TR_date, '未來或休假');
      return true;
    }

    /*=== 時間打卡，上班和下班 ===*/
    let startTime = $.trim($(trVal).children('td[data-th="上班"]')?.text());
    let endTime = $.trim($(trVal).children('td[data-th="下班"]')?.text());

    const { startHour, startMin, startRandom, endHour, endMin, endRandom } = CB_selectValues;

    if (startTime.length === 0){ // 補卡 (上班)
      let {hour, min} = getRdHourMin(startHour, startMin, startRandom, "上班");
      let postData = { section: 1, hour, min, remark: '補卡', u_sn: U_SN, date: TR_date, apply_date: TR_date, }
      console.log(postData);
      ajaxArray.push( promiseAjax(postData) );
    }

    if (endTime.length === 0){ // 補卡 (下班)
      let {hour, min} = getRdHourMin(endHour, endMin, endRandom, "下班");
      let postData = { section: 2, hour, min, remark: '補卡', u_sn: U_SN, date: TR_date, apply_date: TR_date, }
      console.log(postData);
      ajaxArray.push( promiseAjax(postData) );
    }
  });

  // 執行所有補卡請求
  if (ajaxArray.length > 0) {
    Promise.all(ajaxArray.map(fn => fn())).then((res)=>{
      console.log(res);
      let successVals = res.filter((e)=> e?.code === 200);
      alert('自動打卡完畢! '+ '共'+ successVals.length +'筆。');
      // window.location.reload();
    });
  } else {
    alert('沒有需要補卡的記錄');
  }
}

// 獲取隨機時間
function getRdHourMin(hours, minutes, randomMins, type) {
  const totalMinutes = +hours * 60 + +minutes;

  // 計算隨機範圍
  let randomMinutes;
  if (type === "上班") {
    // 上班時間：在目標時間之前的隨機分鐘
    randomMinutes = Math.floor(Math.random() * randomMins);
    const newTotalMinutes = totalMinutes - randomMinutes;
    const newHours = Math.floor(newTotalMinutes / 60);
    const newMinutes = newTotalMinutes % 60;
    return {
      hour: newHours.toString().padStart(2, '0'),
      min: newMinutes.toString().padStart(2, '0')
    };
  } else {
    // 下班時間：在目標時間之後的隨機分鐘
    randomMinutes = Math.floor(Math.random() * randomMins);
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
  console.log(`ajax 補卡(${data.section === 1 ? '上班' : '下班'}) !!!!!`, data);
  return function(){
    return new Promise((resolve)=>{
      $.ajax({
        type: 'post',
        url: '/attendance_record/addCorrectionPunch',
        data,
      }).done(function(res) {
        console.log(res);
        resolve(res);
      }).error(function(res) {
        resolve(res.responseJSON);
      });
    });
  }
}



// 他們的程式，抓取查詢的結果，在此覆蓋他們網站的fn。 loadingData("attendance")
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
    console.log(a); //// CB
    window.CB_AttendanceData = a; //// CB
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
}